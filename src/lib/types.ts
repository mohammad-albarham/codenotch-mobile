/** The wire model — mirrors desktop codenotch's UsageModel.swift. */

export type Fidelity = "official" | "derived" | "manual";

export type StatusKind =
  | "ok"
  | "stale"
  | "needsAuth"
  | "accessDenied"
  | "unsupported"
  | "error";

export interface ProviderStatus {
  kind: StatusKind;
  since?: string | null; // for stale: when the reading was taken
  why?: string; // for unsupported / error
}

export interface LimitWindow {
  id: string;
  label: string;
  usedFraction: number | null; // 0..1+, 1 means the limit is spent
  remaining: number | null;
  used: number | null;
  resetsAt: string | null;
}

export interface UsageBlock {
  reason: string;
  resetsAt: string | null;
}

export interface ProviderAccount {
  plan?: string | null;
  source?: string;
  account?: string;
  manageUrl?: string;
}

export interface ProviderSnapshot {
  id: string;
  displayName: string;
  fidelity: Fidelity;
  status: ProviderStatus;
  windows: LimitWindow[];
  headlineId: string | null;
  block: UsageBlock | null;
  account?: ProviderAccount | null;
}

export type SessionState = "busy" | "waiting" | "idle";

export interface AgentSession {
  id: string;
  name: string;
  detail: string;
  state: SessionState;
  waitingFor: string | null;
  since: string | null;
}

export interface Snapshot {
  server: {
    name: string;
    version: string;
    generatedAt: string | null;
    demo: boolean;
  };
  providers: ProviderSnapshot[];
  sessions: AgentSession[];
}

/** What the headline ring shows: the provider's declared primary window. */
export function headlineWindow(p: ProviderSnapshot): LimitWindow | null {
  if (!p.headlineId) return p.windows[0] ?? null;
  return p.windows.find((w) => w.id === p.headlineId) ?? null;
}

export function hasReading(p: ProviderSnapshot): boolean {
  return p.windows.length > 0;
}
