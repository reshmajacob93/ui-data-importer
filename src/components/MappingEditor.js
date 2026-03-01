import React, { useState, useEffect } from "react";
import { analyseData, listSchemas } from "../services/api";
import { validateRows } from "../services/api";

export default function MappingEditor({ parsedFile, detection, onComplete, onError, setStage }) {
  // mapping is { colName: { mapped_field, confidence, field_type, required } }
  const [mapping, setMapping] = useState({});
  const [availableFields, setAvailableFields] = useState([]);
  const [schemaOverride] = useState(detection.detected_schema);
  const [loading, setLoading] = useState(false);

  // Populate mapping from Step 8 result passed down via App → MappingEditor
  // The parent (App.js) calls onConfirm(res.data) which is the /ai/map-columns response
  // That response is passed here as detection's mapping, accessed via parsedFile context
  // We receive mapping data through the detection prop (handled below)
  useEffect(() => {
    // mappingData comes from App's handleMappingConfirmed which stores the /ai/map-columns result
    // App passes it as `detection` but after step 8 detection is still the schema detection result
    // The mapping result is stored separately — we re-fetch it here using the already-detected schema
    // to keep components decoupled. This also lets the user re-trigger if needed.
    fetchMapping();
    fetchSchemaFields();
    // eslint-disable-next-line
  }, []);

  const fetchMapping = async () => {
    // mapping was already fetched in PreviewScreen and passed back via onConfirm
    // onConfirm(res.data) → App stores as `mapping` state → passed here
    // But MappingEditor receives it via a separate prop — let's use the detection prop
    // which App populates correctly. We read from parsedFile columns + detection schema.
    // Actually: App.js calls handleMappingConfirmed(mappingData) which sets mapping state
    // then renders <MappingEditor> — but MappingEditor doesn't receive that mapping prop
    // in the current App.js wiring. The component re-fetches it directly for clarity.
    try {
      const { mapColumns } = await import("../services/api");
      const res = await mapColumns(
        parsedFile.columns,
        parsedFile.preview || [],
        schemaOverride
      );
      const data = res.data;
      setMapping(data.mapping || {});
      setMissingRequired(data.missing_required || []);
      setUnmapped(data.unmapped_columns || []);
    } catch {
      // fallback: build empty mapping
      const empty = {};
      parsedFile.columns.forEach((col) => {
        empty[col] = { mapped_field: null, confidence: 0, field_type: null, required: false };
      });
      setMapping(empty);
    }
  };

  const fetchSchemaFields = async () => {
    try {
      const api = (await import("../services/api")).default;
      const res = await api.get(`/schemas/${schemaOverride}`);
      setAvailableFields(res.data.fields?.map((f) => f.name) || []);
    } catch {
      setAvailableFields([]);
    }
  };

  const [missingRequired, setMissingRequired] = useState([]);
  const [unmapped, setUnmapped] = useState([]);

  const updateField = (col, newField) => {
    setMapping((prev) => ({
      ...prev,
      [col]: { ...prev[col], mapped_field: newField || null },
    }));
  };

  const confidenceColor = (score) =>
    score >= 0.75 ? "var(--green)" :
      score >= 0.5 ? "var(--amber)" :
        "var(--red)";

  const confidenceLabel = (score) =>
    score >= 0.75 ? "High" :
      score >= 0.5 ? "Review" :
        "Low";

  // ── Step 10: POST /ai/analyse ─────────────────────────────────────────────
  const handleValidate = async () => {
    try {
      setLoading(true);
      setStage("rule_check");

      const res = await validateRows(
        parsedFile.preview || [],
        mapping,                        // current mapping the user reviewed
        schemaOverride,
      );

      onComplete(res.data);             // sends to rule_results stage
    } catch (err) {
      onError(err.response?.data?.detail || "Rule validation failed");
    } finally {
      setLoading(false);
    }
  };

  const mappingEntries = Object.entries(mapping);
  const mappedCount = mappingEntries.filter(([, v]) => v.mapped_field).length;

  return (
    <div className="section-wrap">
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">
            <span className="card-icon">🔗</span> AI Column Mapping — Step 3
          </h2>
          <div className="card-meta">
            <span className="meta-pill meta-pill--blue">{schemaOverride}</span>
            <span className="meta-pill">{mappedCount}/{parsedFile.columns.length} mapped</span>
          </div>
        </div>

        {/* Warnings */}
        {missingRequired.length > 0 && (
          <div className="alert alert--warn">
            <strong>⚠ Missing required fields:</strong>{" "}
            {missingRequired.join(", ")}
            <p style={{ margin: "4px 0 0", fontSize: 12 }}>
              These schema fields have no matching column in your file.
              Rows may be rejected at import.
            </p>
          </div>
        )}

        {unmapped.length > 0 && (
          <div className="alert alert--info">
            <strong>ℹ Unmapped columns ({unmapped.length}):</strong>{" "}
            {unmapped.join(", ")}
            <p style={{ margin: "4px 0 0", fontSize: 12 }}>
              These columns could not be matched to any schema field.
              Use the dropdowns below to assign them manually.
            </p>
          </div>
        )}

        {/* Mapping table */}
        <div className="mapping-table-wrap">
          <table className="mapping-table">
            <thead>
              <tr>
                <th>Your Column</th>
                <th>Mapped To</th>
                <th>Confidence</th>
                <th>Field Type</th>
                <th>Required</th>
              </tr>
            </thead>
            <tbody>
              {mappingEntries.map(([col, info]) => {
                const isMapped = !!info.mapped_field;
                const isRequired = info.required;
                const isMissing = isRequired && !isMapped;

                return (
                  <tr
                    key={col}
                    className={isMissing ? "row--error" : isMapped ? "" : "row--warn"}
                  >
                    {/* Column name from file */}
                    <td>
                      <span className="col-name">{col}</span>
                    </td>

                    {/* Editable dropdown */}
                    <td>
                      <select
                        className={`map-select ${!isMapped ? "map-select--empty" : ""}`}
                        value={info.mapped_field || ""}
                        onChange={(e) => updateField(col, e.target.value)}
                      >
                        <option value="">— unmapped —</option>
                        {availableFields.map((f) => (
                          <option key={f} value={f}>{f}</option>
                        ))}
                      </select>
                    </td>

                    {/* Confidence badge */}
                    <td>
                      {isMapped ? (
                        <span
                          className="confidence-pill"
                          style={{
                            background: confidenceColor(info.confidence) + "22",
                            color: confidenceColor(info.confidence),
                            border: `1px solid ${confidenceColor(info.confidence)}44`,
                          }}
                        >
                          {confidenceLabel(info.confidence)} · {(info.confidence * 100).toFixed(0)}%
                        </span>
                      ) : (
                        <span className="confidence-pill" style={{ background: "#f1f5f9", color: "var(--muted)" }}>
                          —
                        </span>
                      )}
                    </td>

                    {/* Field type */}
                    <td>
                      <span className="type-badge">{info.field_type || "—"}</span>
                    </td>

                    {/* Required flag */}
                    <td>
                      {isRequired ? (
                        <span className="req-badge req-badge--yes">Required</span>
                      ) : (
                        <span className="req-badge req-badge--no">Optional</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="mapping-legend">
          <span className="legend-item legend-item--ok">● High confidence (≥75%)</span>
          <span className="legend-item legend-item--warn">● Review needed (50–74%)</span>
          <span className="legend-item legend-item--err">● Low / unmapped (&lt;50%)</span>
        </div>
      </div>

      {/* CTA */}
      <div className="action-row">
        <div className="action-hint">
          Review and correct any low-confidence mappings above, then run validation.
        </div>
        <button
          className="btn-primary btn-primary--green"
          onClick={handleValidate}
          disabled={loading}
        >
          {loading ? (
            <><span className="btn-spinner" /> Validating…</>
          ) : (
            <>⚙ Run Rule Validation →</>
          )}
        </button>
      </div>
    </div>
  );
}
