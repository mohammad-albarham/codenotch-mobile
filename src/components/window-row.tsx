/** One metered window on the detail screen: label, the both-ends summary,
 * the reset, and a bar. The bar springs to its width on mount — a reading
 * arriving should feel like it flows in, not pop. */
import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring } from "react-native-reanimated";
import { useTheme } from "../theme";
import { radius, spacing } from "../theme";
import { bandColor } from "./usage-ring";
import { resetCopy, windowSummary } from "../lib/format";
import type { LimitWindow } from "../lib/types";

export function WindowRow({ window, now, dimmed }: { window: LimitWindow; now: Date; dimmed?: boolean }) {
  const colors = useTheme();
  const reduceMotion = useReducedMotion();
  const fraction = window.usedFraction;
  const showBar = fraction != null;
  const pct = Math.min(100, Math.max(2, (fraction ?? 0) * 100));

  const grow = useSharedValue(reduceMotion ? 1 : 0);
  useEffect(() => {
    if (reduceMotion) {
      grow.value = 1;
      return;
    }
    grow.value = withSpring(1, { duration: 400, dampingRatio: 1 });
    // Mount-only on purpose: later data changes move the bar instantly, since
    // the user may be reading it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const barStyle = useAnimatedStyle(() => ({ width: `${grow.value * pct}%` }));

  return (
    <View style={[styles.row, dimmed && { opacity: 0.45 }]}>
      <View style={styles.topLine}>
        <Text numberOfLines={1} style={[styles.label, { color: colors.label }]}>
          {window.label}
        </Text>
        <Text style={[styles.summary, { color: colors.secondaryLabel }]}>
          {fraction != null ? windowSummary(fraction) : window.remaining != null ? `${window.remaining} left` : window.used != null ? `${window.used} used` : "No reading"}
        </Text>
      </View>

      {showBar && (
        <View style={[styles.barTrack, { backgroundColor: colors.ringTrack }]}>
          <Animated.View
            style={[
              styles.barFill,
              { backgroundColor: bandColor(fraction!, colors) },
              barStyle,
            ]}
          />
        </View>
      )}

      <Text style={[styles.reset, { color: colors.tertiaryLabel }]}>{resetCopy(window.resetsAt, now)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    gap: spacing(1.5),
    paddingVertical: spacing(2.5),
  },
  topLine: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: spacing(2),
  },
  label: {
    fontSize: 15,
    fontWeight: "500",
    flexShrink: 1,
  },
  summary: {
    fontSize: 13,
    fontVariant: ["tabular-nums"],
  },
  barTrack: {
    height: 6,
    borderRadius: radius.pill,
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    borderRadius: radius.pill,
  },
  reset: {
    fontSize: 12,
    fontVariant: ["tabular-nums"],
  },
});
