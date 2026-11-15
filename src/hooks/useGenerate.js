import { useCallback, useEffect, useRef, useState } from "react";
import { requestDeck } from "../lib/api.js";
import { parseDeck } from "../lib/validate.js";

const CLIENT_TIMEOUT_MS = 45000;
const INITIAL = { status: "idle", deck: null, warnings: [], error: null };

/**
 * Owns the request lifecycle: idle → loading → success | error.
 *
 * Stale-response protection: every run gets an increasing id and its own
 * AbortController. Starting a new run aborts the previous fetch, and any
 * result whose id isn't the latest is dropped, so a slow old response can
 * never overwrite a newer one.
 */
export function useGenerate() {
  const [state, setState] = useState(INITIAL);
  const latestId = useRef(0);
  const controller = useRef(null);
  const lastNotes = useRef("");

  const run = useCallback(async (notes) => {
    controller.current?.abort();
    const id = ++latestId.current;
    const ctrl = new AbortController();
    controller.current = ctrl;
    lastNotes.current = notes;

    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      ctrl.abort();
    }, CLIENT_TIMEOUT_MS);

    setState((s) => ({ ...s, status: "loading", error: null }));

    try {
      const raw = await requestDeck(notes, { signal: ctrl.signal });
      if (id !== latestId.current) return;
      const { deck, warnings } = parseDeck(raw);
      setState({ status: "success", deck, warnings, error: null });
    } catch (err) {
      if (id !== latestId.current) return; // superseded or cancelled
      if (err.name === "AbortError" && !timedOut) return;
      const message = timedOut ? "The AI is taking too long to respond." : err.message || "Something went wrong.";
      setState({ status: "error", deck: null, warnings: [], error: { message, kind: timedOut ? "timeout" : err.kind || "api" } });
    } finally {
      clearTimeout(timer);
    }
  }, []);

  const cancel = useCallback(() => {
    latestId.current++; // invalidate whatever is in flight
    controller.current?.abort();
    setState((s) => (s.deck ? { ...s, status: "success" } : INITIAL));
  }, []);

  const retry = useCallback(() => run(lastNotes.current), [run]);

  useEffect(() => () => controller.current?.abort(), []);

  return { ...state, run, retry, cancel };
}
