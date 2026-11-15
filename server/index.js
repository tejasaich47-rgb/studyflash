import "dotenv/config";
import express from "express";

const {
  LLM_BASE_URL = "https://api.groq.com/openai/v1",
  LLM_MODEL = "llama-3.3-70b-versatile",
  LLM_API_KEY,
  LLM_JSON_MODE = "1",
  LLM_MOCK,
  PORT = 8787,
} = process.env;

const MAX_NOTES = 12000;
const MIN_NOTES = 10;
const UPSTREAM_TIMEOUT_MS = 40000;

const SYSTEM_PROMPT = `You turn study notes into a study deck. Respond with ONLY a JSON object, no prose, no markdown fences.

Shape:
{
  "title": string,
  "cards": [ { "front": string, "back": string } ],
  "questions": [
    { "question": string, "options": [string, string, string, string], "answerIndex": 0-3, "explanation": string }
  ]
}

Rules:
- 8 to 12 cards. "front" is a short prompt or term; "back" is a concise answer (max 2 sentences).
- 6 to 8 multiple-choice questions, exactly 4 options each, exactly one correct, answerIndex is the 0-based index of the correct option.
- Only use facts supported by the notes or the topic. Do not invent details.
- If the input is a topic rather than notes, cover the core ideas of that topic.`;

const app = express();
app.use(express.json({ limit: "64kb" }));

// Tiny in-memory rate limit so a leaked URL can't burn the key.
const hits = new Map();
function rateLimit(req, res, next) {
  const now = Date.now();
  const key = req.ip;
  const recent = (hits.get(key) || []).filter((t) => now - t < 60_000);
  if (recent.length >= 12) {
    return res.status(429).json({ error: "Too many requests. Wait a minute and try again." });
  }
  recent.push(now);
  hits.set(key, recent);
  next();
}

const sleep = (ms, signal) =>
  new Promise((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(t);
      reject(new Error("aborted"));
    });
  });

// Canned responses so the UI (and its failure handling) can be demoed with no key.
// Include a marker like [mock:bad-json] in the notes to simulate that failure.
async function mockResponse(notes, signal) {
  if (notes.includes("[mock:slow]")) await sleep(50_000, signal);
  await sleep(700, signal);
  if (notes.includes("[mock:fail]")) throw Object.assign(new Error("Mock upstream failure"), { status: 500 });
  if (notes.includes("[mock:empty]")) return "";
  if (notes.includes("[mock:bad-json]")) return '```json\n{ "title": "Broken", "cards": [ { "front": "What is';
  if (notes.includes("[mock:wrong-shape]")) return JSON.stringify({ result: "Here are your flashcards!", items: [1, 2, 3] });
  if (notes.includes("[mock:partial]")) {
    return JSON.stringify({
      title: "Partially valid deck",
      cards: [{ front: "Valid card", back: "This one is fine." }, { front: "No back" }, 42],
      questions: [{ question: "Broken question", options: ["only one"], answerIndex: 5 }],
    });
  }
  return JSON.stringify({
    title: "Photosynthesis basics",
    cards: [
      { front: "Where does photosynthesis happen?", back: "In the chloroplasts of plant cells." },
      { front: "What pigment captures light?", back: "Chlorophyll, which absorbs mostly red and blue light." },
      { front: "Inputs of photosynthesis", back: "Carbon dioxide, water, and light energy." },
      { front: "Outputs of photosynthesis", back: "Glucose and oxygen." },
      { front: "Light-dependent reactions", back: "Occur in the thylakoid membranes; make ATP, NADPH and release O2." },
      { front: "Calvin cycle", back: "Occurs in the stroma; uses ATP and NADPH to fix CO2 into sugar." },
    ],
    questions: [
      {
        question: "Which gas is released as a by-product of photosynthesis?",
        options: ["Carbon dioxide", "Oxygen", "Nitrogen", "Methane"],
        answerIndex: 1,
        explanation: "Water is split in the light reactions, releasing O2.",
      },
      {
        question: "Where does the Calvin cycle take place?",
        options: ["Thylakoid membrane", "Mitochondria", "Stroma", "Nucleus"],
        answerIndex: 2,
        explanation: "The Calvin cycle runs in the fluid stroma of the chloroplast.",
      },
      {
        question: "Which pigment is mainly responsible for absorbing light?",
        options: ["Hemoglobin", "Chlorophyll", "Melanin", "Keratin"],
        answerIndex: 1,
        explanation: "Chlorophyll absorbs red and blue wavelengths.",
      },
      {
        question: "What does the Calvin cycle produce?",
        options: ["Sugar from CO2", "Oxygen from water", "ATP from glucose", "Proteins from nitrogen"],
        answerIndex: 0,
        explanation: "It fixes carbon dioxide into sugar using ATP and NADPH.",
      },
    ],
  });
}

async function callModel(notes, signal) {
  if (LLM_MOCK === "1") return mockResponse(notes, signal);

  const body = {
    model: LLM_MODEL,
    temperature: 0.4,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: `Study material:\n"""\n${notes}\n"""` },
    ],
  };
  if (LLM_JSON_MODE === "1") body.response_format = { type: "json_object" };

  const upstream = await fetch(`${LLM_BASE_URL.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${LLM_API_KEY}` },
    body: JSON.stringify(body),
    signal,
  });

  if (!upstream.ok) {
    const detail = (await upstream.text().catch(() => "")).slice(0, 300);
    console.error(`[upstream ${upstream.status}]`, detail);
    throw Object.assign(new Error("The AI provider returned an error."), { status: upstream.status });
  }
  const data = await upstream.json();
  // Pass the model's text through untouched. Parsing and validating it is the
  // client's job, since that's where bad output has to be handled gracefully.
  return data?.choices?.[0]?.message?.content ?? "";
}

app.post("/api/generate", rateLimit, async (req, res) => {
  const notes = typeof req.body?.notes === "string" ? req.body.notes.trim() : "";
  if (notes.length < MIN_NOTES) return res.status(400).json({ error: "Add a few more words of notes or a topic." });
  if (notes.length > MAX_NOTES) return res.status(400).json({ error: `Notes are too long (max ${MAX_NOTES} characters).` });
  if (LLM_MOCK !== "1" && !LLM_API_KEY) {
    return res.status(500).json({ error: "Server has no LLM_API_KEY. Copy .env.example to .env and add one (or set LLM_MOCK=1)." });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  // Stop paying for the call if the browser gave up (cancel / newer request).
  res.on("close", () => {
    if (!res.writableEnded) controller.abort();
  });

  try {
    const content = await callModel(notes, controller.signal);
    res.json({ content });
  } catch (err) {
    if (res.writableEnded || res.destroyed) return;
    if (controller.signal.aborted) return res.status(504).json({ error: "The AI took too long to respond." });
    const status = err.status === 429 ? 429 : 502;
    res.status(status).json({
      error: status === 429 ? "The AI provider is rate limiting us. Try again shortly." : err.message || "Could not reach the AI provider.",
    });
  } finally {
    clearTimeout(timer);
  }
});

app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}${LLM_MOCK === "1" ? " (MOCK mode)" : ""}`);
});
