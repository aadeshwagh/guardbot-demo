"use client";

import { useState } from "react";
import { Cloud, Cog, Database, GitBranch, CheckCircle2, XCircle } from "lucide-react";
import { useGuardStore } from "@/lib/store";
import type { Proposal, ProposalLine } from "@/lib/mockData";

export function Modifications() {
  const { proposals, selectedProposalId, setSelectedProposalId, resolveProposal } = useGuardStore();
  const [reviewerNotes, setReviewerNotes] = useState("");
  const proposal = proposals.find((p) => p.id === selectedProposalId) ?? proposals[0];

  function approve() {
    resolveProposal(proposal.id, "resolved");
    setReviewerNotes("");
  }
  function reject() {
    resolveProposal(proposal.id, "resolved");
    setReviewerNotes("");
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-5 py-3 shadow-soft">
        <div>
          <h1 className="text-base font-semibold text-guardnavy tracking-wide">
            GOVERNANCE: BASELINE MODIFICATIONS
          </h1>
          <p className="text-xs text-slate-500">
            Human-in-the-loop approval for proposed baseline updates
          </p>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-slate-500">
          <GitBranch size={14} /> {proposals.length} proposals in queue
        </div>
      </div>

      <div className="grid grid-cols-12 gap-4">
        {/* Column 1 — proposal queue */}
        <aside className="col-span-12 lg:col-span-3 flex flex-col rounded-xl border border-slate-200 bg-white shadow-soft">
          <div className="border-b border-slate-200 px-4 py-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-guardnavy">
              Proposals Awaiting Review
            </h2>
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            <ul className="space-y-2">
              {proposals.map((p) => {
                const active = p.id === selectedProposalId;
                return (
                  <li key={p.id}>
                    <button
                      onClick={() => setSelectedProposalId(p.id)}
                      className={
                        "w-full rounded-lg border px-3 py-2.5 text-left transition " +
                        (active
                          ? "border-guardblue bg-blue-50/60 ring-1 ring-guardblue/40"
                          : "border-slate-200 bg-white hover:border-slate-300")
                      }
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-guardnavy">{p.agentName}</span>
                        <ProposalStatusBadge status={p.status} />
                      </div>
                      <div className="mt-0.5 text-[11px] text-slate-500">
                        <code className="font-mono">V{p.fromVersion} → V{p.toVersion}</code>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </aside>

        {/* Column 2 — diff view */}
        <section className="col-span-12 lg:col-span-6 flex flex-col rounded-xl border border-slate-200 bg-white shadow-soft">
          <div className="border-b border-slate-200 px-5 py-3">
            <h2 className="text-sm font-semibold text-guardnavy">
              BASELINE PROPOSAL REVIEW: {proposal.agentName} (V{proposal.fromVersion} → V{proposal.toVersion})
            </h2>
            <p className="text-xs text-slate-500">Side-by-side diff against the currently sealed baseline</p>
          </div>
          <div className="grid flex-1 grid-cols-2 gap-0 overflow-hidden">
            <DiffPane title={`Current V${proposal.fromVersion}`} lines={proposal.currentLines} side="left" />
            <DiffPane title={`Proposed V${proposal.toVersion}`} lines={proposal.proposedLines} side="right" />
          </div>
        </section>

        {/* Column 3 — governance panel */}
        <aside className="col-span-12 lg:col-span-3 flex flex-col rounded-xl border border-slate-200 bg-white shadow-soft">
          <div className="border-b border-slate-200 px-4 py-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-guardnavy">
              Governance Panel
            </h2>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <div className="space-y-1">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Proposing Agent
              </div>
              <div className="text-sm font-semibold text-guardnavy">{proposal.agentName}</div>
              <div className="text-[11px] text-slate-500">
                <code className="font-mono">V{proposal.fromVersion} → V{proposal.toVersion}</code>
              </div>
            </div>

            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2.5">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Reason for Change
              </div>
              <div className="mt-1 text-[12.5px] leading-5 text-slate-700">
                <span className="text-slate-500">(extracted from incident log:)</span>{" "}
                <span className="italic">'{proposal.reason}'</span>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Human Reviewer Notes
              </label>
              <textarea
                value={reviewerNotes}
                onChange={(e) => setReviewerNotes(e.target.value)}
                rows={5}
                placeholder="Add your contextual approval analysis here..."
                className="w-full resize-none rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-guardblue"
              />
            </div>
          </div>

          <div className="border-t border-slate-200 p-3 space-y-2">
            <button
              onClick={reject}
              className="flex w-full items-center justify-center gap-2 rounded-md bg-guardcrimson px-3 py-2.5 text-sm font-bold tracking-wide text-white shadow-soft hover:bg-rose-700"
            >
              <XCircle size={16} /> REJECT PROPOSAL
            </button>
            <button
              onClick={approve}
              className="flex w-full items-center justify-center gap-2 rounded-md bg-guardemerald px-3 py-2.5 text-sm font-bold tracking-wide text-white shadow-soft hover:bg-emerald-600"
            >
              <CheckCircle2 size={16} /> APPROVE &amp; SEAL BASELINE
            </button>
            <DeploymentPipeline />
          </div>
        </aside>
      </div>
    </div>
  );
}

function ProposalStatusBadge({ status }: { status: Proposal["status"] }) {
  const map = {
    needs_review: { bg: "bg-rose-100", text: "text-rose-700", label: "Needs Review" },
    ready: { bg: "bg-amber-100", text: "text-amber-700", label: "Ready" },
    resolved: { bg: "bg-emerald-100", text: "text-emerald-700", label: "Resolved" },
  } as const;
  const s = map[status];
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${s.bg} ${s.text}`}>
      {s.label}
    </span>
  );
}

function DiffPane({
  title,
  lines,
  side,
}: {
  title: string;
  lines: ProposalLine[];
  side: "left" | "right";
}) {
  return (
    <div className={"flex flex-col " + (side === "left" ? "border-r border-slate-200" : "")}>
      <div className="border-b border-slate-200 bg-slate-50 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-slate-600">
        {title}
      </div>
      <pre className="term-scroll flex-1 overflow-y-auto bg-white p-0 font-mono text-[12px] leading-6">
        {lines.map((l, i) => (
          <DiffLine key={i} line={l} />
        ))}
      </pre>
    </div>
  );
}

function DiffLine({ line }: { line: ProposalLine }) {
  if (line.kind === "add") {
    return (
      <div className="flex items-start gap-2 bg-emerald-50 px-4 text-emerald-800">
        <span className="select-none text-emerald-500">+</span>
        <span>{line.text}</span>
      </div>
    );
  }
  if (line.kind === "del") {
    return (
      <div className="flex items-start gap-2 bg-rose-50 px-4 text-rose-800">
        <span className="select-none text-rose-500">-</span>
        <span>{line.text}</span>
      </div>
    );
  }
  return (
    <div className="flex items-start gap-2 px-4 text-slate-600">
      <span className="select-none text-slate-300"> </span>
      <span>{line.text}</span>
    </div>
  );
}

function DeploymentPipeline() {
  return (
    <div className="mt-1 flex items-center justify-center gap-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
      <PipelineNode icon={<Cog size={14} />} label="Logic Apps" />
      <Connector />
      <PipelineNode icon={<Database size={14} />} label="ACA API" />
      <Connector />
      <PipelineNode icon={<Cloud size={14} />} label="Blob Storage" />
    </div>
  );
}

function PipelineNode({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="flex h-7 w-7 items-center justify-center rounded-md bg-guardblue text-white">
        {icon}
      </div>
      <div className="text-[9px] font-semibold uppercase tracking-wider text-slate-500">{label}</div>
    </div>
  );
}

function Connector() {
  return <div className="h-px w-5 bg-slate-300" />;
}
