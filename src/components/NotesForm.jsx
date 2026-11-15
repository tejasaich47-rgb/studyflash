import { useState } from "react";

const MAX = 12000;
const MIN = 10;
const EXAMPLE =
  "Photosynthesis: plants use light energy to convert carbon dioxide and water into glucose and oxygen. It happens in chloroplasts. Light reactions occur in the thylakoid membranes and produce ATP and NADPH. The Calvin cycle in the stroma uses them to fix CO2 into sugar.";

export default function NotesForm({ onSubmit, loading }) {
  const [notes, setNotes] = useState("");
  const trimmed = notes.trim();
  const tooShort = trimmed.length < MIN;
  const tooLong = notes.length > MAX;

  const submit = (e) => {
    e.preventDefault();
    if (!tooShort && !tooLong) onSubmit(trimmed);
  };

  return (
    <form className="form" onSubmit={submit}>
      <label htmlFor="notes">Your notes or topic</label>
      <textarea
        id="notes"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submit(e);
        }}
        placeholder="e.g. paste lecture notes, or just type “the French Revolution”"
        rows={6}
      />
      <div className="form-row">
        <span className={tooLong ? "hint bad" : "hint"}>
          {notes.length.toLocaleString()} / {MAX.toLocaleString()}
        </span>
        <div className="actions">
          <button type="button" className="ghost" onClick={() => setNotes(EXAMPLE)} disabled={loading}>
            Try an example
          </button>
          <button type="submit" className="primary" disabled={loading || tooShort || tooLong}>
            {loading ? "Generating…" : "Generate"}
          </button>
        </div>
      </div>
    </form>
  );
}
