"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertOctagon,
  Ban,
  CheckCircle2,
  Loader2,
  Power,
  Send,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import { useGuardStore } from "@/lib/store";
import { API_BASE, ask, trainBaseline, startMonitor, stopMonitor } from "@/lib/api";

type ChatMsg = { role: "user" | "agent"; text: string };

type Alert = {
  rule: string;
  severity: string;
  score: number | null;
  message: string;
  tool: string | null;
  ts: string;
};

export function LiveOperations() {
  const {
    operationsMode,
    setOperationsMode,
    baselineSealed,
    setBaselineSealed,
    agents,
    selectedAgentId,
    refreshAgents,
  } = useGuardStore();
  const agent = agents.find((a) => a.id === selectedAgentId) ?? agents[0];

  // Chat history is shared across modes so live mode can show real prior activity.
  const [messages, setMessages] = useState<ChatMsg[]>([
    {
      role: "agent",
      text:
        "Sandbox ready. Ask OpsPilot a question — runtime events will appear in the log stream to the left.",
    },
  ]);

  // Surfaces /monitor/start failures (most often "No baseline yet").
  const [monitorError, setMonitorError] = useState<string | null>(null);

  // Latest SECURITY_EVENT observed on the wire — fuels the live-mode alert overlay.
  const [latestAlert, setLatestAlert] = useState<Alert | null>(null);

  // Forces LogStreamMonitor to fully reset on every mode flip.
  const [streamEpoch, setStreamEpoch] = useState(0);

  useEffect(() => {
    setStreamEpoch((n) => n + 1);
    setMonitorError(null);
    setLatestAlert(null);

    if (operationsMode === "live") {
      (async () => {
        try {
          const r = await startMonitor();
          if (r && (r.detail || r.error || r.ok === false)) {
            setMonitorError(String(r.detail || r.error || "monitor failed to start"));
          }
        } catch {
          setMonitorError("Backend unreachable — start the FastAPI server.");
        }
      })();
    } else {
      stopMonitor().catch(() => {});
    }
  }, [operationsMode]);

  return (
    <div className="space-y-4">
      {/* Operational ribbon */}
      <div
        className={
          "flex items-center justify-between rounded-xl border px-5 py-3 shadow-soft transition " +
          (operationsMode === "live"
            ? "border-rose-200 bg-rose-50/60"
            : "border-slate-200 bg-white")
        }
      >
        <div className="flex items-center gap-3">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Target Agent
          </div>
          <div className="text-sm font-semibold text-guardnavy">{agent.name}</div>
          <code className="font-mono text-[11px] text-slate-500">{agent.id}</code>
        </div>
        <ModeToggle value={operationsMode} onChange={setOperationsMode} />
      </div>

      {monitorError && operationsMode === "live" && (
        <MonitorErrorBanner message={monitorError} onDismiss={() => setMonitorError(null)} />
      )}

      <div
        className={
          "grid grid-cols-2 gap-4 rounded-xl p-4 transition " +
          (operationsMode === "live" ? "bg-rose-50/40 ring-1 ring-rose-200" : "bg-transparent")
        }
      >
        <LogStreamMonitor
          key={streamEpoch}
          mode={operationsMode}
          monitorBlocked={!!monitorError}
          latestAlert={latestAlert}
          onAlert={setLatestAlert}
        />
        <SimulationSandbox
          mode={operationsMode}
          sealed={baselineSealed}
          messages={messages}
          setMessages={setMessages}
          onFinishBaseline={async () => {
            const r = await trainBaseline();
            if (r && !r.detail) {
              setBaselineSealed(true);
              await refreshAgents();
            }
          }}
          onResetSeal={() => setBaselineSealed(false)}
          agentName={agent.name}
        />
      </div>
    </div>
  );
}

