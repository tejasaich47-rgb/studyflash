import { useState } from "react";
import { useGenerate } from "./hooks/useGenerate.js";
import NotesForm from "./components/NotesForm.jsx";
import Flashcards from "./components/Flashcards.jsx";
import Quiz from "./components/Quiz.jsx";
import { EmptyState, ErrorState, LoadingState } from "./components/States.jsx";

export default function App() {
  const { status, deck, warnings, error, run, retry, cancel } = useGenerate();
  const [tab, setTab] = useState("cards");
  const loading = status === "loading";

  return (
    <div className="app">
      <header className="header">
        <h1>StudyFlash</h1>
        <p>Paste notes or a topic. Get flashcards and a quiz you can actually practise with.</p>
      </header>

      <NotesForm onSubmit={run} loading={loading} />

      <main className="results" aria-live="polite" aria-busy={loading}>
        {loading && <LoadingState onCancel={cancel} />}
        {!loading && status === "idle" && <EmptyState />}
        {!loading && status === "error" && <ErrorState error={error} onRetry={retry} />}
        {!loading && status === "success" && deck && (
          <section className="deck">
            <div className="deck-head">
              <h2>{deck.title}</h2>
              <div className="tabs" role="tablist" aria-label="Study mode">
                <button role="tab" aria-selected={tab === "cards"} onClick={() => setTab("cards")}>
                  Flashcards <span className="count">{deck.cards.length}</span>
                </button>
                <button role="tab" aria-selected={tab === "quiz"} onClick={() => setTab("quiz")}>
                  Quiz <span className="count">{deck.questions.length}</span>
                </button>
              </div>
            </div>

            {warnings.length > 0 && (
              <ul className="notice" role="status">
                {warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            )}

            {/* key=deck.id resets all study progress when a new deck arrives */}
            {tab === "cards" ? (
              <Flashcards key={deck.id} cards={deck.cards} />
            ) : (
              <Quiz key={deck.id} questions={deck.questions} />
            )}
          </section>
        )}
      </main>
    </div>
  );
}
