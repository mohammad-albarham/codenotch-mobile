/** One metered window, laid out exactly like a block of desktop codenotch's
 * hover card: label left and reset right, the bar, then "73% Used". The bar
 * grows in on mount; later readings move it without replaying, since the
 * user may be reading it. */
import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring } from "react-native-reanimated";
import { radius, spacing, type ThemeColors } from "../theme";
import { bandColor } from "./usage-ring";
import { resetCopy, usedCopy } from "../lib/format";
import type { LimitWindow } from "../lib/types";

export function WindowRow({
  window,
  now,
  colors,
  derived = false,
  dimmed = false,
}: {
  window: LimitWindow;
  now: Date;
  colors: ThemeColors;
  derived?: boolean;
  dimmed?: boolean;
}) {
  const reduceMotion = useReducedMotion();
  const fraction = window.usedFraction;
  const target = fraction == null ? 0 : Math.min(1, Math.max(0.02, fraction));

  const width = useSharedValue(reduceMotion ? target : 0);
  useEffect(() => {
    width.value = reduceMotion ? target : withSpring(target, { duration: 500, dampingRatio: 1 });
  }, [target, reduceMotion, width]);
  const fillStyle = useAnimatedStyle(() => ({ width: `${width.value * 100}%` }));

  // Each bar keeps its own band, even while the provider is blocked — the
  // ring and the banner carry the block (desktop TooltipCard does the same).
  const fill = bandColor(fraction ?? 0, colors);
  const reading =
    fraction != null
      ? usedCopy(fraction, derived)
      : window.remaining != null
        ? `${window.remaining} left`
        : window.used != null
          ? `${window.used} used`
          : "No reading";

  return (
    <View style={[styles.block, dimmed && styles.dimmed]}>
      <View style={styles.topLine}>
        <Text numberOfLines={1} style={[styles.label, { color: colors.label }]}>
          {window.label}
        </Text>
        <Text numberOfLines={1} style={[styles.reset, { color: colors.secondaryLabel }]}>
          {capitalize(resetCopy(window.resetsAt, now))}
        </Text>
      </View>
      {fraction != null ? (
        <View style={[styles.track, { backgroundColor: colors.barTrack }]}>
          <Animated.View style={[styles.fill, { backgroundColor: fill }, fillStyle]} />
        </View>
      ) : null}
      <Text style={[styles.used, { color: colors.label }]}>{reading}</Text>
    </View>
  );
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

const styles = StyleSheet.create({
  block: {
    gap: spacing(2),
  },
  dimmed: { opacity: 0.45 },
  topLine: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: spacing(3),
  },
  label: {
    fontSize: 15,
    fontWeight: "500",
    flexShrink: 1,
  },
  reset: {
    fontSize: 13,
    fontVariant: ["tabular-nums"],
    flexShrink: 1,
    textAlign: "right",
  },
  track: {
    height: 6,
    borderRadius: radius.pill,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    borderRadius: radius.pill,
  },
  used: {
    fontSize: 13,
    fontVariant: ["tabular-nums"],
  },
});
