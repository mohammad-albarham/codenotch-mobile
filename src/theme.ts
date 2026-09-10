/**
 * Design tokens.
 *
 * Inherited from desktop codenotch's palette (sampled from its design frame):
 * green ample / yellow watch / orange critical. Tuned per-theme for contrast
 * on a phone, where the notch's black card no longer sets the background.
 *
 * Laws (see AGENTS.md): one accent (the ample family — codenotch's brand
 * green), one grey family (system), one shape scale: cards 16, inputs 12,
 * actions pills. Status colors are *data*, never button colors.
 */
import { useColorScheme } from "react-native";

export const spacing = (n: number) => n * 4;

export const radius = {
  card: 16,
  input: 12,
  pill: 999,
} as const;

export interface ThemeColors {
  background: string;
  card: string;
  insetCard: string; // a card inside a card — bars, wells
  label: string;
  secondaryLabel: string;
  tertiaryLabel: string;
  separator: string;
  accent: string;
  onAccent: string;
  ample: string;
  watch: string;
  critical: string;
  ringTrack: string;
  dim: string; // stale readings — dimmed but legible
}

const light: ThemeColors = {
  background: "#F2F2F7",
  card: "#FFFFFF",
  insetCard: "#EFEFF4",
  label: "#0A0A0C",
  secondaryLabel: "#5B5B63",
  tertiaryLabel: "#8E8E96",
  separator: "#E3E3E8",
  accent: "#14813F",
  onAccent: "#FFFFFF",
  ample: "#14813F",
  watch: "#9A6A00",
  critical: "#C93300",
  ringTrack: "#E4E4E9",
  dim: "#9A9AA2",
};

const dark: ThemeColors = {
  background: "#000000",
  card: "#1A1A1E",
  insetCard: "#26262B",
  label: "#F2F2F7",
  secondaryLabel: "#AEAEB5",
  tertiaryLabel: "#7C7C85",
  separator: "#2A2A30",
  accent: "#30D158",
  onAccent: "#04120A",
  ample: "#30D158",
  watch: "#FFC531",
  critical: "#FF5E3A",
  ringTrack: "#2C2C31",
  dim: "#6C6C74",
};

export function useTheme(): ThemeColors {
  const scheme = useColorScheme();
  return scheme === "dark" ? dark : light;
}

// --- Appended helpers (motion & material depth). No existing values change. ---

/** Mix a hex color toward white by `amount` (0..1) — same hue, lighter. */
export function lighten(hex: string, amount: number): string {
  return mixHex(hex, "#FFFFFF", amount);
}

/** Mix a hex color toward black by `amount` (0..1) — same hue, darker. */
export function darken(hex: string, amount: number): string {
  return mixHex(hex, "#000000", amount);
}

/** Append an alpha channel to a hex color: withAlpha("#0A0A0C", 0.08). */
export function withAlpha(hex: string, alpha: number): string {
  const a = Math.round(Math.min(1, Math.max(0, alpha)) * 255)
    .toString(16)
    .padStart(2, "0");
  return `#${normalizeHex(hex)}${a}`;
}

/** "rgba(10,10,12,0.08)" — the canonical form worklet color interpolation
 * parses without ambiguity. */
export function rgba(hex: string, alpha: number): string {
  const [r, g, b] = hexChannels(normalizeHex(hex));
  return `rgba(${r},${g},${b},${Math.round(Math.min(1, Math.max(0, alpha)) * 1000) / 1000})`;
}

function mixHex(hex: string, toward: string, amount: number): string {
  const [r, g, b] = hexChannels(normalizeHex(hex));
  const [tr, tg, tb] = hexChannels(normalizeHex(toward));
  const m = (from: number, to: number) => Math.round(from + (to - from) * amount);
  return rgbHex(m(r, tr), m(g, tg), m(b, tb));
}

function normalizeHex(hex: string): string {
  let h = hex.replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  return h.slice(0, 6);
}

function hexChannels(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(0, 2), 16),
    parseInt(hex.slice(2, 4), 16),
    parseInt(hex.slice(4, 6), 16),
  ];
}

function rgbHex(r: number, g: number, b: number): string {
  const c = (n: number) => Math.min(255, Math.max(0, n)).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}
