const ERROR_TITLES = {
  empty: "The AI sent back nothing",
  malformed: "The AI's answer was garbled",
  shape: "The AI's answer didn't fit",
  timeout: "That took too long",
  api: "Something went wrong",
};

export function EmptyState() {
  return (
    <div className="state empty">
      <div className="state-icon" aria-hidden="true">🗂️</div>
      <h2>No deck yet</h2>
      <p>Add some notes above and hit Generate. You'll get flip-through flashcards and a quiz that re-tests what you missed.</p>
    </div>
  );
}

export function LoadingState({ onCancel }) {
  return (
    <div className="state loading" role="status">
      <div className="skeleton-card" aria-hidden="true">
        <span className="shimmer" />
      </div>
      <p>Building your deck…</p>
      <button type="button" className="ghost" onClick={onCancel}>
        Cancel
      </button>
    </div>
  );
}

export function ErrorState({ error, onRetry }) {
  return (
    <div className="state error" role="alert">
      <div className="state-icon" aria-hidden="true">⚠️</div>
      <h2>{ERROR_TITLES[error.kind] || ERROR_TITLES.api}</h2>
      <p>{error.message}</p>
      <button type="button" className="primary" onClick={onRetry}>
        Try again
      </button>
    </div>
  );
}
