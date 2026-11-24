/** One metered window, laid out exactly like a block of desktop codenotch's
 * hover card: label left and reset right, the bar, then "73% Used". The bar
 * grows in on mount; later readings move it without replaying, since the
 * user may be reading it. The fill is absolutely positioned and childless,
 * so animating its width re-lays-out nothing else — and keeps its rounded
 * end, which a scaleX would smear. */
import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring } from "react-native-reanimated";
import { radius, spacing, type ThemeColors } from "../theme";
import { bandColor } from "./usage-ring";
import { resetCopy, windowReading } from "../lib/format";
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
    width.set(reduceMotion ? target : withSpring(target, { duration: 500, dampingRatio: 1 }));
  }, [target, reduceMotion, width]);
  const animatedFill = useAnimatedStyle(() => ({ width: `${width.get() * 100}%` }));
  // Under Reduce Motion the bar never moves, so it is a plain style: a
  // one-off animated update can be lost under the card's own cross-fade
  // entrance, leaving the bar empty.
  const fillStyle = reduceMotion ? { width: `${target * 100}%` as const } : animatedFill;

  // Each bar keeps its own band, even while the provider is blocked — the
  // ring and the banner carry the block (desktop TooltipCard does the same).
  const fill = bandColor(fraction ?? 0, colors);
  const reading = windowReading(window, derived);

  return (
    <View style={[styles.block, dimmed && styles.dimmed]}>
      <View style={styles.topLine}>
        <Text numberOfLines={2} style={[styles.label, { color: colors.label }]}>
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

/** A provider's windows in the Mac's order. Where the Mac groups them
 * (Antigravity: "Gemini Models", "Claude and GPT models"), each group opens
 * with its name — the labels inside repeat across groups. */
export function WindowList({
  windows,
  now,
  colors,
  derived = false,
  dimmed = false,
}: {
  windows: LimitWindow[];
  now: Date;
  colors: ThemeColors;
  derived?: boolean;
  dimmed?: boolean;
}) {
  return (
    <>
      {windows.map((window, index) => {
        const group = window.group || null;
        const opensGroup = group != null && group !== (windows[index - 1]?.group || null);
        const row = <WindowRow window={window} now={now} colors={colors} derived={derived} dimmed={dimmed} />;
        if (!opensGroup) return <View key={window.id}>{row}</View>;
        return (
          <View key={window.id} style={styles.group}>
            <Text
              accessibilityRole="header"
              numberOfLines={1}
              style={[styles.groupLabel, { color: colors.secondaryLabel }, dimmed && styles.dimmed]}
            >
              {group}
            </Text>
            {row}
          </View>
        );
      })}
    </>
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
  group: {
    gap: spacing(3),
  },
  groupLabel: {
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
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
  // The reset is short and always whole ("Resets Tue 12:00 AM"); a long
  // label wraps instead of either being cut.
  reset: {
    fontSize: 13,
    fontVariant: ["tabular-nums"],
    flexShrink: 0,
    textAlign: "right",
  },
  track: {
    height: 6,
    borderRadius: radius.pill,
    overflow: "hidden",
  },
  fill: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    borderRadius: radius.pill,
  },
  used: {
    fontSize: 13,
    fontVariant: ["tabular-nums"],
  },
});
