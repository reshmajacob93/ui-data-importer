import React, { useEffect, useState } from "react";
import { DataGrid } from "@mui/x-data-grid";
import { mapColumns, listSchemas } from "../services/api";

export default function PreviewScreen({ parsedFile, detection, onConfirm, onError, setStage }) {
  const [schemas, setSchemas]             = useState([]);
  const [schemaOverride, setSchemaOverride] = useState(detection.detected_schema);
  const [loading, setLoading]             = useState(false);

  useEffect(() => {
    listSchemas()
      .then((res) => setSchemas(res.data.schemas || []))
      .catch(() => {});
  }, []);

  const { detected_schema, confidence, all_matches } = detection;

  const confidenceColor =
    confidence >= 0.75 ? "var(--green)" :
    confidence >= 0.5  ? "var(--amber)" :
    "var(--red)";

  // ── Step 8: POST /ai/map-columns ─────────────────────────────────────────
  const handleProceed = async () => {
    try {
      setLoading(true);
      setStage("detecting");
      const res = await mapColumns(
        parsedFile.columns,
        parsedFile.preview || [],
        schemaOverride
      );
      onConfirm(res.data);
    } catch (err) {
      onError(err.response?.data?.detail || "Column mapping failed");
    } finally {
      setLoading(false);
    }
  };

  // MUI DataGrid columns
  const gridColumns = parsedFile.columns.map((col) => ({
    field: col,
    headerName: col,
    width: 180,
    renderCell: (params) => (
      <span style={{ fontSize: 13 }}>
        {params.value === null || params.value === undefined ? (
          <span style={{ color: "var(--muted)" }}>—</span>
        ) : String(params.value)}
      </span>
    ),
  }));

  const gridRows = (parsedFile.preview || []).map((row, i) => ({ id: i, ...row }));

  return (
    <div className="section-wrap">
      {/* Schema detection card */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">
            <span className="card-icon">🔍</span> Schema Detection — Step 2
          </h2>
        </div>

        <div className="detection-row">
          <div className="detection-main">
            <span className="detection-label">Detected entity</span>
            <span className="detection-value">{detected_schema}</span>
            <span
              className="confidence-pill"
              style={{ background: confidenceColor + "22", color: confidenceColor, border: `1px solid ${confidenceColor}44` }}
            >
              {(confidence * 100).toFixed(1)}% confidence
            </span>
          </div>

          <div className="detection-override">
            <label className="field-label">Override schema</label>
            <select
              className="select-input"
              value={schemaOverride}
              onChange={(e) => setSchemaOverride(e.target.value)}
            >
              {schemas.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Other candidates */}
        {all_matches?.length > 1 && (
          <div className="other-matches">
            <span className="field-label">Other candidates:</span>
            <div className="match-chips">
              {all_matches.slice(1).map((m) => (
                <button
                  key={m.schema}
                  className="match-chip"
                  onClick={() => setSchemaOverride(m.schema)}
                  title="Click to use this schema"
                >
                  {m.schema}
                  <span className="match-chip-score">{(m.score * 100).toFixed(0)}%</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* File info card */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">
            <span className="card-icon">📋</span> Parsed File — Step 1 Result
          </h2>
          <div className="card-meta">
            <span className="meta-pill">{parsedFile.file_type}</span>
            <span className="meta-pill">{parsedFile.columns.length} columns</span>
            <span className="meta-pill">{(parsedFile.preview || []).length} preview rows</span>
          </div>
        </div>

        {/* Columns strip */}
        <div className="columns-strip">
          {parsedFile.columns.map((col) => (
            <span key={col} className="col-chip">{col}</span>
          ))}
        </div>

        {/* DataGrid — your original MUI grid preserved */}
        {parsedFile.preview?.length > 0 && (
          <div className="grid-wrap">
            <DataGrid
              rows={gridRows}
              columns={gridColumns}
              autoHeight
              pageSize={10}
              rowsPerPageOptions={[10]}
              disableSelectionOnClick
              sx={{
                border: "1px solid var(--border)",
                borderRadius: "10px",
                fontSize: 13,
                "& .MuiDataGrid-columnHeader": {
                  background: "var(--surface-2)",
                  fontWeight: 700,
                  color: "var(--text-primary)",
                },
                "& .MuiDataGrid-cell": {
                  borderColor: "var(--border)",
                },
              }}
            />
          </div>
        )}
      </div>

      {/* CTA */}
      <div className="action-row">
        <div className="action-hint">
          Confirm the detected schema above, then proceed to AI column mapping.
        </div>
        <button
          className="btn-primary"
          onClick={handleProceed}
          disabled={loading}
        >
          {loading ? (
            <><span className="btn-spinner" /> Mapping columns…</>
          ) : (
            <>Map Columns with AI →</>
          )}
        </button>
      </div>
    </div>
  );
}
