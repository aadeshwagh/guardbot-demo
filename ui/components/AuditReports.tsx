"use client";

import { useState } from "react";
import { Brain, Filter, Loader2, RefreshCw, Search, ShieldCheck, X } from "lucide-react";
import { useGuardStore } from "@/lib/store";
import type { Incident, Severity } from "@/lib/mockData";

export function AuditReports() {
  const {
    incidents,
    incidentsLoading,
    refreshIncidents,
    selectedIncidentId,
    setSelectedIncidentId,
  } = useGuardStore();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(true);

  const filtered = incidents.filter((i) => {
    const blob = (
      i.agentId +
      " " +
      i.type +
      " " +
      i.guardrail +
      " " +
      i.action +
      " " +
      i.id
    ).toLowerCase();
    return blob.includes(q.toLowerCase());
  });

  const selected = incidents.find((i) => i.id === selectedIncidentId) ?? null;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-soft">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-base font-semibold text-guardnavy">SECURITY INCIDENT REPORTS</h1>
            <p className="text-xs text-slate-500">
              {filtered.length} of {incidents.length} incidents · derived live from{" "}
              <code className="font-mono">logs/guardbot.log</code>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 rounded-md border border-slate-300 px-3 py-1.5">
              <Search size={14} className="text-slate-400" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Filter by agent, rule, action..."
                className="w-56 bg-transparent text-sm outline-none placeholder:text-slate-400"
              />
            </div>
            <button className="flex items-center gap-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50">
              <Filter size={14} /> Filter
            </button>
            <button
              onClick={() => refreshIncidents()}
              disabled={incidentsLoading}
              className="flex items-center gap-1 rounded-md bg-guardblue px-3 py-1.5 text-sm font-semibold text-white hover:bg-guardblueDark disabled:opacity-60"
            >
              {incidentsLoading ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <RefreshCw size={14} />
              )}
              Refresh
            </button>
          </div>
        </div>

        <div className="mt-4 overflow-hidden rounded-lg border border-slate-200">
          {incidents.length === 0 ? (
            <EmptyState loading={incidentsLoading} />
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  <th className="px-4 py-2.5">Timestamp</th>
                  <th className="px-4 py-2.5">Agent ID</th>
                  <th className="px-4 py-2.5">Severity</th>
                  <th className="px-4 py-2.5">Incident Type</th>
                  <th className="px-4 py-2.5">Guardrail Violated</th>
                  <th className="px-4 py-2.5">Action Taken</th>
                  <th className="px-4 py-2.5">Review Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-slate-700">
                {filtered.map((i) => {
                  const active = i.id === selectedIncidentId;
                  return (
                    <tr
                      key={i.id}
                      onClick={() => {
                        setSelectedIncidentId(i.id);
                        setOpen(true);
                      }}
                      className={
                        "cursor-pointer transition " +
                        (active ? "bg-blue-50/70" : "hover:bg-slate-50")
                      }
                    >
                      <td className="px-4 py-2.5 font-mono text-[12px] text-slate-600">{i.ts}</td>
                      <td className="px-4 py-2.5 font-medium text-guardnavy">{i.agentId}</td>
                      <td className="px-4 py-2.5">
                        <SeverityPill severity={i.severity} />
                      </td>
                      <td className="px-4 py-2.5">{i.type}</td>
                      <td className="px-4 py-2.5 font-mono text-[12px] text-slate-600">
                        {i.guardrail}
                      </td>
                      <td className="px-4 py-2.5 text-slate-600">{i.action}</td>
                      <td className="px-4 py-2.5">
                        <ReviewBadge status={i.reviewStatus} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {selected && open && <ForensicSlideOut incident={selected} onClose={() => setOpen(false)} />}
    </div>
  );
}

function EmptyState({ loading }: { loading: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
      <ShieldCheck size={28} className="text-emerald-500" />
      <div className="text-sm font-semibold text-slate-700">
        {loading ? "Reading log file…" : "No incidents recorded yet."}
      </div>
      <div className="max-w-md text-xs text-slate-500">
        Incidents appear once Guard Bot raises a <code className="font-mono">SECURITY_EVENT</code>{" "}
        while the live monitor is running. Train a baseline, switch the Operations toggle to{" "}
        <span className="font-semibold">LIVE</span>, and send a malicious prompt — refresh this
        page to see it logged.
      </div>
    </div>
  );
}

function SeverityPill({ severity }: { severity: Severity }) {
  const map = {
    critical: { bg: "bg-rose-600", text: "text-white", label: "P4 Critical" },
    warning: { bg: "bg-amber-500", text: "text-white", label: "P3 Warning" },
    info: { bg: "bg-guardblue", text: "text-white", label: "P2 Info" },
  } as const;
  const s = map[severity];
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold ${s.bg} ${s.text}`}
    >
      {s.label}
    </span>
  );
}

function ReviewBadge({ status }: { status: "open" | "in_review" | "resolved" }) {
  const map = {
    open: "bg-rose-50 text-rose-700 border-rose-200",
    in_review: "bg-amber-50 text-amber-700 border-amber-200",
    resolved: "bg-emerald-50 text-emerald-700 border-emerald-200",
  };
  const label =
    status === "in_review" ? "In Review" : status.charAt(0).toUpperCase() + status.slice(1);
  return (
    <span className={`rounded-md border px-2 py-0.5 text-[11px] font-semibold ${map[status]}`}>
      {label}
    </span>
  );
}

function ForensicSlideOut({ incident, onClose }: { incident: Incident; onClose: () => void }) {
  return (
    <aside className="fixed bottom-6 right-6 z-40 w-[520px] max-w-[92vw] rounded-xl border border-slate-700 bg-guardink shadow-2xl">
      <div className="flex items-center justify-between border-b border-slate-700 bg-black/30 px-4 py-2">
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-slate-300">
          <Brain size={12} className="text-guardblue" />
          Thinking Log Trace
        </div>
        <button
          onClick={onClose}
          className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
        >
          <X size={14} />
        </button>
      </div>
      <div className="space-y-3 px-4 py-4 text-[12px]">
        <div className="flex flex-wrap items-center gap-2 text-[11px]">
          <span className="rounded-md bg-slate-800 px-2 py-0.5 font-mono text-slate-300">
            {incident.id.length > 20 ? incident.id.slice(0, 12) + "…" : incident.id}
          </span>
          <span className="text-slate-400">{incident.ts}</span>
          <span className="text-slate-600">·</span>
          <span className="font-semibold text-slate-200">{incident.agentId}</span>
          <SeverityPill severity={incident.severity} />
          {incident.score != null && (
            <span className="rounded-md bg-rose-900/60 px-2 py-0.5 text-[10px] font-semibold text-rose-200">
              score {incident.score}
            </span>
          )}
        </div>
        <div className="font-mono text-emerald-300/90 leading-6 space-y-1.5 max-h-80 overflow-y-auto term-scroll pr-1">
          {incident.thinkingLog.map((line, i) => (
            <div
              key={i}
              className={
                /\bALERT\b/.test(line)
                  ? "text-rose-400"
                  : /\bTOOL_UNKNOWN\b|\bDB_FALLBACK\b|\bWARN\b/.test(line)
                  ? "text-amber-300"
                  : "text-emerald-300/90"
              }
            >
              {line}
            </div>
          ))}
        </div>
        <div className="rounded-md border border-slate-700 bg-slate-900/60 px-3 py-2 text-[11px] text-slate-300">
          <span className="font-semibold text-slate-400">Guardrail:</span>{" "}
          <code className="font-mono text-slate-200">{incident.guardrail}</code>{" "}
          <span className="text-slate-600">·</span>{" "}
          <span className="font-semibold text-slate-400">Action:</span>{" "}
          <span className="text-slate-200">{incident.action}</span>
        </div>
      </div>
    </aside>
  );
}
