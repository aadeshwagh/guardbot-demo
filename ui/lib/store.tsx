"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  PLACEHOLDER_AGENTS,
  MOCK_PROPOSALS,
  type Agent,
  type Incident,
  type Proposal,
  type Severity,
} from "./mockData";
import { fetchAgents, fetchIncidents } from "./api";

export type Tab = "registry" | "operations" | "audit" | "mods";
export type OperationsMode = "baseline" | "live";

interface GuardStore {
  activeTab: Tab;
  setActiveTab: (t: Tab) => void;

  operationsMode: OperationsMode;
  setOperationsMode: (m: OperationsMode) => void;

  agents: Agent[];
  selectedAgentId: string;
  setSelectedAgentId: (id: string) => void;
  refreshAgents: () => Promise<void>;
  backendOnline: boolean;

  incidents: Incident[];
  incidentsLoading: boolean;
  refreshIncidents: () => Promise<void>;
  selectedIncidentId: string | null;
  setSelectedIncidentId: (id: string | null) => void;

  proposals: Proposal[];
  selectedProposalId: string;
  setSelectedProposalId: (id: string) => void;
  resolveProposal: (id: string, status: "resolved") => void;

  baselineSealed: boolean;
  setBaselineSealed: (b: boolean) => void;
}

const Ctx = createContext<GuardStore | null>(null);

function mapBackendAgent(a: any): Agent {
  return {
    id: a.id,
    name: a.name,
    version: a.version ?? "v1.0",
    status: a.status === "baselined" ? "baselined" : "awaiting",
    systemPrompt: a.system_prompt ?? "",
    baselineJson: a.baseline ?? null,
  };
}

function mapBackendIncident(i: any): Incident {
  const sev: Severity =
    i.severity_label === "critical" || i.severity_label === "warning" || i.severity_label === "info"
      ? i.severity_label
      : "info";
  const tsRaw: string = i.ts ?? "";
  const ts = tsRaw.includes("T") ? tsRaw.replace("T", " ").slice(0, 19) : tsRaw;
  const rule: string = i.rule ?? "unspecified";
  const typeLabel = rule.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());
  return {
    id: i.id ?? `INC-${ts}`,
    ts,
    agentId: i.agent ?? "OpsPilot",
    severity: sev,
    type: typeLabel,
    guardrail: rule,
    action: i.tool ? `Alert raised on tool ${i.tool}` : "Alert raised",
    reviewStatus: "open",
    score: i.score ?? null,
    thinkingLog: Array.isArray(i.thinking_log) ? i.thinking_log : [],
  };
}

export function GuardStoreProvider({ children }: { children: ReactNode }) {
  const [activeTab, setActiveTab] = useState<Tab>("registry");
  const [operationsMode, setOperationsMode] = useState<OperationsMode>("baseline");

  const [agents, setAgents] = useState<Agent[]>(PLACEHOLDER_AGENTS);
  const [selectedAgentId, setSelectedAgentId] = useState<string>(PLACEHOLDER_AGENTS[0].id);
  const [backendOnline, setBackendOnline] = useState<boolean>(false);

  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [incidentsLoading, setIncidentsLoading] = useState<boolean>(false);
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);

  const [proposals, setProposals] = useState<Proposal[]>(MOCK_PROPOSALS);
  const [selectedProposalId, setSelectedProposalId] = useState<string>(MOCK_PROPOSALS[0].id);

  const [baselineSealed, setBaselineSealed] = useState<boolean>(false);

  const refreshAgents = useCallback(async () => {
    const data = await fetchAgents();
    if (data?.agents?.length) {
      const mapped: Agent[] = data.agents.map(mapBackendAgent);
      setAgents(mapped);
      setSelectedAgentId((prev) => (mapped.find((a) => a.id === prev) ? prev : mapped[0].id));
      setBackendOnline(true);
    } else {
      setBackendOnline(false);
    }
  }, []);

  const selectedIncidentRef = useRef<string | null>(null);
  selectedIncidentRef.current = selectedIncidentId;

  const refreshIncidents = useCallback(async () => {
    setIncidentsLoading(true);
    try {
      const data = await fetchIncidents();
      if (data?.incidents) {
        const mapped = data.incidents.map(mapBackendIncident);
        setIncidents(mapped);
        const current = selectedIncidentRef.current;
        if (!current || !mapped.find((m: Incident) => m.id === current)) {
          setSelectedIncidentId(mapped[0]?.id ?? null);
        }
      }
    } finally {
      setIncidentsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshAgents();
    refreshIncidents();
  }, [refreshAgents, refreshIncidents]);

  // Refresh incidents whenever the Audit tab is activated.
  useEffect(() => {
    if (activeTab === "audit") {
      refreshIncidents();
    }
  }, [activeTab, refreshIncidents]);

  const resolveProposal = useCallback<GuardStore["resolveProposal"]>((id, status) => {
    setProposals((prev) => prev.map((p) => (p.id === id ? { ...p, status } : p)));
  }, []);

  const value = useMemo<GuardStore>(
    () => ({
      activeTab, setActiveTab,
      operationsMode, setOperationsMode,
      agents, selectedAgentId, setSelectedAgentId, refreshAgents, backendOnline,
      incidents, incidentsLoading, refreshIncidents,
      selectedIncidentId, setSelectedIncidentId,
      proposals, selectedProposalId, setSelectedProposalId, resolveProposal,
      baselineSealed, setBaselineSealed,
    }),
    [
      activeTab, operationsMode, agents, selectedAgentId, refreshAgents, backendOnline,
      incidents, incidentsLoading, refreshIncidents,
      selectedIncidentId, proposals, selectedProposalId,
      resolveProposal, baselineSealed,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useGuardStore(): GuardStore {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useGuardStore must be used inside <GuardStoreProvider>");
  return ctx;
}
