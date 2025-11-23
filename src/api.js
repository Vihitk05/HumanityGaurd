// src/api.js
export const API_BASE = "http://localhost:8000";

async function handleJsonResponse(res) {
  const text = await res.text();
  try { return JSON.parse(text); }
  catch (e) { throw new Error(`Invalid JSON response: ${text}`); }
}

export async function fetchChallenge() {
  const res = await fetch(`${API_BASE}/challenges`, { method: "GET" });
  if (!res.ok) throw new Error(`Failed to fetch challenge (${res.status})`);
  return await handleJsonResponse(res);
}

// Updated verifyChallenge to include mouse events
export async function verifyChallenge(challengeId, tiles, mouse) {
  const payload = { challengeId, tiles, mouse };
  const res = await fetch(`${API_BASE}/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    let body = null;
    try { body = await handleJsonResponse(res); } catch {}
    throw new Error(`Verify request failed (${res.status}) ${body ? JSON.stringify(body) : ""}`);
  }
  return await handleJsonResponse(res);
}

/**
 * Accepts:
 * - raw base64 string
 * - full data:image/... URI
 * returns full data URI or empty string
 */
export function normalizeBase64(s) {
  if (!s) return "";
  if (typeof s !== "string") return "";
  if (s.startsWith("data:")) return s;
  return `data:image/png;base64,${s}`;
}
