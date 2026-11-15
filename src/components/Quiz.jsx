import { useEffect, useState } from "react";

export default function Quiz({ questions }) {
  const [round, setRound] = useState(1);
  const [queue, setQueue] = useState(questions);
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState(null);
  const [results, setResults] = useState([]); // this round: { q, picked, correct }

  const done = index >= queue.length;
  const q = queue[index];

  const choose = (i) => {
    if (picked !== null || !q) return;
    setPicked(i);
    setResults((r) => [...r, { q, picked: i, correct: i === q.answerIndex }]);
  };
  const next = () => {
    setPicked(null);
    setIndex((i) => i + 1);
  };

  const startRound = (list, nextRound) => {
    setQueue(list);
    setRound(nextRound);
    setIndex(0);
    setPicked(null);
    setResults([]);
  };

  useEffect(() => {
    const onKey = (e) => {
      if (!q) return;
      const n = Number(e.key);
      if (n >= 1 && n <= q.options.length) choose(n - 1);
      if ((e.key === "Enter" || e.key === "ArrowRight") && picked !== null) next();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (questions.length === 0) {
    return (
      <div className="state empty">
        <p>No quiz questions in this deck. Try generating again.</p>
      </div>
    );
  }

  if (done) {
    const missed = results.filter((r) => !r.correct);
    const score = results.length - missed.length;
    return (
      <div className="quiz results-card">
        <h3>
          {round > 1 ? `Re-test ${round - 1} complete` : "Quiz complete"}
        </h3>
        <p className="score">
          {score} / {results.length}
        </p>
        {missed.length === 0 ? (
          <p>{round > 1 ? "You've nailed everything you missed. 🎉" : "Perfect score! 🎉"}</p>
        ) : (
          <>
            <p>You missed {missed.length}:</p>
            <ul className="missed">
              {missed.map(({ q: mq, picked: p }) => (
                <li key={mq.id}>
                  <strong>{mq.question}</strong>
                  <span className="wrong">Your answer: {mq.options[p]}</span>
                  <span className="right">Correct: {mq.options[mq.answerIndex]}</span>
                </li>
              ))}
            </ul>
          </>
        )}
        <div className="actions">
          {missed.length > 0 && (
            <button className="primary" onClick={() => startRound(missed.map((m) => m.q), round + 1)}>
              Re-test {missed.length} missed
            </button>
          )}
          <button className="ghost" onClick={() => startRound(questions, 1)}>
            Retake full quiz
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="quiz">
      <div className="progress-row">
        <span>
          {round > 1 ? "Re-test · " : ""}Question {index + 1} of {queue.length}
        </span>
        <span className="muted">{results.filter((r) => r.correct).length} correct</span>
      </div>
      <div className="bar" aria-hidden="true">
        <span style={{ width: `${(index / queue.length) * 100}%` }} />
      </div>

      <h3 className="question">{q.question}</h3>
      <ul className="options">
        {q.options.map((opt, i) => {
          let state = "";
          if (picked !== null) {
            if (i === q.answerIndex) state = "correct";
            else if (i === picked) state = "incorrect";
          }
          return (
            <li key={i}>
              <button className={`option ${state}`} onClick={() => choose(i)} disabled={picked !== null}>
                <span className="key">{i + 1}</span>
                {opt}
              </button>
            </li>
          );
        })}
      </ul>

      {picked !== null && (
        <div className="feedback" role="status">
          <strong>{picked === q.answerIndex ? "Correct!" : "Not quite."}</strong>
          {q.explanation && <p>{q.explanation}</p>}
          <button className="primary" onClick={next}>
            {index + 1 === queue.length ? "See results" : "Next question"}
          </button>
        </div>
      )}
    </div>
  );
}
