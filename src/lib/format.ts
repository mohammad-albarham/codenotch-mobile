/**
 * Number and time formatting — a product, not a database.
 * Percentages and counts use tabular numerals at the call site.
 */

/** "38" — the number the ring prints. */
export function percentText(usedFraction: number): string {
  return String(Math.round(usedFraction * 100));
}

/** "38% Used · 62% left" — desktop codenotch's tooltip wording, which exists
 * because vendors disagree on which end of the same figure to print. */
export function windowSummary(usedFraction: number): string {
  const used = Math.round(usedFraction * 100);
  return `${used}% Used · ${Math.max(0, 100 - used)}% left`;
}

/** "resets in 2h 13m" · "resets in 45 min" · "resets Fri 4:13 PM".
 * A countdown while it is close; the vendor's own clock once it is days out. */
export function resetCopy(resetsAt: string | null | undefined, now: Date = new Date()): string {
  if (!resetsAt) return "no reset listed";
  const then = new Date(resetsAt);
  const seconds = (then.getTime() - now.getTime()) / 1000;
  if (seconds <= 0) return "resetting now";
  if (seconds < 60) return "resets in under a minute";
  if (seconds < 3600) return `resets in ${Math.round(seconds / 60)} min`;
  if (seconds < 48 * 3600) {
    const h = Math.floor(seconds / 3600);
    const m = Math.round((seconds - h * 3600) / 60);
    return m > 0 ? `resets in ${h}h ${m}m` : `resets in ${h}h`;
  }
  const formatter = new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  });
  return `resets ${formatter.format(then)}`;
}

/** "4:13 PM" — the clock the vendor's own banner uses. */
export function clockCopy(resetsAt: string | null | undefined): string {
  if (!resetsAt) return "";
  const formatter = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });
  return formatter.format(new Date(resetsAt));
}

/** "12m ago" — how old a stale reading is. */
export function ageCopy(since: string | null | undefined, now: Date = new Date()): string {
  if (!since) return "just now";
  const seconds = Math.max(0, (now.getTime() - new Date(since).getTime()) / 1000);
  if (seconds < 90) return "moments ago";
  if (seconds < 3600) return `${Math.round(seconds / 60)}m ago`;
  if (seconds < 48 * 3600) {
    const h = Math.floor(seconds / 3600);
    return `${h}h ${Math.round((seconds - h * 3600) / 60)}m ago`;
  }
  return `${Math.floor(seconds / 86400)}d ago`;
}

/** "2h" for session rows — how long a session has been in its state. */
export function sinceCopy(since: string | null | undefined): string {
  if (!since) return "";
  const date = new Date(since);
  const seconds = (Date.now() - date.getTime()) / 1000;
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.round(seconds / 60)} min`;
  if (seconds < 48 * 3600) {
    const h = Math.floor(seconds / 3600);
    const m = Math.round((seconds - h * 3600) / 60);
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }
  return new Intl.DateTimeFormat(undefined, { weekday: "short", hour: "numeric" }).format(date);
}
