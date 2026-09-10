/** The live connection dot on Settings: green when fresh, amber when stale,
 * red when unreachable, grey while waiting for the first sync. Status colors
 * are data, never decoration — only the amber state breathes. */
import { View } from "react-native";
import Animated, { useAnimatedStyle, useReducedMotion } from "react-native-reanimated";
import { useTheme } from "../../theme";
import { useGentlePulse } from "./motion";

export type LinkHealth = "waiting" | "live" | "stale" | "down";

export function StatusDot({ health, size = 10 }: { health: LinkHealth; size?: number }) {
  const colors = useTheme();
  const reduceMotion = useReducedMotion();
  const color =
    health === "live"
      ? colors.ample
      : health === "stale"
        ? colors.watch
        : health === "down"
          ? colors.critical
          : colors.tertiaryLabel;
  const base = { width: size, height: size, borderRadius: size, backgroundColor: color };

  // Only "stale" pulses: the connection is troubled but not broken.
  const opacity = useGentlePulse(health === "stale", reduceMotion, 0.5, 1400);
  const staleStyle = useAnimatedStyle(() => ({ opacity: opacity.get() }));

  if (health === "stale" && !reduceMotion) {
    return <Animated.View style={[base, staleStyle]} />;
  }
  return <View style={base} />;
}
