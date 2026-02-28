import React, { useState } from "react";
import FileUpload from "./components/FileUpload";
import PreviewScreen from "./components/PreviewScreen";
import MappingEditor from "./components/MappingEditor";
import ValidationResults from "./components/ValidationResults";
import "./App.css";

// Stages mirror the run-guide sequence exactly:
// idle → uploading → preview → mapping → validating → results
export default function App() {
  const [stage, setStage] = useState("idle");
  const [parsedFile, setParsedFile]   = useState(null); // Step 6 output
  const [detection, setDetection]     = useState(null); // Step 7 output
  const [mapping, setMapping]         = useState(null); // Step 8 output
  const [dbOutput, setDbOutput]       = useState(null); // Step 10 output
  const [error, setError]             = useState(null);

  const handleUploadComplete = (fileData, detectionData) => {
    setParsedFile(fileData);
    setDetection(detectionData);
    setStage("preview");
  };

  const handleMappingConfirmed = (mappingData) => {
    setMapping(mappingData);
    setStage("mapping");
  };

  const handleValidationComplete = (outputData) => {
    setDbOutput(outputData);
    setStage("results");
  };

  const handleReset = () => {
    setStage("idle");
    setParsedFile(null);
    setDetection(null);
    setMapping(null);
    setDbOutput(null);
    setError(null);
  };

  const handleError = (msg) => {
    setError(msg);
    setStage("idle");
  };

  return (
    <div className="app-shell">
      {/* Top bar */}
      <header className="topbar">
        <div className="topbar-brand">
          <span className="topbar-icon">⬡</span>
          <span className="topbar-title">DataBridge</span>
          <span className="topbar-sub">Logistics Import Studio</span>
        </div>
        {stage !== "idle" && (
          <button className="btn-ghost" onClick={handleReset}>
            ← New Import
          </button>
        )}
      </header>

      {/* Stage progress indicator */}
      {stage !== "idle" && (
        <StageBar current={stage} />
      )}

      <main className="main-content">
        {error && (
          <div className="error-banner">
            <span>⚠</span> {error}
            <button onClick={() => setError(null)}>✕</button>
          </div>
        )}

        {/* STAGE: idle — drag & drop */}
        {stage === "idle" && (
          <FileUpload
            onComplete={handleUploadComplete}
            onError={handleError}
            setStage={setStage}
          />
        )}

        {/* STAGE: uploading / detecting */}
        {(stage === "uploading" || stage === "detecting") && (
          <LoadingCard
            icon={stage === "uploading" ? "📂" : "🔍"}
            title={stage === "uploading" ? "Parsing your file…" : "Detecting schema…"}
            sub={stage === "uploading"
              ? "Extracting columns and preview rows"
              : "Running Gemini embeddings to identify the data entity"}
          />
        )}

        {/* STAGE: preview — show parsed data + schema detection result */}
        {stage === "preview" && parsedFile && detection && (
          <PreviewScreen
            parsedFile={parsedFile}
            detection={detection}
            onConfirm={handleMappingConfirmed}
            onError={handleError}
            setStage={setStage}
          />
        )}

        {/* STAGE: mapping — AI column mapping, user can edit */}
        {stage === "mapping" && parsedFile && detection && (
          <MappingEditor
            parsedFile={parsedFile}
            detection={detection}
            onComplete={handleValidationComplete}
            onError={handleError}
            setStage={setStage}
          />
        )}

        {/* STAGE: validating */}
        {stage === "validating" && (
          <LoadingCard
            icon="🤖"
            title="Validating with Gemini LLM…"
            sub="Checking values, normalising dates, phone numbers, booleans across all rows"
          />
        )}

        {/* STAGE: results */}
        {stage === "results" && dbOutput && (
          <ValidationResults
            dbOutput={dbOutput}
            schemaName={detection?.detected_schema}
            onReset={handleReset}
          />
        )}
      </main>
    </div>
  );
}

// ─── Stage progress bar ───────────────────────────────────────────────────────
const STAGES = [
  { key: "uploading",  label: "Upload" },
  { key: "detecting",  label: "Detect" },
  { key: "preview",    label: "Preview" },
  { key: "mapping",    label: "Map Columns" },
  { key: "validating", label: "Validate" },
  { key: "results",    label: "Results" },
];

function StageBar({ current }) {
  const idx = STAGES.findIndex(s => s.key === current);
  return (
    <div className="stage-bar">
      {STAGES.map((s, i) => (
        <React.Fragment key={s.key}>
          <div className={`stage-step ${i < idx ? "done" : i === idx ? "active" : "pending"}`}>
            <div className="stage-dot">{i < idx ? "✓" : i + 1}</div>
            <span className="stage-label">{s.label}</span>
          </div>
          {i < STAGES.length - 1 && (
            <div className={`stage-line ${i < idx ? "done" : ""}`} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

// ─── Shared loading card ──────────────────────────────────────────────────────
function LoadingCard({ icon, title, sub }) {
  return (
    <div className="loading-card">
      <div className="loading-icon">{icon}</div>
      <div className="loading-spinner" />
      <h3 className="loading-title">{title}</h3>
      <p className="loading-sub">{sub}</p>
    </div>
  );
}
