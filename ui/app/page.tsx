"use client";

import { GuardStoreProvider, useGuardStore } from "@/lib/store";
import { Header } from "@/components/Header";
import { AgentRegistry } from "@/components/AgentRegistry";
import { LiveOperations } from "@/components/LiveOperations";
import { AuditReports } from "@/components/AuditReports";
import { Modifications } from "@/components/Modifications";

function Workspace() {
  const { activeTab } = useGuardStore();
  return (
    <div className="min-h-screen bg-[#F8F9FA]">
      <Header />
      <main className="px-6 py-6">
        {activeTab === "registry" && <AgentRegistry />}
        {activeTab === "operations" && <LiveOperations />}
        {activeTab === "audit" && <AuditReports />}
        {activeTab === "mods" && <Modifications />}
      </main>
    </div>
  );
}

export default function Page() {
  return (
    <GuardStoreProvider>
      <Workspace />
    </GuardStoreProvider>
  );
}
