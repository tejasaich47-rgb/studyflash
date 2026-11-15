# StudyFlash

Paste notes or a topic, and an LLM turns them into **flashcards** and a **multiple-choice quiz**. You can flip through cards, mark what you know, take the quiz, and re-test only the questions you missed.

It is not a chatbot: the model returns structured JSON, and the app validates it and renders interactive components from it.

## Setup

Requires Node 18+.

```bash
npm install
cp .env.example .env     # then add your key (see below)
npm start                # API on :8787, app on http://localhost:5173
```

No API key yet? Set `LLM_MOCK=1` in `.env` to try the whole UI with canned responses (see "Testing failure handling").

### Choosing a model provider

The server talks to any OpenAI-compatible `/chat/completions` endpoint, so switching provider is just three env vars (`LLM_BASE_URL`, `LLM_MODEL`, `LLM_API_KEY`). `.env.example` has ready-to-uncomment settings for Groq (free), Gemini (free) and Ollama (local, no key).

The API key stays on the server (`server/index.js`). The browser only calls `/api/generate`, which Vite proxies to the server in development.

## How it works

```
NotesForm → useGenerate() → POST /api/generate → LLM
                 ↑                                  │ raw text
                 └─ parseDeck() validates ←─────────┘
                        ↓
            Flashcards / Quiz (stateful UI)
```

- `server/index.js`: tiny Express proxy. Builds the prompt, calls the model with a timeout, passes the model's **raw text** back untouched, and maps upstream failures to clean errors. Also has a per-IP rate limit and input length checks.
- `src/lib/validate.js`: the core of the failure handling (below).
- `src/hooks/useGenerate.js`: request lifecycle (`idle → loading → success | error`), cancellation, timeout, and stale-response protection.
- `src/components/`: `NotesForm`, `Flashcards`, `Quiz`, and `States` (empty / loading / error).

## Handling bad AI output

| Problem | What happens |
| --- | --- |
| Empty response | Error screen with a retry button |
| Malformed or truncated JSON | Tries to strip code fences and to extract the outermost `{…}`; if that fails, shows an error with retry |
| Valid JSON, wrong shape | Error screen ("didn't fit") with retry |
| Some items invalid | Bad cards/questions are dropped, the valid ones are kept, and a notice says how many were skipped |
| Key drift (`term/definition`, `choices`, answer as letter or text, 1-based index) | Normalised in `validate.js` |
| Slow response | 45s client timeout and 40s server timeout, with a clear message and retry |
| Provider error / rate limit / server down | Specific error message and retry; the UI never crashes |
| Stale response | Each request has an increasing id and its own `AbortController`. A new request aborts the previous one, and any result that is not from the latest request is discarded |
| Cancel while loading | Cancel button invalidates the in-flight request |

Quiz questions are strictly validated (≥2 unique options, answer must resolve to a real option) because a wrong answer key would silently teach the wrong thing.

### Testing failure handling

- `npm test` runs unit tests for the parser/validator (clean JSON, fences, chatter, empty, truncated, wrong shape, partial, key drift).
- With `LLM_MOCK=1`, include a marker in the notes to simulate a failure end to end: `[mock:bad-json]`, `[mock:wrong-shape]`, `[mock:empty]`, `[mock:partial]`, `[mock:fail]`, `[mock:slow]` (the last one lets you test the timeout and cancel button).

## Features

- Flashcards: tap or click to flip, ← → keys, shuffle, "Got it" / "Still learning" marks, review only the "still learning" cards.
- Quiz: immediate feedback and explanation, keys 1–4 to answer, Enter to continue, score summary, **re-test only missed questions** (repeatable until all are right), or retake the full quiz.
- Loading, error and empty states, a character counter, and Ctrl/Cmd+Enter to submit.
- Mobile-friendly layout with large tap targets, plus dark mode and reduced-motion support.

## AI-usage note

> **Edit this section to reflect what is true for you before submitting.**

This project was scaffolded with the help of Claude (Anthropic's assistant), which generated the initial code for the server, validator, hook, components and styles. I should be able to explain every part of it. Before submitting, I'll read through the code, run it, and be ready to walk through the stale-response logic in `useGenerate.js` and the normalisation logic in `validate.js`. I used the LLM provider at runtime only through my own backend.

## Known limitations

- No streaming: the whole deck arrives at once.
- No persistence: decks and progress are lost on refresh.
- No follow-up/refinement prompts yet; each submit regenerates a new deck.
- Only text input (no PDF or image upload), capped at 12,000 characters.
- The in-memory rate limiter resets when the server restarts and isn't suitable for multi-instance deployment.
- Small local models (Ollama) may often produce invalid JSON; the validator copes, but you may see more retries.
- Not deployed. To deploy, host the Express server (or port `/api/generate` to a serverless function) and set the env vars there.

## What I'd do next

1. Stream the response and render cards as they arrive.
2. Save and reload decks in `localStorage`.
3. A refinement loop ("make these harder", "add 5 more cards") that edits the existing deck.
4. Component tests for `Quiz` and `Flashcards`.

## Time spent

> Fill in your actual time. (Assignment target: ≤ 8 hours.)