function MonitorErrorBanner({
  message,
  onDismiss,
}: {
  message: string;
  onDismiss: () => void;
}) {
  const needsBaseline = /no baseline/i.test(message);
  return (
    <div className="flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 shadow-soft">
      <AlertOctagon size={16} className="mt-0.5 text-amber-600" />
      <div className="flex-1 text-[12.5px] text-amber-800">
        <div className="font-semibold">Live monitor could not start</div>
        <div className="mt-0.5">{message}</div>
        {needsBaseline && (
          <div className="mt-1 text-amber-700">
            Switch back to <span className="font-semibold">BASELINE</span> mode, send a few queries
            to OpsPilot, then click <span className="font-semibold">Finish Baselining</span> to seal
            a baseline. Then switch to LIVE again.
          </div>
        )}
      </div>
      <button onClick={onDismiss} className="text-amber-600 hover:text-amber-800" aria-label="dismiss">
        ×
      </button>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Mode toggle                                                                */
/* -------------------------------------------------------------------------- */
function ModeToggle({
  value,
  onChange,
}: {
  value: "baseline" | "live";
  onChange: (m: "baseline" | "live") => void;
}) {
  return (
    <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white p-1 shadow-soft">
      <ModeButton
        active={value === "baseline"}
        onClick={() => onChange("baseline")}
        color="blue"
        icon={<span className="h-2 w-2 rounded-full bg-guardblue pulse-dot" />}
        label="MODE: BASELINE"
      />
      <ModeButton
        active={value === "live"}
        onClick={() => onChange("live")}
        color="emerald"
        icon={<ShieldCheck size={14} />}
        label="MODE: LIVE"
      />
    </div>
  );
}

function ModeButton({
  active,
  onClick,
  color,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  color: "blue" | "emerald";
  icon: React.ReactNode;
  label: string;
}) {
  const activeColor =
    color === "blue"
      ? "bg-guardblue text-white shadow-soft"
      : "bg-emerald-600 text-white shadow-soft";
  return (
    <button
      onClick={onClick}
      className={
        "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold tracking-wider transition " +
        (active ? activeColor : "text-slate-500 hover:bg-slate-100")
      }
    >
      {icon}
      {label}
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/* Log Stream Monitor — tails the real backend /logs/stream                   */
/* -------------------------------------------------------------------------- */
function LogStreamMonitor({
  mode,
  monitorBlocked,
  latestAlert,
  onAlert,
}: {
  mode: "baseline" | "live";
  monitorBlocked: boolean;
  latestAlert: Alert | null;
  onAlert: (a: Alert) => void;
}) {
  const [lines, setLines] = useState<{ text: string; tone: "info" | "warn" | "alert" }[]>([]);
  const [connected, setConnected] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Tail from end so we only see events from *now*. Reconnects on every mode change.
  useEffect(() => {
    setLines([]);
    setConnected(false);
    const controller = new AbortController();
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/logs/stream`, { signal: controller.signal });
        if (!res.body) return;
        setConnected(true);
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split("\n");
          buffer = parts.pop() ?? "";
          for (const raw of parts) {
            if (!raw.trim()) continue;
            try {
              const ev = JSON.parse(raw);
              const formatted = formatEvent(ev);
              setLines((prev) => [...prev.slice(-200), formatted]);
              if (ev.event === "SECURITY_EVENT") {
                onAlert({
                  rule: ev.risk?.rule ?? "unknown_rule",
                  severity: ev.risk?.severity ?? "high",
                  score: ev.risk?.score ?? null,
                  message: ev.message ?? "Unauthorized behavior detected.",
                  tool: ev.tool ?? null,
                  ts: ev.ts ?? "",
                });
              }
            } catch {
              /* swallow malformed line */
            }
          }
        }
      } catch (err: any) {
        if (err?.name !== "AbortError") setConnected(false);
      }
    })();
    return () => controller.abort();
  }, [mode, onAlert]);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [lines]);

  return (
    <div className="relative flex h-[calc(100vh-220px)] flex-col overflow-hidden rounded-xl border border-slate-800 bg-guardink shadow-soft">
      <div className="flex items-center justify-between border-b border-slate-800 bg-black/30 px-4 py-2">
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-slate-300">
          <Power size={12} className={mode === "live" ? "text-emerald-400" : "text-guardblue"} />
          LOG STREAM MONITOR
        </div>
        <div className="flex items-center gap-2 text-[10px] text-slate-500">
          <span
            className={
              "inline-block h-1.5 w-1.5 rounded-full " +
              (connected ? "bg-emerald-400 pulse-dot" : "bg-rose-500")
            }
          />
          {connected ? "tailing /logs/stream · new events only" : "backend offline"}
        </div>
      </div>

      <div
        ref={containerRef}
        className="term-scroll flex-1 overflow-y-auto p-4 font-mono text-[12px] leading-6"
      >
        {lines.length === 0 ? (
          <div className="text-slate-500">
            {connected
              ? mode === "live"
                ? "Live enforcement engaged. Awaiting new runtime events…"
                : "Waiting for events… interact with OpsPilot to populate the log stream."
              : "Backend unreachable — start the FastAPI server at " + API_BASE}
          </div>
        ) : (
          lines.map((l, i) => (
            <div
              key={i}
              className={
                l.tone === "alert"
                  ? "text-rose-400"
                  : l.tone === "warn"
                  ? "text-amber-300"
                  : "text-emerald-300"
              }
            >
              {l.text}
            </div>
          ))
        )}
        {connected && (
          <div className="text-emerald-400">
            <span className="stream-cursor">▍</span>
          </div>
        )}
      </div>

      {mode === "live" && latestAlert && !monitorBlocked && (
        <CriticalAlertOverlay alert={latestAlert} onDismiss={() => onAlert(null as any)} />
      )}
    </div>
  );
}

function formatEvent(ev: any): { text: string; tone: "info" | "warn" | "alert" } {
  const ts = (ev.ts ?? "").slice(11, 19) || "--:--:--";
  const event = ev.event ?? "?";
  const tool = ev.tool ? ` tool=${ev.tool}` : "";
  const msg = ev.message ? ` ${String(ev.message).slice(0, 140)}` : "";
  const score = ev.risk?.score != null ? ` score=${ev.risk.score}` : "";
  const text = `[${ts}] ${event}${tool}${score}${msg}`;
  if (event === "SECURITY_EVENT" || event === "TOOL_UNKNOWN") return { text, tone: "alert" };
  if (event === "DB_FALLBACK" || event === "MONITOR" || event === "BASELINE")
    return { text, tone: "warn" };
  return { text, tone: "info" };
}

function CriticalAlertOverlay({ alert, onDismiss }: { alert: Alert; onDismiss: () => void }) {
  return (
    <div className="pointer-events-none absolute inset-x-4 bottom-4 top-16 flex flex-col">
      <div className="pointer-events-auto rounded-xl border-2 border-rose-500 bg-rose-950/95 shadow-2xl">
        <div className="flex items-center justify-between border-b border-rose-700 bg-rose-700 px-4 py-2 text-white">
          <div className="flex items-center gap-2">
            <AlertOctagon size={16} />
            <span className="text-sm font-bold tracking-wide">
              ALERT: PROHIBITED RUNTIME BEHAVIOR BLOCKED
            </span>
          </div>
          <button onClick={onDismiss} className="text-rose-100 hover:text-white" aria-label="dismiss">
            ×
          </button>
        </div>
        <div className="space-y-3 p-4 font-mono text-[12px] text-rose-50">
          <div className="text-[10px] font-semibold uppercase tracking-widest text-rose-200">
            Forensic Trace · GuardBot
          </div>
          <div className="rounded-md bg-black/40 p-3 leading-6 text-rose-100">
            {alert.message}
          </div>
          <div className="grid grid-cols-2 gap-2 text-[11px] text-rose-200">
            <div>
              <span className="text-rose-400">rule</span> = {alert.rule}
            </div>
            <div>
              <span className="text-rose-400">severity</span> = {alert.severity}
            </div>
            {alert.tool && (
              <div>
                <span className="text-rose-400">tool</span> = {alert.tool}
              </div>
            )}
            {alert.score != null && (
              <div>
                <span className="text-rose-400">score</span> = {alert.score}
              </div>
            )}
            {alert.ts && (
              <div className="col-span-2">
                <span className="text-rose-400">ts</span> = {alert.ts}
              </div>
            )}
          </div>
          <div className="flex items-center justify-between border-t border-rose-700/60 pt-2 text-[11px] text-rose-200">
            <span>raised by /monitor</span>
            <span className="font-semibold text-rose-100">RUNTIME GOVERNANCE INTERCEPT</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Simulation Sandbox — real /ask in both modes (input disabled in live)      */
/* -------------------------------------------------------------------------- */
function SimulationSandbox({
  mode,
  sealed,
  messages,
  setMessages,
  onFinishBaseline,
  onResetSeal,
  agentName,
}: {
  mode: "baseline" | "live";
  sealed: boolean;
  messages: ChatMsg[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMsg[]>>;
  onFinishBaseline: () => Promise<void>;
  onResetSeal: () => void;
  agentName: string;
}) {
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [sealing, setSealing] = useState(false);

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", text }]);
    setBusy(true);
    try {
      const result = await ask(text);
      const answer = result?.answer ?? result?.detail ?? result?.error ?? "(no answer returned)";
      setMessages((prev) => [...prev, { role: "agent", text: String(answer) }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "agent", text: "Error: backend unreachable. Start the FastAPI server." },
      ]);
    } finally {
      setBusy(false);
    }
  }

  async function finish() {
    setSealing(true);
    try {
      await onFinishBaseline();
    } finally {
      setSealing(false);
    }
  }

  return (
    <div
      className={
        "relative flex h-[calc(100vh-220px)] flex-col overflow-hidden rounded-xl border bg-white shadow-soft " +
        (mode === "live" ? "border-rose-300" : "border-slate-200")
      }
    >
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2">
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-slate-600">
          <ShieldAlert size={12} className={mode === "live" ? "text-rose-500" : "text-guardblue"} />
          Simulation Sandbox
        </div>
        <div className="text-[10px] text-slate-400">
          {mode === "live" ? "enforcement on" : "discovery mode"}
        </div>
      </div>

      <div className="term-scroll flex-1 space-y-2 overflow-y-auto px-4 py-3 text-sm">
        {messages.map((m, i) => (
          <div
            key={i}
            className={
              "max-w-[85%] rounded-lg px-3 py-2 text-[13px] leading-5 " +
              (m.role === "user"
                ? "ml-auto bg-guardblue text-white"
                : "mr-auto bg-slate-100 text-slate-800")
            }
          >
            {m.text}
          </div>
        ))}
        {busy && (
          <div className="mr-auto flex max-w-[85%] items-center gap-2 rounded-lg bg-slate-100 px-3 py-2 text-[12px] text-slate-500">
            <Loader2 size={12} className="animate-spin" /> OpsPilot is reasoning…
          </div>
        )}
      </div>

      <div className="border-t border-slate-200 px-3 py-3">
        <div className="flex items-center gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder={
              mode === "live"
                ? "Send a request — GuardBot is monitoring every step…"
                : "Ask OpsPilot…"
            }
            disabled={busy}
            className={
              "flex-1 rounded-md border px-3 py-2 text-sm outline-none disabled:bg-slate-50 disabled:text-slate-400 " +
              (mode === "live"
                ? "border-rose-300 focus:border-rose-500"
                : "border-slate-300 focus:border-guardblue")
            }
          />
          <button
            onClick={send}
            disabled={busy || !input.trim()}
            className={
              "flex items-center gap-1 rounded-md px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 " +
              (mode === "live"
                ? "bg-rose-600 hover:bg-rose-700"
                : "bg-guardblue hover:bg-guardblueDark")
            }
          >
            <Send size={14} /> Send
          </button>
          {mode === "baseline" && (
            <button
              onClick={finish}
              disabled={sealing}
              className="flex items-center gap-1 rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
            >
              {sealing ? <Loader2 size={12} className="animate-spin" /> : null}
              Finish Baselining
            </button>
          )}
        </div>
        {mode === "live" && (
          <div className="mt-2 flex items-center gap-1.5 text-[11px] text-rose-700">
            <Ban size={11} />
            <span>
              ENFORCEMENT ON · prompts go to OpsPilot; GuardBot will raise a SECURITY_EVENT if
              anything strays from baseline.
            </span>
          </div>
        )}
      </div>

      {mode === "baseline" && sealed && (
        <SealToast agentName={agentName} onClose={onResetSeal} />
      )}
    </div>
  );
}

function SealToast({ agentName, onClose }: { agentName: string; onClose: () => void }) {
  return (
    <div className="absolute bottom-4 right-4 flex max-w-sm items-start gap-3 rounded-lg border border-emerald-300 bg-white px-4 py-3 shadow-2xl">
      <div className="mt-0.5 text-emerald-600">
        <CheckCircle2 size={20} />
      </div>
      <div className="flex-1">
        <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
          Baseline Successfully Compiled and Sealed
        </div>
        <div className="mt-0.5 text-[12px] text-slate-700">
          Baseline for <span className="font-semibold">{agentName}</span> persisted to{" "}
          <code className="font-mono">baseline/baseline.json</code> and activated for live enforcement.
        </div>
      </div>
      <button
        onClick={onClose}
        className="text-slate-400 hover:text-slate-600"
        aria-label="dismiss"
      >
        ×
      </button>
    </div>
  );
}
