import React, { useState, useRef } from "react";
import { uploadFile, detectSchema } from "../services/api";

export default function FileUpload({ onComplete, onError, setStage }) {
  const [dragging, setDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const inputRef = useRef();

  const ACCEPTED = [".xlsx", ".xls", ".csv", ".pdf"];

  const isAccepted = (file) =>
    ACCEPTED.some((ext) => file.name.toLowerCase().endsWith(ext));

  const processFile = async (file) => {
    if (!isAccepted(file)) {
      onError(`Unsupported file type. Please upload: ${ACCEPTED.join(", ")}`);
      return;
    }

    setSelectedFile(file);

    try {
      // ── Step 6: POST /upload ───────────────────────────────────────────────
      setStage("uploading");
      const uploadRes = await uploadFile(file);
      const parsed = uploadRes.data;

      if (parsed.error) {
        onError(parsed.error);
        return;
      }

      if (!parsed.columns || parsed.columns.length === 0) {
        onError("No column headers detected in this file. Please check row 1 contains headers.");
        return;
      }

      // ── Step 7: POST /ai/detect-schema ─────────────────────────────────────
      setStage("detecting");
      const detectRes = await detectSchema(parsed.columns, parsed.preview || []);

      onComplete(parsed, detectRes.data);
    } catch (err) {
      onError(
        err.response?.data?.detail ||
        err.message ||
        "Upload failed. Is the backend running on http://localhost:8000?"
      );
    }
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  };

  const onInputChange = (e) => {
    const file = e.target.files[0];
    if (file) processFile(file);
  };

  return (
    <div className="upload-page">
      <div className="upload-hero">
        <h1 className="upload-headline">
          Drop your master data.<br />
          <span className="upload-headline-accent">AI does the rest.</span>
        </h1>
        <p className="upload-tagline">
          Excel, CSV or PDF — any language, any column structure.
          Gemini automatically detects the entity, maps columns and validates every value.
        </p>
      </div>

      {/* Drop zone */}
      <div
        className={`drop-zone ${dragging ? "drop-zone--active" : ""}`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls,.csv,.pdf"
          style={{ display: "none" }}
          onChange={onInputChange}
        />
        <div className="drop-zone-icon">
          {dragging ? "📥" : "📂"}
        </div>
        <p className="drop-zone-primary">
          {dragging ? "Release to upload" : "Drag & drop your file here"}
        </p>
        <p className="drop-zone-secondary">or click to browse</p>
        <div className="drop-zone-badges">
          {ACCEPTED.map((ext) => (
            <span key={ext} className="file-badge">{ext}</span>
          ))}
        </div>
      </div>

      {/* What happens next */}
      <div className="pipeline-preview">
        {[
          { step: "01", icon: "⬆", label: "File is parsed",        desc: "Columns & rows extracted" },
          { step: "02", icon: "🔍", label: "Schema detected",       desc: "Gemini embeddings identify the entity type" },
          { step: "03", icon: "🔗", label: "Columns mapped",        desc: "Each header matched to a schema field" },
          { step: "04", icon: "✅", label: "Values validated",      desc: "Dates, phones, booleans normalised" },
        ].map(({ step, icon, label, desc }) => (
          <div key={step} className="pipeline-step">
            <div className="pipeline-num">{step}</div>
            <div className="pipeline-icon">{icon}</div>
            <div className="pipeline-text">
              <strong>{label}</strong>
              <span>{desc}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
