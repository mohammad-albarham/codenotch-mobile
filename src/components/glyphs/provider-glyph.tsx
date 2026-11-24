/**
 * The provider's mark, drawn the way the notch draws it: a traced outline
 * filled even-odd, scaled inside a fixed square so every mark reserves the
 * same box while its ink is evened out (desktop ProviderGlyph.opticalScale,
 * measured from a render there).
 */
import { View } from "react-native";
import Svg, { Path, Text as SvgText } from "react-native-svg";
import { glyphPaths } from "./paths";

type GlyphKey = keyof typeof glyphPaths;

/** Desktop `ProviderGlyph` raw value → the outline desktop draws for it
 * (ProviderGlyph.outline). Two raw values name a different outline: the
 * Antigravity mark's raw value is "gemini", and "gemini-spark" draws the
 * Gemini spark. Glyphs desktop draws only from an image asset (Gemma, Qwen,
 * LM Studio…) have no outline here and get the lettermark. */
const outlineFor: Record<string, GlyphKey> = {
  claude: "claude",
  openai: "openai",
  third: "third",
  cursor: "cursor",
  gemini: "antigravity",
  "gemini-spark": "gemini",
  glm: "glm",
  grok: "grok",
  opencode: "opencode",
  commandcode: "commandcode",
  copilot: "copilot",
  kimi: "kimi",
  mimo: "mimo",
  manual: "manual",
  kilo: "kilo",
  kiro: "kiro",
  minimax: "minimax",
  ollama: "ollama",
  "ollama-local": "ollama",
};

/** Provider id → glyph raw value, for Macs that don't send `glyph` yet (the
 * standalone agent, Codenotch before the field). */
const glyphForId: Record<string, string> = {
  claude: "claude",
  codex: "openai",
  openai: "openai",
  cursor: "cursor",
  glm: "glm",
  antigravity: "gemini",
  gemini: "gemini",
  "gemini-api": "gemini-spark",
  copilot: "copilot",
};

/** desktop ProviderGlyph.opticalScale, by outline: each value brings that
 * mark's ink to the same extent as Claude's. */
const opticalScale: Record<GlyphKey, number> = {
  claude: 0.97,
  openai: 0.94,
  third: 1,
  cursor: 0.97,
  gemini: 1,
  antigravity: 1,
  glm: 0.95,
  grok: 1,
  opencode: 0.95,
  commandcode: 0.96,
  copilot: 0.96,
  kimi: 0.95,
  mimo: 0.95,
  manual: 1,
  kilo: 0.97,
  kiro: 0.95,
  minimax: 0.95,
  ollama: 0.95,
};

export function ProviderGlyph({
  providerId,
  glyph,
  displayName,
  size,
  color,
}: {
  providerId: string;
  /** The Mac's glyph raw value, when it sends one. */
  glyph?: string | null;
  /** Used for the lettermark when a provider has no traced glyph. */
  displayName?: string;
  size: number;
  color: string;
}) {
  const baseId = providerId.split(":")[0];
  const key = outlineFor[glyph ?? glyphForId[baseId] ?? baseId];
  if (!key || !glyphPaths[key]) {
    // An unknown provider gets an honest lettermark, not a borrowed logo.
    const letter = (displayName ?? providerId).slice(0, 1).toUpperCase();
    return (
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <SvgText x="50" y="70" fontSize="62" fontWeight="600" fill={color} textAnchor="middle">
          {letter}
        </SvgText>
      </Svg>
    );
  }
  const scale = opticalScale[key];
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size * scale} height={size * scale} viewBox="0 0 100 100">
        <Path d={glyphPaths[key]} fill={color} fillRule="evenodd" />
      </Svg>
    </View>
  );
}
