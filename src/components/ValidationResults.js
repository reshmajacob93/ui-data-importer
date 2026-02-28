import React, { useState } from "react";

export default function ValidationResults({ dbOutput, schemaName, onReset }) {
  const [activeTab, setActiveTab] = useState("valid");

  const { valid_records, invalid_records, summary } = dbOutput;

  const handleExport = () => {
    const records = valid_records.map((r) => r.db_record);
    const blob = new Blob([JSON.stringify(records, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${schemaName}_import_ready.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const validPct = summary.total > 0
    ? Math.round((summary.valid / summary.total) * 100)
    : 0;

  return (
    <div className="section-wrap">
      {/* Summary banner */}
      <div className="card results-summary">
        <div className="summary-header">
          <div>
            <h2 className="card-title">
              <span className="card-icon">📦</span> Validation Results — Step 4
            </h2>
            <p className="summary-sub">Schema: <strong>{schemaName}</strong></p>
          </div>
          <div className="summary-actions">
            <button className="btn-primary btn-primary--green" onClick={handleExport}>
              ⬇ Export Valid Records
            </button>
            <button className="btn-ghost" onClick={onReset}>
              Import Another File
            </button>
          </div>
        </div>

        <div className="summary-stats">
          <StatCard label="Total Rows"      value={summary.total}           color="var(--text-primary)" />
          <StatCard label="✅ Valid"         value={summary.valid}           color="var(--green)" />
          <StatCard label="⚠ Needs Review"  value={summary.invalid}         color="var(--red)" />
          <StatCard label="Pass Rate"        value={`${validPct}%`}          color="var(--accent)" />
        </div>

        {/* Progress bar */}
        <div className="progress-bar-wrap">
          <div
            className="progress-bar-fill"
            style={{ width: `${validPct}%`, background: validPct >= 80 ? "var(--green)" : validPct >= 50 ? "var(--amber)" : "var(--red)" }}
          />
        </div>
        <p className="progress-label">{validPct}% rows ready for database import</p>
      </div>

      {/* Tabs */}
      <div className="card">
        <div className="tab-bar">
          <button
            className={`tab-btn ${activeTab === "valid" ? "tab-btn--active" : ""}`}
            onClick={() => setActiveTab("valid")}
          >
            ✅ Valid Records
            <span className="tab-count tab-count--green">{summary.valid}</span>
          </button>
          <button
            className={`tab-btn ${activeTab === "invalid" ? "tab-btn--active" : ""}`}
            onClick={() => setActiveTab("invalid")}
          >
            ⚠ Needs Review
            <span className="tab-count tab-count--red">{summary.invalid}</span>
          </button>
        </div>

        {/* Valid records table */}
        {activeTab === "valid" && (
          <RecordsTable
            records={valid_records}
            emptyMsg="No valid records — all rows had errors."
            rowClass="row--valid"
          />
        )}

        {/* Invalid records with issues */}
        {activeTab === "invalid" && (
          <InvalidTable records={invalid_records} />
        )}
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ label, value, color }) {
  return (
    <div className="stat-card">
      <div className="stat-value" style={{ color }}>{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

function RecordsTable({ records, emptyMsg }) {
  if (!records || records.length === 0) {
    return <p className="empty-msg">{emptyMsg}</p>;
  }

  const fields = Object.keys(records[0].db_record);

  return (
    <div className="results-table-wrap">
      <table className="results-table">
        <thead>
          <tr>
            <th>#</th>
            {fields.map((f) => <th key={f}>{f}</th>)}
          </tr>
        </thead>
        <tbody>
          {records.slice(0, 20).map((r, i) => (
            <tr key={r.row_index}>
              <td className="row-num">{r.row_index + 1}</td>
              {fields.map((f) => (
                <td key={f}>
                  {r.db_record[f] === null || r.db_record[f] === undefined
                    ? <span className="null-val">null</span>
                    : String(r.db_record[f])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {records.length > 20 && (
        <p className="table-footnote">Showing first 20 of {records.length} valid records.</p>
      )}
    </div>
  );
}

function InvalidTable({ records }) {
  const [expanded, setExpanded] = useState(null);

  if (!records || records.length === 0) {
    return <p className="empty-msg">🎉 All rows passed validation!</p>;
  }

  return (
    <div className="invalid-list">
      {records.slice(0, 30).map((r) => {
        const isOpen = expanded === r.row_index;
        const hasErrors = r.errors?.length > 0;
        const hasFieldIssues = Object.keys(r.field_issues || {}).length > 0;

        return (
          <div
            key={r.row_index}
            className={`invalid-row ${isOpen ? "invalid-row--open" : ""}`}
          >
            {/* Row header */}
            <div
              className="invalid-row-header"
              onClick={() => setExpanded(isOpen ? null : r.row_index)}
            >
              <span className="invalid-row-num">Row {r.row_index + 1}</span>

              {/* Error pills preview */}
              <div className="invalid-pills">
                {r.errors?.slice(0, 2).map((e, i) => (
                  <span key={i} className="error-pill">{e}</span>
                ))}
                {Object.keys(r.field_issues || {}).slice(0, 2).map((f) => (
                  <span key={f} className="warn-pill">{f}</span>
                ))}
              </div>

              <span className="expand-icon">{isOpen ? "▲" : "▼"}</span>
            </div>

            {/* Expanded detail */}
            {isOpen && (
              <div className="invalid-row-detail">
                {hasErrors && (
                  <div className="detail-section">
                    <strong className="detail-heading">Row Errors</strong>
                    {r.errors.map((e, i) => (
                      <p key={i} className="detail-error">⛔ {e}</p>
                    ))}
                  </div>
                )}

                {hasFieldIssues && (
                  <div className="detail-section">
                    <strong className="detail-heading">Field Issues</strong>
                    {Object.entries(r.field_issues).map(([field, issues]) => (
                      <div key={field} className="field-issue-row">
                        <span className="field-issue-name">{field}</span>
                        <span className="field-issue-text">{issues.join("; ")}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="detail-section">
                  <strong className="detail-heading">Raw Values</strong>
                  <div className="raw-values-grid">
                    {Object.entries(r.raw_row || {}).map(([k, v]) => (
                      <div key={k} className="raw-val-item">
                        <span className="raw-val-key">{k}</span>
                        <span className="raw-val-val">{v === null || v === undefined ? "—" : String(v)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
      {records.length > 30 && (
        <p className="table-footnote">Showing first 30 of {records.length} rows needing review.</p>
      )}
    </div>
  );
}
