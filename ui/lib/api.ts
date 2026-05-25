/** Lightweight client for the FastAPI backend. Safe to call from the browser. */
export const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

export async function ask(message: string, sessionId?: string) {
  const res = await fetch(`${API_BASE}/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, session_id: sessionId }),
  });
  return res.json();
}

export async function trainBaseline() {
  const res = await fetch(`${API_BASE}/baseline/train`, { method: "POST" });
  return res.json();
}

export async function startMonitor() {
  const res = await fetch(`${API_BASE}/monitor/start`, { method: "POST" });
  return res.json();
}

export async function stopMonitor() {
  const res = await fetch(`${API_BASE}/monitor/stop`, { method: "POST" });
  return res.json();
}

export async function monitorStatus() {
  const res = await fetch(`${API_BASE}/monitor/status`);
  return res.json();
}

export async function fetchAgents() {
  try {
    const res = await fetch(`${API_BASE}/agents`);
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function fetchIncidents(limit = 100) {
  try {
    const res = await fetch(`${API_BASE}/incidents?limit=${limit}`);
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}
