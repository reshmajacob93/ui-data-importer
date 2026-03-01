import React, { useState } from "react";
import { analyseData } from "../services/api";

export default function RuleValidationResults({
    ruleOutput, parsedFile, detection, onSendToAI, onReset, setStage,
}) {
    const [loading, setLoading] = useState(false);
    const { clean_rows, suspicious_rows, duplicate_rows, empty_rows, summary } = ruleOutput;
    const [activeTab, setActiveTab] = useState("clean");

    // Send only suspicious rows to Gemini AI
    const handleSendToAI = async () => {
        try {
            setLoading(true);
            setStage("validating");

            const suspiciousRawRows = suspicious_rows.map(r => r.normalized_row);

            const res = await analyseData(
                Object.keys(suspiciousRawRows[0] || {}),
                suspiciousRawRows,
                detection?.detected_schema,
                true,
            );

            onSendToAI(res.data.db_output);
        } catch (err) {
            setStage("rule_results");
            alert("AI validation failed: " + (err.response?.data?.detail || err.message));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="section-wrap">

            {/* Summary card */}
            <div className="card results-summary">
                <div className="summary-header">
                    <div>
                        <h2 className="card-title">
                            <span className="card-icon">⚙</span> Rule Validation — Step 4
                        </h2>
                        <p className="summary-sub">
                            No AI used. Clean rows go straight to DB.
                            Only suspicious rows need AI review.
                        </p>
                    </div>
                    <div className="summary-actions">
                        {suspicious_rows.length > 0 && (
                            <button
                                className="btn-primary"
                                onClick={handleSendToAI}
                                disabled={loading}
                            >
                                {loading
                                    ? <><span className="btn-spinner" /> Sending to AI…</>
                                    : <>🤖 Fix {suspicious_rows.length} Suspicious with AI →</>
                                }
                            </button>
                        )}
                        <button className="btn-ghost" onClick={onReset}>
                            Start Over
                        </button>
                    </div>
                </div>

                {/* Stat cards */}
                <div className="summary-stats">
                    <StatCard label="Total Rows" value={summary.total} color="var(--text-primary)" />
                    <StatCard label="✅ Clean" value={summary.clean} color="var(--green)" />
                    <StatCard label="⚠ Suspicious" value={summary.suspicious} color="var(--amber)" />
                    <StatCard label="🔁 Duplicates" value={summary.duplicates} color="var(--red)" />
                    <StatCard label="Clean Rate" value={`${summary.clean_rate}%`} color="var(--accent)" />
                </div>

                {/* Progress bar */}
                <div className="progress-bar-wrap">
                    <div
                        className="progress-bar-fill"
                        style={{
                            width: `${summary.clean_rate}%`,
                            background: summary.clean_rate >= 80
                                ? "var(--green)" : summary.clean_rate >= 50
                                    ? "var(--amber)" : "var(--red)",
                        }}
                    />
                </div>
                <p className="progress-label">{summary.clean_rate}% rows passed all rules</p>
            </div>

            {/* Tabs */}
            <div className="card">
                <div className="tab-bar">
                    {[
                        { key: "clean", label: "✅ Clean", count: summary.clean, color: "green" },
                        { key: "suspicious", label: "⚠ Suspicious", count: summary.suspicious, color: "red" },
                        { key: "duplicates", label: "🔁 Duplicates", count: summary.duplicates, color: "red" },
                        { key: "empty", label: "○ Empty", count: empty_rows.length, color: "red" },
                    ].map(tab => (
                        <button
                            key={tab.key}
                            className={`tab-btn ${activeTab === tab.key ? "tab-btn--active" : ""}`}
                            onClick={() => setActiveTab(tab.key)}
                        >
                            {tab.label}
                            <span className={`tab-count tab-count--${tab.color}`}>{tab.count}</span>
                        </button>
                    ))}
                </div>

                {/* Clean rows */}
                {activeTab === "clean" && (
                    <RowTable
                        rows={clean_rows}
                        emptyMsg="No clean rows — all rows had issues."
                    />
                )}

                {/* Suspicious rows with issues */}
                {activeTab === "suspicious" && (
                    <IssueList
                        rows={suspicious_rows}
                        emptyMsg="🎉 No suspicious rows found!"
                    />
                )}

                {/* Duplicate rows */}
                {activeTab === "duplicates" && (
                    <IssueList
                        rows={duplicate_rows}
                        emptyMsg="No duplicates found."
                    />
                )}

                {/* Empty rows */}
                {activeTab === "empty" && (
                    <p className="empty-msg">
                        {empty_rows.length === 0
                            ? "No empty rows."
                            : `${empty_rows.length} completely empty row(s) will be skipped.`}
                    </p>
                )}
            </div>
        </div>
    );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({ label, value, color }) {
    return (
        <div className="stat-card">
            <div className="stat-value" style={{ color }}>{value}</div>
            <div className="stat-label">{label}</div>
        </div>
    );
}

function RowTable({ rows, emptyMsg }) {
    if (!rows || rows.length === 0) return <p className="empty-msg">{emptyMsg}</p>;
    const fields = Object.keys(rows[0].normalized_row || {});
    return (
        <div className="results-table-wrap">
            <table className="results-table">
                <thead>
                    <tr>
                        <th>#</th>
                        {fields.map(f => <th key={f}>{f}</th>)}
                    </tr>
                </thead>
                <tbody>
                    {rows.slice(0, 20).map(r => (
                        <tr key={r.row_index}>
                            <td className="row-num">{r.row_index + 1}</td>
                            {fields.map(f => (
                                <td key={f}>
                                    {r.normalized_row[f] == null
                                        ? <span className="null-val">null</span>
                                        : String(r.normalized_row[f])}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
            {rows.length > 20 && (
                <p className="table-footnote">Showing first 20 of {rows.length} rows.</p>
            )}
        </div>
    );
}

function IssueList({ rows, emptyMsg }) {
    const [expanded, setExpanded] = useState(null);
    if (!rows || rows.length === 0) return <p className="empty-msg">{emptyMsg}</p>;
    return (
        <div className="invalid-list">
            {rows.map(r => {
                const isOpen = expanded === r.row_index;
                return (
                    <div key={r.row_index} className={`invalid-row ${isOpen ? "invalid-row--open" : ""}`}>
                        <div
                            className="invalid-row-header"
                            onClick={() => setExpanded(isOpen ? null : r.row_index)}
                        >
                            <span className="invalid-row-num">Row {r.row_index + 1}</span>
                            <div className="invalid-pills">
                                {r.issues?.slice(0, 3).map((issue, i) => (
                                    <span key={i} className="warn-pill">{issue}</span>
                                ))}
                            </div>
                            <span className="expand-icon">{isOpen ? "▲" : "▼"}</span>
                        </div>

                        {isOpen && (
                            <div className="invalid-row-detail">
                                <div className="detail-section">
                                    <strong className="detail-heading">Issues Found</strong>
                                    {r.issues?.map((issue, i) => (
                                        <p key={i} className="detail-error">⛔ {issue}</p>
                                    ))}
                                </div>
                                <div className="detail-section">
                                    <strong className="detail-heading">Normalised Values</strong>
                                    <div className="raw-values-grid">
                                        {Object.entries(r.normalized_row || {}).map(([k, v]) => (
                                            <div key={k} className="raw-val-item">
                                                <span className="raw-val-key">{k}</span>
                                                <span className="raw-val-val">
                                                    {v == null ? "—" : String(v)}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}