"use client";

import { Bell, ShieldCheck, CircleDot } from "lucide-react";
import { useGuardStore, type Tab } from "@/lib/store";

const TABS: { id: Tab; label: string }[] = [
  { id: "registry", label: "Agent Registry" },
  { id: "operations", label: "Live Operations" },
  { id: "audit", label: "Audit & Reports" },
  { id: "mods", label: "Modifications" },
];

export function Header() {
  const { activeTab, setActiveTab } = useGuardStore();

  return (
    <header className="sticky top-0 z-30 w-full border-b border-slate-200 bg-white shadow-soft">
      <div className="flex h-14 items-center px-6">
        {/* Brand */}
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-guardblue text-white">
            <ShieldCheck size={18} />
          </div>
          <div className="leading-tight">
            <div className="text-sm font-semibold tracking-wide text-guardnavy">GUARD BOT</div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-slate-400">runtime governance</div>
          </div>
        </div>

        {/* Center tabs */}
        <nav className="mx-auto flex items-center gap-1">
          {TABS.map((t) => {
            const active = activeTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={
                  "rounded-md px-4 py-2 text-sm font-medium transition " +
                  (active
                    ? "bg-guardblue text-white shadow-soft"
                    : "text-slate-600 hover:bg-slate-100")
                }
              >
                {t.label}
              </button>
            );
          })}
        </nav>

        {/* Right side */}
        <div className="flex items-center gap-3">
          <SystemPill />
          <button className="relative rounded-md p-2 text-slate-500 hover:bg-slate-100">
            <Bell size={18} />
            <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-guardcrimson" />
          </button>
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-guardnavy text-xs font-semibold text-white">
            AW
          </div>
        </div>
      </div>
    </header>
  );
}

function SystemPill() {
  return (
    <div className="flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
      <CircleDot size={12} className="text-emerald-500" />
      <span>SYSTEM NOMINAL</span>
    </div>
  );
}
