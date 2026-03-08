import React, { useState } from "react";
import FileUpload from "./components/FileUpload";
import PreviewScreen from "./components/PreviewScreen";
import MappingEditor from "./components/MappingEditor";
import ValidationResults from "./components/ValidationResults";
import "./App.css";
import RuleValidationResults from "./components/RuleValidationResults";

export default function App() {
  const [stage, setStage] = useState("idle");
  const [parsedFile, setParsedFile] = useState(null);
  const [detection, setDetection] = useState(null);
  const [mapping, setMapping] = useState(null);       // ← stores full /ai/map-columns response
  const [dbOutput, setDbOutput] = useState(null);
  const [ruleOutput, setRuleOutput] = useState(null);
  const [error, setError] = useState(null);

  const handleUploadComplete = (fileData, detectionData) => {
    setParsedFile(fileData);
    setDetection(detectionData);
    setStage("preview");
  };

  const handleMappingConfirmed = (mappingData) => {
    setMapping(mappingData);          // ← save full mapping response
    setStage("mapping");
  };

  const handleRuleValidationComplete = (ruleData) => {
    setRuleOutput(ruleData);
    setStage("rule_results");
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
    setRuleOutput(null);
  };

  const handleError = (msg) => {
    setError(msg);
    setStage("idle");
  };

  return (
    <div className="app-shell">
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

      {stage !== "idle" && <StageBar current={stage} />}

      <main className="main-content">
        {error && (
          <div className="error-banner">
            <span>⚠</span> {error}
            <button onClick={() => setError(null)}>✕</button>
          </div>
        )}

        {stage === "idle" && (
          <FileUpload
            onComplete={handleUploadComplete}
            onError={handleError}
            setStage={setStage}
          />
        )}

        {(stage === "uploading" || stage === "detecting") && (
          <LoadingCard
            icon={stage === "uploading" ? "📂" : "🔍"}
            title={stage === "uploading" ? "Parsing your file…" : "Detecting schema…"}
            sub={stage === "uploading"
              ? "Extracting columns and preview rows"
              : "Running Gemini embeddings to identify the data entity"}
          />
        )}

        {stage === "preview" && parsedFile && detection && (
          <PreviewScreen
            parsedFile={parsedFile}
            detection={detection}
            onConfirm={handleMappingConfirmed}
            onError={handleError}
            setStage={setStage}
          />
        )}

        {/* FIX: pass mappingData prop so MappingEditor uses it directly */}
        {stage === "mapping" && parsedFile && detection && mapping && (
          <MappingEditor
            parsedFile={parsedFile}
            detection={detection}
            mappingData={mapping}
            onComplete={handleRuleValidationComplete}
            onError={handleError}
            setStage={setStage}
          />
        )}

        {stage === "rule_check" && (
          <LoadingCard
            icon="⚙"
            title="Running rule validation…"
            sub="Checking types, lengths, duplicates, conflicts — no AI used"
          />
        )}

        {stage === "rule_results" && ruleOutput && (
          <RuleValidationResults
            ruleOutput={ruleOutput}
            parsedFile={parsedFile}
            detection={detection}
            onSendToAI={handleValidationComplete}
            onReset={handleReset}
            setStage={setStage}
          />
        )}

        {stage === "validating" && (
          <LoadingCard
            icon="🤖"
            title="Validating with Gemini LLM…"
            sub="Checking values, normalising dates, phone numbers, booleans across all rows"
          />
        )}

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

const STAGES = [
  { key: "uploading",    label: "Upload" },
  { key: "detecting",   label: "Detect" },
  { key: "preview",     label: "Preview" },
  { key: "mapping",     label: "Map Columns" },
  { key: "rule_check",  label: "Rule Check" },
  { key: "rule_results",label: "Rule Results" },
  { key: "validating",  label: "AI Validate" },
  { key: "results",     label: "Results" },
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
