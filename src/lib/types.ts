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
  /** Section on the Mac ("Gemini Models") when a provider's labels repeat
   * across groups. Absent from Macs older than the field. */
  group?: string | null;
  label: string;
  usedFraction: number | null; // 0..1+, 1 means the limit is spent
  remaining: number | null;
  used: number | null;
  /** How `used` reads on the Mac ("$14.28") when the raw count is in another
   * unit, such as cents. Never print `used` raw when this is present. */
  usedText?: string | null;
  /** The Mac's own line for the window ("1.2M tokens"), shown instead of the
   * computed one, as desktop does. */
  detail?: string | null;
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
  /** The mark the Mac draws (desktop `ProviderGlyph` raw value). Absent from
   * Macs older than the field; the phone then maps it from `id`. */
  glyph?: string | null;
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
