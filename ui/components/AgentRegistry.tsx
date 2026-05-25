"use client";

import { Copy, Lock, Plus, ShieldCheck } from "lucide-react";
import { useGuardStore } from "@/lib/store";

export function AgentRegistry() {
  const { agents, selectedAgentId, setSelectedAgentId } = useGuardStore();
  const agent = agents.find((a) => a.id === selectedAgentId) ?? agents[0];

  return (
    <div className="grid grid-cols-12 gap-6">
      {/* Sidebar — 25% */}
      <aside className="col-span-3 flex h-[calc(100vh-120px)] flex-col rounded-xl border border-slate-200 bg-white shadow-soft">
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-guardnavy">
            Onboarded Agents
          </h2>
          <p className="text-[11px] text-slate-500">{agents.length} agents under governance</p>
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          <ul className="space-y-2">
            {agents.map((a) => {
              const active = a.id === selectedAgentId;
              return (
                <li key={a.id}>
                  <button
                    onClick={() => setSelectedAgentId(a.id)}
                    className={
                      "w-full rounded-lg border px-3 py-2.5 text-left transition " +
                      (active
                        ? "border-guardblue bg-blue-50/60 ring-1 ring-guardblue/40"
                        : "border-slate-200 bg-white hover:border-slate-300")
                    }
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm text-guardnavy">{a.name}</span>
                      <StatusBadge status={a.status} />
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 text-[11px] text-slate-500">
                      <span>{a.version}</span>
                      <span className="text-slate-300">•</span>
                      <code className="font-mono">{a.id.slice(0, 12)}…</code>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
        <div className="border-t border-slate-200 p-3">
          <button
            disabled
            title="Onboarding is disabled in this demo"
            className="flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-md bg-slate-200 px-3 py-2 text-sm font-semibold text-slate-400"
          >
            <Plus size={16} /> Onboard New Agent
          </button>
          <p className="mt-1.5 text-center text-[10px] text-slate-400">
            Onboarding is disabled — only OpsPilot is wired to the backend
          </p>
        </div>
      </aside>

      {/* Workspace — 75% */}
      <section className="col-span-9 flex h-[calc(100vh-120px)] flex-col rounded-xl border border-slate-200 bg-white shadow-soft">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <div>
            <h1 className="text-base font-semibold text-guardnavy">{agent.name}</h1>
            <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-500">
              <code className="font-mono text-slate-600">{agent.id}</code>
              <button
                onClick={() => navigator.clipboard?.writeText(agent.id)}
                className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <Copy size={12} />
              </button>
              <span className="text-slate-300">•</span>
              <span>{agent.version}</span>
            </div>
          </div>
          <ImmutablePill />
        </div>

        <div className="grid flex-1 grid-cols-2 gap-0 overflow-hidden">
          {/* Left view — system prompt */}
          <div className="flex flex-col border-r border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-slate-600">
              <span>Agent Prompt</span>
              <span className="text-[10px] font-normal normal-case text-slate-400">read-only</span>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              <pre className="whitespace-pre-wrap font-mono text-[12.5px] leading-6 text-slate-700">
{agent.systemPrompt}
              </pre>
            </div>
          </div>

          {/* Right view — baseline JSON */}
          <div className="flex flex-col bg-guardpanel">
            <div className="flex items-center justify-between border-b border-slate-800 bg-guardink px-4 py-2 text-xs font-semibold uppercase tracking-wider text-slate-300">
              <span className="flex items-center gap-1.5">
                <ShieldCheck size={12} /> Baseline JSON
              </span>
              <span className="text-[10px] font-normal normal-case text-slate-500">immutable</span>
            </div>
            <div className="flex-1 overflow-y-auto p-5 term-scroll">
              {agent.baselineJson ? (
                <BaselineJson value={agent.baselineJson} />
              ) : (
                <div className="rounded-md border border-dashed border-slate-700 bg-slate-900/40 p-5 text-center text-xs text-slate-400">
                  Baseline awaiting discovery. Run agent in baseline mode to produce a sealed profile.
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

    </div>
  );
}

function StatusBadge({ status }: { status: "baselined" | "awaiting" }) {
  if (status === "baselined") {
    return (
      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
        Baselined
      </span>
    );
  }
  return (
    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
      Awaiting Discovery
    </span>
  );
}

function ImmutablePill() {
  return (
    <div className="flex items-center gap-1.5 rounded-full bg-guardnavy px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-white">
      <Lock size={11} />
      <span>STATE: IMMUTABLE</span>
      <span className="font-normal lowercase text-slate-300">(Azure Blob)</span>
    </div>
  );
}

/** Tiny JSON pretty-printer with syntax tints — no external dep. */
function BaselineJson({ value }: { value: any }) {
  const text = JSON.stringify(value, null, 2);
  return (
    <pre className="font-mono text-[12.5px] leading-6">
      {text.split("\n").map((line, i) => (
        <div key={i} className="whitespace-pre">
          {colorizeLine(line)}
        </div>
      ))}
    </pre>
  );
}

function colorizeLine(line: string): React.ReactNode {
  const keyMatch = line.match(/^(\s*)(".*?"):/);
  if (keyMatch) {
    const indent = keyMatch[1];
    const key = keyMatch[2];
    const rest = line.slice(keyMatch[0].length);
    return (
      <>
        <span className="text-slate-500">{indent}</span>
        <span className="text-sky-300">{key}</span>
        <span className="text-slate-400">:</span>
        <span className="text-emerald-300">{rest}</span>
      </>
    );
  }
  if (/^[{}\[\],]\s*$/.test(line) || /^\s*[{}\[\]]/.test(line)) {
    return <span className="text-slate-300">{line}</span>;
  }
  return <span className="text-emerald-300">{line}</span>;
}
