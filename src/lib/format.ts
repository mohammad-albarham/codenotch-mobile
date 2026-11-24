import type { LimitWindow } from "./types";

/**
 * Number and time formatting — a product, not a database. Wording follows
 * desktop codenotch's card ("73% Used", "Resets in 51 min", "Resets Thu
 * 12:00 AM") so the two apps read the same. Tabular numerals at call sites.
 */

/** Below one percent a whole number would collapse a real reading into "0",
 * the figure that looks most like "nothing used" — so tenths there, exactly
 * as desktop codenotch's `Percent` does. */
function smallPercent(value: number): string {
  if (value <= 0) return "0";
  const tenths = Math.round(value * 10) / 10;
  if (tenths < 0.1) return "<0.1";
  if (tenths > 99.9) return ">99.9";
  return tenths.toFixed(1);
}

/** "38" · "0.3" — the number a ring prints. */
export function percentText(usedFraction: number): string {
  const value = usedFraction * 100;
  if (value > 0 && value < 1) return smallPercent(value);
  return String(Math.round(value));
}

/** Both halves of one reading, adding up to 100 — desktop's `Percent.halves`.
 * "Left" derives from the rounded used half, as the vendors' dashboards do. */
export function percentHalves(usedFraction: number): { used: string; left: string } {
  const value = usedFraction * 100;
  const fractional = (value > 0 && value < 1) || (value > 99 && value < 100);
  if (!fractional) {
    const used = Math.round(value);
    return { used: String(used), left: String(Math.max(0, 100 - used)) };
  }
  const left = Math.max(0, 100 - value);
  return { used: smallPercent(value), left: left > 99.9 ? ">99.9" : smallPercent(left) };
}

/** "73% Used · 27% left" · "~24% Used · 76% left" — derived readings carry
 * the ~ everywhere. Copy follows desktop codenotch's card. */
export function usedCopy(usedFraction: number, derived = false): string {
  const { used, left } = percentHalves(usedFraction);
  return `${derived ? "~" : ""}${used}% Used · ${left}% left`;
}

/** "840" · "12k" · "1.2M" — counts the way desktop's card prints them. */
export function compactCount(count: number): string {
  if (count < 10_000) return String(count);
  if (count < 1_000_000) return `${Math.floor(count / 1_000)}k`;
  return `${(count / 1_000_000).toFixed(1)}M`;
}

/** "resets in 2h 13m" · "resets in 45 min" · "resets Fri 4:13 PM".
 * A countdown while it is close; the vendor's own clock once it is days out. */
export function resetCopy(resetsAt: string | null | undefined, now: Date = new Date()): string {
  if (!resetsAt) return "no reset listed";
  const then = new Date(resetsAt);
  const seconds = (then.getTime() - now.getTime()) / 1000;
  // Long past means a stale reading from an earlier window: say when it
  // reset rather than claim a reset is happening now.
  if (seconds <= -15 * 60) {
    const sameYear = then.getFullYear() === now.getFullYear();
    const formatter = new Intl.DateTimeFormat(undefined, sameYear ? { month: "short", day: "numeric" } : { month: "short", day: "numeric", year: "numeric" });
    return `reset ${formatter.format(then)}`;
  }
  if (seconds <= 0) return "resetting now";
  if (seconds < 60) return "resets in under a minute";
  if (seconds < 3600) return `resets in ${Math.round(seconds / 60)} min`;
  if (seconds < 24 * 3600) {
    const h = Math.floor(seconds / 3600);
    const m = Math.round((seconds - h * 3600) / 60);
    return m > 0 && m < 60 ? `resets in ${h}h ${m}m` : `resets in ${m >= 60 ? h + 1 : h}h`;
  }
  const formatter = new Intl.DateTimeFormat(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" });
  return `resets ${formatter.format(then)}`;
}

/** "4:13 PM" — the clock the vendor's own banner uses, or null once past. */
export function untilClock(resetsAt: string | null | undefined, now: Date = new Date()): string | null {
  if (!resetsAt) return null;
  const then = new Date(resetsAt);
  if (then.getTime() <= now.getTime()) return null;
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(then);
}

/** "12m ago" · "3h ago" · "2d ago" — how old a reading or state is. */
export function ageCopy(since: string | null | undefined, now: Date = new Date()): string {
  if (!since) return "just now";
  const seconds = Math.max(0, (now.getTime() - new Date(since).getTime()) / 1000);
  if (seconds < 90) return "moments ago";
  if (seconds < 3600) return `${Math.round(seconds / 60)}m ago`;
  if (seconds < 24 * 3600) {
    const h = Math.floor(seconds / 3600);
    const m = Math.round((seconds - h * 3600) / 60);
    return m > 0 && m < 60 ? `${h}h ${m}m ago` : `${h}h ago`;
  }
  const days = Math.floor(seconds / 86400);
  return `${days}d ago`;
}

/** The line under the bar, by desktop TooltipCard's rule: the Mac's own
 * `detail` wins; otherwise both halves of the percentage; otherwise what is
 * left; otherwise what is used — in the Mac's wording when the raw count is in
 * another unit (cents, say), never as a bare number in the wrong unit. */
export function windowReading(window: LimitWindow, derived: boolean): string {
  const fraction = window.usedFraction;
  if (fraction != null) return window.detail ? `${derived ? "~" : ""}${window.detail}` : usedCopy(fraction, derived);
  if (window.detail) return window.detail;
  if (window.remaining != null) return `${compactCount(window.remaining)} left`;
  if (window.used != null) return window.usedText ?? `${compactCount(window.used)} used`;
  return "No reading";
}
