import { useEffect, useMemo, useState } from "react";

function shuffled(list) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function Flashcards({ cards }) {
  const [order, setOrder] = useState(cards);
  const [marks, setMarks] = useState({}); // id -> "known" | "learning"
  const [onlyLearning, setOnlyLearning] = useState(false);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);

  const visible = useMemo(
    () => (onlyLearning ? order.filter((c) => marks[c.id] === "learning") : order),
    [order, marks, onlyLearning]
  );
  const learningCount = Object.values(marks).filter((m) => m === "learning").length;
  const knownCount = Object.values(marks).filter((m) => m === "known").length;

  // Keep the index valid when the visible list shrinks.
  const safeIndex = Math.min(index, Math.max(visible.length - 1, 0));
  const card = visible[safeIndex];

  const go = (delta) => {
    if (!visible.length) return;
    setFlipped(false);
    setIndex((safeIndex + delta + visible.length) % visible.length);
  };

  const mark = (value) => {
    setMarks((m) => ({ ...m, [card.id]: value }));
    // In "still learning" mode a known card drops out, so the index already points at the next one.
    if (!(onlyLearning && value === "known")) go(1);
    else setFlipped(false);
  };

  useEffect(() => {
    const onKey = (e) => {
      if (/input|textarea/i.test(e.target.tagName)) return;
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (cards.length === 0) {
    return (
      <div className="state empty">
        <p>No flashcards in this deck. Try generating again.</p>
      </div>
    );
  }

  if (!card) {
    return (
      <div className="state empty">
        <div className="state-icon" aria-hidden="true">🎉</div>
        <h2>Nothing left to review</h2>
        <p>You've marked every card as known.</p>
        <button className="primary" onClick={() => { setOnlyLearning(false); setIndex(0); }}>
          Show all cards
        </button>
      </div>
    );
  }

  return (
    <div className="cards">
      <div className="progress-row">
        <span>
          Card {safeIndex + 1} of {visible.length}
        </span>
        <span className="muted">
          ✓ {knownCount} known · ↻ {learningCount} learning
        </span>
      </div>

      <button
        type="button"
        className={`flip ${flipped ? "is-flipped" : ""}`}
        onClick={() => setFlipped((f) => !f)}
        aria-label={flipped ? "Showing answer. Tap to show the question." : "Showing question. Tap to reveal the answer."}
      >
        <span className="flip-inner">
          <span className="face front">
            <small>Question</small>
            {card.front}
          </span>
          <span className="face back">
            <small>Answer</small>
            {card.back}
          </span>
        </span>
      </button>

      <div className="card-actions">
        <button className="ghost" onClick={() => go(-1)} aria-label="Previous card">←</button>
        <button className="warn" onClick={() => mark("learning")}>Still learning</button>
        <button className="good" onClick={() => mark("known")}>Got it</button>
        <button className="ghost" onClick={() => go(1)} aria-label="Next card">→</button>
      </div>

      <div className="toolbar">
        <button
          className="link"
          onClick={() => {
            setOrder(shuffled(cards));
            setIndex(0);
            setFlipped(false);
          }}
        >
          Shuffle
        </button>
        <button
          className="link"
          disabled={learningCount === 0 && !onlyLearning}
          onClick={() => {
            setOnlyLearning((v) => !v);
            setIndex(0);
            setFlipped(false);
          }}
        >
          {onlyLearning ? "Show all cards" : `Review only “still learning” (${learningCount})`}
        </button>
      </div>
      <p className="muted tip">Tip: use ← → keys to move between cards.</p>
    </div>
  );
}
