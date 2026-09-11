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

/** Provider id (from the agent) → the mark desktop codenotch draws for it. */
const glyphFor: Record<string, GlyphKey> = {
  claude: "claude",
  codex: "openai",
  openai: "openai",
  cursor: "cursor",
  glm: "glm",
  antigravity: "antigravity",
  gemini: "antigravity",
};

const opticalScale: Record<GlyphKey, number> = {
  claude: 0.97,
  openai: 0.94,
  third: 1,
  cursor: 0.97,
  gemini: 1,
  antigravity: 1,
  glm: 0.95,
};

export function ProviderGlyph({
  providerId,
  displayName,
  size,
  color,
}: {
  providerId: string;
  /** Used for the lettermark when a provider has no traced glyph. */
  displayName?: string;
  size: number;
  color: string;
}) {
  const baseId = providerId.split(":")[0];
  const key = glyphFor[baseId];
  if (!key) {
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
