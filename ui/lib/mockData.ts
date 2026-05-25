export interface Agent {
  id: string;
  name: string;
  version: string;
  status: "baselined" | "awaiting";
  systemPrompt: string;
  baselineJson: any;
}

/** Shown until /agents responds. Backend should overwrite this with real data. */
export const PLACEHOLDER_AGENTS: Agent[] = [
  {
    id: "opspilot-prod",
    name: "OpsPilot",
    version: "v1.0",
    status: "awaiting",
    systemPrompt: "Loading system prompt from backend…",
    baselineJson: null,
  },
];

// ---------------------------------------------------------------------------
// Audit / Incident reports — types only; data comes from the backend.
// ---------------------------------------------------------------------------
export type Severity = "critical" | "warning" | "info";

export interface Incident {
  id: string;
  ts: string;
  agentId: string;
  severity: Severity;
  type: string;
  guardrail: string;
  action: string;
  reviewStatus: "open" | "in_review" | "resolved";
  thinkingLog: string[];
  score: number | null;
}

// ---------------------------------------------------------------------------
// Baseline modification proposals (HITL governance)
// ---------------------------------------------------------------------------
export interface ProposalLine {
  kind: "context" | "add" | "del";
  text: string;
}

export interface Proposal {
  id: string;
  agentName: string;
  fromVersion: string;
  toVersion: string;
  status: "needs_review" | "ready" | "resolved";
  reason: string;
  currentLines: ProposalLine[];
  proposedLines: ProposalLine[];
}

export const MOCK_PROPOSALS: Proposal[] = [
  {
    id: "proposal-1",
    agentName: "Logistics_Bot",
    fromVersion: "1.1",
    toVersion: "1.2",
    status: "needs_review",
    reason:
      "Valid new path found during discovery testing: requires whitelist update for 'Fetch_SQL' + 'get_weather'.",
    currentLines: [
      { kind: "context", text: "{" },
      { kind: "context", text: '  "agent": "Logistics_Bot",' },
      { kind: "context", text: '  "version": "1.1",' },
      { kind: "context", text: '  "allowed_tools": [' },
      { kind: "context", text: '    "track_shipment",' },
      { kind: "context", text: '    "list_routes",' },
      { kind: "del",     text: '    "get_weather",' },
      { kind: "context", text: '    "estimate_eta"' },
      { kind: "context", text: "  ]," },
      { kind: "context", text: '  "prohibited_actions": ["modify_route", "external_email"]' },
      { kind: "context", text: "}" },
    ],
    proposedLines: [
      { kind: "context", text: "{" },
      { kind: "context", text: '  "agent": "Logistics_Bot",' },
      { kind: "add",     text: '  "version": "1.2",' },
      { kind: "context", text: '  "allowed_tools": [' },
      { kind: "context", text: '    "track_shipment",' },
      { kind: "context", text: '    "list_routes",' },
      { kind: "add",     text: '    "Fetch_SQL",' },
      { kind: "add",     text: '    "get_weather",' },
      { kind: "context", text: '    "estimate_eta"' },
      { kind: "context", text: "  ]," },
      { kind: "context", text: '  "prohibited_actions": ["modify_route", "external_email"]' },
      { kind: "context", text: "}" },
    ],
  },
  {
    id: "proposal-2",
    agentName: "Data_Extractor_4",
    fromVersion: "1.2",
    toVersion: "1.3",
    status: "ready",
    reason: "Auto-detected new normal sequence 'Fetch_SQL -> Format_Markdown -> Email_Report' across 14 sessions.",
    currentLines: [
      { kind: "context", text: '"sealed_sequence": ["Fetch_SQL", "Format_Markdown", "Save_To_Blob"]' },
    ],
    proposedLines: [
      { kind: "add",     text: '"sealed_sequence": ["Fetch_SQL", "Format_Markdown", "Save_To_Blob", "Email_Report"]' },
    ],
  },
  {
    id: "proposal-3",
    agentName: "Inventory_Mgr",
    fromVersion: "0.9",
    toVersion: "1.0",
    status: "resolved",
    reason: "Initial baseline seal after observation window.",
    currentLines: [{ kind: "context", text: "(no baseline)" }],
    proposedLines: [{ kind: "add", text: '"allowed_tools": ["sku_count", "low_stock", "reorder_queue"]' }],
  },
];
