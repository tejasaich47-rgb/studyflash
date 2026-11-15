// Turns the model's raw text into a deck the UI can trust.
// Models drift: they wrap JSON in code fences, rename keys, return the wrong
// shape, or emit half-valid items. Everything here is defensive on purpose.

export class OutputError extends Error {
  /** @param {"empty"|"malformed"|"shape"} kind */
  constructor(kind, message) {
    super(message);
    this.name = "OutputError";
    this.kind = kind;
  }
}

const MAX_TEXT = 600;
const LETTERS = "abcdef";

const clean = (v) => (typeof v === "string" ? v.trim().slice(0, MAX_TEXT) : "");

/** Pull a JSON value out of text that may have fences or chatter around it. */
export function extractJson(raw) {
  if (typeof raw !== "string" || !raw.trim()) {
    throw new OutputError("empty", "The AI returned an empty response.");
  }
  let text = raw.trim();
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) text = fenced[1].trim();

  try {
    return JSON.parse(text);
  } catch {
    // Fall back to the outermost {...} or [...] in case of surrounding prose.
    const candidates = [
      [text.indexOf("{"), text.lastIndexOf("}")],
      [text.indexOf("["), text.lastIndexOf("]")],
    ];
    for (const [start, end] of candidates) {
      if (start !== -1 && end > start) {
        try {
          return JSON.parse(text.slice(start, end + 1));
        } catch {
          /* try next candidate */
        }
      }
    }
  }
  throw new OutputError("malformed", "The AI's response wasn't valid JSON (it may have been cut off).");
}

export function normalizeCard(c) {
  if (!c || typeof c !== "object") return null;
  const front = clean(c.front ?? c.term ?? c.question ?? c.q);
  const back = clean(c.back ?? c.definition ?? c.answer ?? c.a);
  return front && back ? { front, back } : null;
}

function resolveAnswerIndex(q, options) {
  const raw = q.answerIndex ?? q.correctIndex ?? q.answer_index ?? q.correct ?? q.answer;
  if (typeof raw === "number" && Number.isInteger(raw)) {
    if (raw >= 0 && raw < options.length) return raw;
    if (raw >= 1 && raw <= options.length) return raw - 1; // 1-based drift
    return -1;
  }
  if (typeof raw === "string") {
    const s = raw.trim();
    const byText = options.findIndex((o) => o.toLowerCase() === s.toLowerCase());
    if (byText !== -1) return byText;
    const letter = LETTERS.indexOf(s.toLowerCase().replace(/[.)]/g, ""));
    if (s.length <= 3 && letter !== -1 && letter < options.length) return letter;
  }
  return -1;
}

export function normalizeQuestion(q) {
  if (!q || typeof q !== "object") return null;
  const question = clean(q.question ?? q.prompt ?? q.q);
  if (!question || !Array.isArray(q.options ?? q.choices)) return null;
  const options = (q.options ?? q.choices).map(clean).filter(Boolean).slice(0, 6);
  if (options.length < 2 || new Set(options.map((o) => o.toLowerCase())).size !== options.length) return null;
  const answerIndex = resolveAnswerIndex(q, options);
  if (answerIndex === -1) return null;
  return { question, options, answerIndex, explanation: clean(q.explanation ?? q.reason) };
}

/**
 * @returns {{ deck: {id:string,title:string,cards:object[],questions:object[]}, warnings: string[] }}
 * @throws {OutputError}
 */
export function parseDeck(raw) {
  let data = extractJson(raw);
  if (Array.isArray(data)) data = { cards: data };
  if (!data || typeof data !== "object") {
    throw new OutputError("shape", "The AI's response wasn't in the format we expected.");
  }

  const rawCards = Array.isArray(data.cards ?? data.flashcards) ? data.cards ?? data.flashcards : [];
  const rawQuestions = Array.isArray(data.questions ?? data.quiz) ? data.questions ?? data.quiz : [];

  const cards = rawCards.map(normalizeCard).filter(Boolean);
  const questions = rawQuestions.map(normalizeQuestion).filter(Boolean);

  if (cards.length === 0 && questions.length === 0) {
    throw new OutputError("shape", "The AI's response didn't contain any usable cards or questions.");
  }

  const warnings = [];
  const droppedCards = rawCards.length - cards.length;
  const droppedQs = rawQuestions.length - questions.length;
  if (droppedCards > 0) warnings.push(`${droppedCards} malformed card${droppedCards > 1 ? "s were" : " was"} skipped.`);
  if (droppedQs > 0) warnings.push(`${droppedQs} malformed question${droppedQs > 1 ? "s were" : " was"} skipped.`);
  if (rawQuestions.length === 0 || questions.length === 0) warnings.push("No quiz questions were generated for this deck.");
  if (rawCards.length === 0 || cards.length === 0) warnings.push("No flashcards were generated for this deck.");

  const stamp = Date.now().toString(36);
  return {
    deck: {
      id: stamp,
      title: clean(data.title) || "Study deck",
      cards: cards.map((c, i) => ({ ...c, id: `${stamp}-c${i}` })),
      questions: questions.map((q, i) => ({ ...q, id: `${stamp}-q${i}` })),
    },
    warnings,
  };
}
