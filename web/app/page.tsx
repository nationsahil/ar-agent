"use client";

import { FormEvent, useMemo, useState } from "react";

type AnalysisResult = {
  claim_summary?: string;
  denial_codes?: string[];
  cpt_codes?: string[];
  balance?: string;
  payer?: string;
  patient_responsibility?: string;
  user_context_considered?: string;
  recommended_action?: string;
  reasoning?: string;
  billing_note?: string;
  queue?: string;
  needs_human_review?: boolean;
  missing_information?: string[];
};

type ContextNote = {
  id: number;
  text: string;
};

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [noteInput, setNoteInput] = useState("");
  const [notes, setNotes] = useState<ContextNote[]>([
    {
      id: 1,
      text: "System balance, prior payer calls, follow-up dates, and SOP details can go here.",
    },
  ]);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [raw, setRaw] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const contextText = useMemo(
    () => notes.map((note, index) => `${index + 1}. ${note.text}`).join("\n"),
    [notes],
  );

  function addNote() {
    const text = noteInput.trim();

    if (!text) {
      return;
    }

    setNotes((current) => [...current, { id: Date.now(), text }]);
    setNoteInput("");
  }

  function removeNote(id: number) {
    setNotes((current) => current.filter((note) => note.id !== id));
  }

  async function analyzeEob(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!file) {
      setError("Upload an EOB PDF first.");
      return;
    }

    setIsLoading(true);
    setError("");
    setResult(null);
    setRaw("");

    const formData = new FormData();
    formData.append("eob", file);
    formData.append("context", contextText);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        body: formData,
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "Analysis failed.");
      }

      setResult(payload.analysis);
      setRaw(payload.raw || "");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Analysis failed.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="shell">
      <section className="workspace">
        <header className="topbar">
          <div className="brand">
            <span className="brand-mark" aria-hidden="true">A</span>
            <div>
              <p className="eyebrow">AR Agent</p>
              <h1>Claims review</h1>
            </div>
          </div>
          <div className="privacy-status">
            <span className="status-dot" aria-hidden="true" />
            Local analysis workspace
          </div>
        </header>

        <form className="flow" onSubmit={analyzeEob}>
          <section className="panel upload-panel" aria-labelledby="upload-title">
            <div className="section-heading">
              <span className="step-number">1</span>
              <div>
                <h2 id="upload-title">Add an explanation of benefits</h2>
                <p>Upload the payer PDF to begin the review.</p>
              </div>
            </div>

            <label className="dropzone">
              <span className="document-icon" aria-hidden="true" />
              <span className="drop-copy">
                {file ? file.name : "Choose a PDF"}
                <small>{file ? `${Math.ceil(file.size / 1024)} KB selected` : "PDF documents only"}</small>
              </span>
              <span className="choose-file">Browse</span>
              <input
                accept="application/pdf"
                type="file"
                onChange={(event) => setFile(event.target.files?.[0] || null)}
              />
            </label>

            <div className="helper-card">
              <span>Tip</span>
              Add payer correspondence and existing balance in the next step for a more useful recommendation.
            </div>
          </section>

          <section className="panel context-panel" aria-labelledby="context-title">
            <div className="section-heading">
              <span className="step-number">2</span>
              <div>
                <h2 id="context-title">Add claim context</h2>
                <p>Capture the information that does not appear on the EOB.</p>
              </div>
            </div>

            <div className="composer">
              <textarea
                value={noteInput}
                onChange={(event) => setNoteInput(event.target.value)}
                placeholder="Add a follow-up, payer response, outstanding balance, or SOP guidance..."
              />
              <button className="secondary-button" type="button" onClick={addNote}>
                Add to context
              </button>
            </div>

            <div className="note-list" aria-live="polite">
              {notes.map((note, index) => (
                <article className="note" key={note.id}>
                  <span>{index + 1}</span>
                  <p>{note.text}</p>
                  <button type="button" onClick={() => removeNote(note.id)}>
                    Remove
                  </button>
                </article>
              ))}
            </div>

            <button className="primary-button" disabled={isLoading} type="submit">
              {isLoading ? "Reviewing claim..." : "Review claim"}
            </button>
            {error ? <p className="error">{error}</p> : null}
          </section>

          <section className="panel result-panel" aria-labelledby="result-title">
            <div className="section-heading">
              <span className="step-number">3</span>
              <div>
                <h2 id="result-title">Recommendation</h2>
                <p>Next action, routing, and a note for your billing system.</p>
              </div>
            </div>

            {result ? (
              <div className="result-grid">
                <ResultItem label="Recommended action" value={result.recommended_action} strong />
                <ResultItem label="Queue" value={result.queue} />
                <ResultItem label="Balance" value={result.balance} />
                <ResultItem label="Patient responsibility" value={result.patient_responsibility} />
                <ResultItem label="Claim summary" value={result.claim_summary} wide />
                <ResultItem label="Reasoning" value={result.reasoning} wide />
                <ResultItem label="Billing note" value={result.billing_note} wide mono />
                <ResultList label="Denial codes" values={result.denial_codes} />
                <ResultList label="CPT codes" values={result.cpt_codes} />
                <ResultList label="Missing information" values={result.missing_information} wide />
                <div className="review-flag">
                  {result.needs_human_review ? "Human review needed" : "Ready for AR workflow"}
                </div>
              </div>
            ) : (
              <div className="empty-state">
                <div className="empty-icon" aria-hidden="true">+</div>
                <h3>Your claim review will appear here</h3>
                <p>Upload an EOB, add context, then select Review claim.</p>
              </div>
            )}

            {raw ? (
              <details className="raw-output">
                <summary>Raw model response</summary>
                <pre>{raw}</pre>
              </details>
            ) : null}
          </section>
        </form>
      </section>
    </main>
  );
}

function ResultItem({
  label,
  value,
  strong,
  wide,
  mono,
}: {
  label: string;
  value?: string;
  strong?: boolean;
  wide?: boolean;
  mono?: boolean;
}) {
  return (
    <div className={`result-item ${wide ? "wide" : ""} ${strong ? "strong" : ""}`}>
      <span>{label}</span>
      <p className={mono ? "mono" : ""}>{value || "Not found"}</p>
    </div>
  );
}

function ResultList({
  label,
  values,
  wide,
}: {
  label: string;
  values?: string[];
  wide?: boolean;
}) {
  return (
    <div className={`result-item ${wide ? "wide" : ""}`}>
      <span>{label}</span>
      {values && values.length > 0 ? (
        <ul className="pill-list">
          {values.map((value) => (
            <li key={value}>{value}</li>
          ))}
        </ul>
      ) : (
        <p>Not found</p>
      )}
    </div>
  );
}
