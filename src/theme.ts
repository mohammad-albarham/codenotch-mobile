/**
 * Design tokens.
 *
 * Dark is desktop codenotch's own palette, sampled from its design frame
 * (Palette.swift): green ample #00FF88, yellow watch #F2FF00, orange critical
 * #FF3F00, ring track #303030 on black. Light keeps the same hues, deepened
 * until they hold contrast on white — a neon yellow ring on a white card
 * would be invisible.
 *
 * The notch itself is always black, whatever the phone's appearance — as it
 * is on the Mac, where it sits over any wallpaper. `notch` carries its fixed
 * palette.
 *
 * Laws (see AGENTS.md): one accent (the ample green — codenotch's brand), one
 * grey family (cool, system), one shape scale: cards 16, inputs 12, the notch
 * 28, actions pills. Band colors are *data*, never button colors.
 */
import { useColorScheme } from "react-native";

export const spacing = (n: number) => n * 4;

export const radius = {
  card: 16,
  input: 12,
  notch: 28,
  pill: 999,
} as const;

export interface ThemeColors {
  scheme: "light" | "dark";
  background: string;
  card: string;
  insetCard: string; // a card inside a card — wells, plates
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
  barTrack: string;
}

const light: ThemeColors = {
  scheme: "light",
  background: "#F2F2F7",
  card: "#FFFFFF",
  insetCard: "#F0F0F4",
  label: "#0A0A0C",
  secondaryLabel: "#5B5B63",
  tertiaryLabel: "#8E8E96",
  separator: "#E3E3E8",
  accent: "#00844A",
  onAccent: "#FFFFFF",
  ample: "#00A65C",
  watch: "#B08A00",
  critical: "#E03A00",
  ringTrack: "#E6E6EB",
  barTrack: "#E9E9EE",
};

const dark: ThemeColors = {
  scheme: "dark",
  background: "#000000",
  card: "#141416",
  insetCard: "#232326",
  label: "#FFFFFF",
  secondaryLabel: "#9A9AA1",
  tertiaryLabel: "#66666D",
  separator: "#26262A",
  accent: "#00FF88",
  onAccent: "#00240F",
  ample: "#00FF88",
  watch: "#F2FF00",
  critical: "#FF3F00",
  ringTrack: "#303030",
  barTrack: "#2D2D2D",
};

/** The notch's fixed palette — black in both appearances, like the Mac's. */
export const notch = {
  ...dark,
  background: "#000000",
  card: "#000000",
  label: "#FFFFFF",
  secondaryLabel: "#808080",
} satisfies ThemeColors;

export function useTheme(): ThemeColors {
  const scheme = useColorScheme();
  return scheme === "dark" ? dark : light;
}

/** Mix a hex color toward white by `amount` (0..1) — same hue, lighter. */
export function lighten(hex: string, amount: number): string {
  return mixHex(hex, "#FFFFFF", amount);
}

/** Mix a hex color toward black by `amount` (0..1) — same hue, darker. */
export function darken(hex: string, amount: number): string {
  return mixHex(hex, "#000000", amount);
}

/** "rgba(10,10,12,0.08)" — same hue, lower presence, for tinted plates and
 * press states. The canonical form worklet color handling parses cleanly. */
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
