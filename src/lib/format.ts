/**
 * Number and time formatting — a product, not a database. Wording follows
 * desktop codenotch's card ("73% Used", "Resets in 51 min", "Resets Thu
 * 12:00 AM") so the two apps read the same. Tabular numerals at call sites.
 */

/** "38" — the number a ring prints. */
export function percentText(usedFraction: number): string {
  return String(Math.round(usedFraction * 100));
}

/** "73% Used" · "~24% Used" — derived readings carry the ~ everywhere. */
export function usedCopy(usedFraction: number, derived = false): string {
  return `${derived ? "~" : ""}${percentText(usedFraction)}% Used`;
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
