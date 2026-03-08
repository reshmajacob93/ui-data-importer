import React, { useState, useEffect } from "react";
import { validateRows } from "../services/api";

export default function MappingEditor({ parsedFile, detection, mappingData, onComplete, onError, setStage }) {
  const [mapping, setMapping] = useState({});
  const [availableFields, setAvailableFields] = useState([]);
  const [schemaOverride] = useState(detection.detected_schema);
  const [loading, setLoading] = useState(false);
  const [missingRequired, setMissingRequired] = useState([]);
  const [unmapped, setUnmapped] = useState([]);

  useEffect(() => {
    // FIX: Use mappingData passed from App.js directly
    // Previously this component was re-fetching /ai/map-columns which was
    // failing silently → catch block → all mapped_field = null → cleanMapping = {} → empty rows
    if (mappingData && mappingData.mapping) {
      setMapping(mappingData.mapping || {});
      setMissingRequired(mappingData.missing_required || []);
      setUnmapped(mappingData.unmapped_columns || []);
    }

    fetchSchemaFields();
    // eslint-disable-next-line
  }, [mappingData]);

  const fetchSchemaFields = async () => {
    try {
      const api = (await import("../services/api")).default;
      const res = await api.get(`/schemas/${schemaOverride}`);
      setAvailableFields(res.data.fields?.map((f) => f.name) || []);
    } catch {
      setAvailableFields([]);
    }
  };

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

  // ── POST /validate ────────────────────────────────────────────────────────
  const handleValidate = async () => {
    try {
      setLoading(true);
      setStage("rule_check");

      // Only send columns that have a mapped_field — skip unmapped ones
      const cleanMapping = {};
      Object.entries(mapping).forEach(([excelCol, info]) => {
        if (info.mapped_field) {
          cleanMapping[excelCol] = info;
        }
      });

      // Safety guard — should never happen now but just in case
      if (Object.keys(cleanMapping).length === 0) {
        onError("No mapped columns found. Please try again.");
        setStage("mapping");
        return;
      }

      console.log("POST /validate — mapping keys:", Object.keys(cleanMapping));
      console.log("POST /validate — row[0] keys :", Object.keys(parsedFile.preview?.[0] || {}));

      const res = await validateRows(
        parsedFile.preview || [],
        cleanMapping,
        schemaOverride,
      );

      onComplete(res.data);
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
                const isMapped   = !!info.mapped_field;
                const isRequired = info.required;
                const isMissing  = isRequired && !isMapped;

                return (
                  <tr
                    key={col}
                    className={isMissing ? "row--error" : isMapped ? "" : "row--warn"}
                  >
                    <td><span className="col-name">{col}</span></td>
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
                    <td><span className="type-badge">{info.field_type || "—"}</span></td>
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

      <div className="action-row">
        <div className="action-hint">
          Review and correct any low-confidence mappings above, then run validation.
        </div>
        <button
          className="btn-primary btn-primary--green"
          onClick={handleValidate}
          disabled={loading || mappedCount === 0}
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
