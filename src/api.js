// src/api.js
const BASE_URL = 'http://localhost:8000';

export async function fetchChallenge() {
  const res = await fetch(`${BASE_URL}/challenges`);
  if (!res.ok) throw new Error('Failed to fetch challenge');
  return res.json();
}

export async function verifyChallenge(challengeId, tiles) {
  const res = await fetch(`${BASE_URL}/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ challengeId, tiles })
  });
  if (!res.ok) throw new Error('Failed to verify challenge');
  return res.json();
}

export function normalizeBase64(str) {
  return str ? `data:image/png;base64,${str}` : '';
}
