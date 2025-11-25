// src/components/CaptchaDashboard.jsx
import React, { useState, useEffect } from "react";
import DragDropCaptcha from "./DragDropCaptcha";
import { fetchCaptchaLogs } from "../api";

const TAB_CAPTCHA = "captcha";
const TAB_STATS = "stats";

export default function CaptchaDashboard() {
  const [activeTab, setActiveTab] = useState(TAB_CAPTCHA);

  return (
    <div
      className="captcha-dashboard"
      style={{
        maxWidth: 1200,
        margin: "0 auto",
        padding: "20px 0",
      }}
    >
      {/* Tabs */}
      <div
        className="tabs"
        style={{
          display: "flex",
          gap: 32,
          marginBottom: 20,
          padding: "0 4px",
          borderBottom: "1px solid rgba(0,0,0,0.06)",
        }}
      >
        <button
          type="button"
          onClick={() => setActiveTab(TAB_CAPTCHA)}
          style={{
            padding: "12px 4px",
            border: "none",
            background: "transparent",
            fontWeight: 600,
            fontSize: 14,
            textTransform: "uppercase",
            letterSpacing: "0.5px",
            color:
              activeTab === TAB_CAPTCHA
                ? "#4f46e5"
                : "rgba(0,0,0,0.35)",
            borderBottom:
              activeTab === TAB_CAPTCHA
                ? "3px solid #4f46e5"
                : "3px solid transparent",
            cursor: "pointer",
            transition: "color 0.2s ease, border-bottom 0.2s ease",
          }}
        >
          CAPTCHA
        </button>

        <button
          type="button"
          onClick={() => setActiveTab(TAB_STATS)}
          style={{
            padding: "12px 4px",
            border: "none",
            background: "transparent",
            fontWeight: 600,
            fontSize: 14,
            textTransform: "uppercase",
            letterSpacing: "0.5px",
            color:
              activeTab === TAB_STATS
                ? "#4f46e5"
                : "rgba(0,0,0,0.35)",
            borderBottom:
              activeTab === TAB_STATS
                ? "3px solid #4f46e5"
                : "3px solid transparent",
            cursor: "pointer",
            transition: "color 0.2s ease, border-bottom 0.2s ease",
          }}
        >
          Stats (last 25)
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === TAB_CAPTCHA && <DragDropCaptcha />}
      {activeTab === TAB_STATS && <CaptchaStats />}
    </div>
  );
}

/* -----------------------------------------------
   Stats Component
------------------------------------------------ */

function CaptchaStats() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    const loadLogs = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchCaptchaLogs();
        if (!cancelled) {
          const sorted = [...data].sort(
            (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
          );
          setLogs(sorted.slice(0, 25));
        }
      } catch (err) {
        if (!cancelled) {
          console.error(err);
          setError("Failed to load logs");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadLogs();
    return () => (cancelled = true);
  }, []);

  const summary = logs.reduce(
    (acc, log) => {
      const r = (log.result || "").toLowerCase();
      if (r === "pass") acc.pass++;
      else if (r === "fail") acc.fail++;
      else acc.other++;
      return acc;
    },
    { pass: 0, fail: 0, other: 0 }
  );

  return (
    <div style={{ paddingTop: 10 }}>
      {loading && <div>Loading stats…</div>}
      {error && (
        <div style={{ color: "#b91c1c", marginBottom: 8 }}>{error}</div>
      )}

      {!loading && !error && (
        <>
          {/* Summary Cards */}
          <div
            style={{
              display: "flex",
              gap: 16,
              marginBottom: 16,
              flexWrap: "wrap",
            }}
          >
            <SummaryCard label="Total logs" value={logs.length} />
            <SummaryCard label="Pass" value={summary.pass} />
            <SummaryCard label="Fail" value={summary.fail} />
            <SummaryCard label="Other" value={summary.other} />
          </div>

          {/* Table */}
          <div
            style={{
              maxHeight: 400,
              overflow: "auto",
              border: "1px solid #e5e7eb",
              borderRadius: 8,
            }}
          >
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead
                style={{
                  position: "sticky",
                  top: 0,
                  background: "#f9fafb",
                  zIndex: 1,
                }}
              >
                <tr>
                  <Th>Timestamp</Th>
                  <Th>Challenge ID</Th>
                  <Th>Attempt</Th>
                  <Th>Position Score</Th>
                  <Th>Mouse Score</Th>
                  <Th>Final Score</Th>
                  <Th>Result</Th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log, i) => (
                  <tr
                    key={i}
                    style={{
                      background: i % 2 === 0 ? "#ffffff" : "#f9fafb",
                    }}
                  >
                    <Td>{formatTimestamp(log.timestamp)}</Td>
                    <Td>{log.challenge_id}</Td>
                    <Td>{log.attempt}</Td>
                    <Td>{fmtScore(log.position_score)}</Td>
                    <Td>{fmtScore(log.mouse_score)}</Td>
                    <Td>{fmtScore(log.final_score)}</Td>
                    <Td>
                      <ResultBadge result={log.result} />
                    </Td>
                  </tr>
                ))}

                {logs.length === 0 && (
                  <tr>
                    <Td colSpan={7} style={{ textAlign: "center", padding: 16 }}>
                      No logs available
                    </Td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

/* -----------------------------------------------
   UI Helper Components
------------------------------------------------ */

function SummaryCard({ label, value }) {
  return (
    <div
      style={{
        padding: "8px 12px",
        borderRadius: 8,
        border: "1px solid #e5e7eb",
        minWidth: 120,
      }}
    >
      <div style={{ fontSize: 12, color: "#6b7280" }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 600 }}>{value}</div>
    </div>
  );
}

function Th({ children }) {
  return (
    <th
      style={{
        padding: "8px 12px",
        textAlign: "left",
        borderBottom: "1px solid #e5e7eb",
        fontSize: 13,
        fontWeight: 600,
        color: "#374151",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </th>
  );
}

function Td({ children, colSpan }) {
  return (
    <td
      colSpan={colSpan}
      style={{
        padding: "8px 12px",
        borderBottom: "1px solid #f3f4f6",
      }}
    >
      {children}
    </td>
  );
}

function ResultBadge({ result }) {
  const r = (result || "").toLowerCase();

  let background = "#e5e7eb";
  let color = "#374151";

  if (r === "pass") {
    background = "#dcfce7";
    color = "#166534";
  } else if (r === "fail") {
    background = "#fee2e2";
    color = "#991b1b";
  } else if (r === "dicey" || r === "cant-say") {
    background = "#fef3c7";
    color = "#92400e";
  }

  return (
    <span
      style={{
        padding: "2px 8px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 600,
        background,
        color,
        textTransform: "uppercase",
      }}
    >
      {result}
    </span>
  );
}

/* -----------------------------------------------
   Utility
------------------------------------------------ */

function fmtScore(v) {
  if (v === null || v === undefined || Number.isNaN(Number(v))) return "-";
  return Number(v).toFixed(3);
}

function formatTimestamp(ts) {
  if (!ts) return "-";
  const d = new Date(ts);
  if (isNaN(d.getTime())) return ts;
  return d.toLocaleString();
}