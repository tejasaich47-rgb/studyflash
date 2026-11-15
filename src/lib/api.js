import { OutputError } from "./validate.js";

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

/** Calls our own backend, which holds the API key. Resolves to the model's raw text. */
export async function requestDeck(notes, { signal } = {}) {
  let res;
  try {
    res = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes }),
      signal,
    });
  } catch (err) {
    if (err.name === "AbortError") throw err;
    throw new ApiError("Couldn't reach the server. Check your connection and that the API is running.", 0);
  }

  let payload = null;
  try {
    payload = await res.json();
  } catch {
    /* non-JSON body handled below */
  }

  if (!res.ok) {
    throw new ApiError(payload?.error || `Request failed (${res.status}).`, res.status);
  }
  if (!payload || typeof payload.content !== "string" || !payload.content.trim()) {
    throw new OutputError("empty", "The AI returned an empty response.");
  }
  return payload.content;
}
