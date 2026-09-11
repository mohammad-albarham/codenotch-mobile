/** The at-a-glance strip on Sessions: one compact chip per tempo — waiting,
 * working, idle — with a status dot and a tabular count. Zero counts stay
 * visible but dim, so the strip never jumps as sessions come and go. */
import { StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle, useReducedMotion } from "react-native-reanimated";
import { useTheme } from "../../theme";
import { radius, spacing } from "../../theme";
import { reflow, useGentlePulse, useRiseIn } from "./motion";

export interface SessionCounts {
  waiting: number;
  busy: number;
  idle: number;
}

export function SummaryChips({ counts }: { counts: SessionCounts }) {
  const colors = useTheme();
  const riseIn = useRiseIn();
  return (
    <Animated.View style={styles.row} entering={riseIn(0)} layout={reflow}>
      <Chip
        dotColor={colors.watch}
        pulse
        dim={counts.waiting === 0}
        count={counts.waiting}
        label="waiting"
      />
      <Chip dotColor={colors.ample} dim={counts.busy === 0} count={counts.busy} label="working" />
      <Chip
        dotColor={colors.tertiaryLabel}
        dim={counts.idle === 0}
        count={counts.idle}
        label="idle"
      />
    </Animated.View>
  );
}

function Chip({
  count,
  label,
  dotColor,
  dim,
  pulse = false,
}: {
  count: number;
  label: string;
  dotColor: string;
  dim: boolean;
  pulse?: boolean;
}) {
  const colors = useTheme();
  const reduceMotion = useReducedMotion();
  // Only a live "waiting" chip breathes; the others never start a loop.
  const opacity = useGentlePulse(pulse && !dim, reduceMotion, 0.4, 1200);
  const dotStyle = useAnimatedStyle(() => ({ opacity: opacity.get() }));
  return (
    <View style={[styles.chip, { backgroundColor: colors.card }]}>
      <Animated.View
        style={[
          styles.dot,
          { backgroundColor: dotColor },
          dim && { opacity: 0.35 },
          !dim && pulse && dotStyle,
        ]}
      />
      <Text
        style={[
          styles.count,
          { color: dim ? colors.tertiaryLabel : colors.label },
        ]}
      >
        {count}
      </Text>
      <Text style={[styles.label, { color: dim ? colors.tertiaryLabel : colors.secondaryLabel }]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing(2),
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(1.5),
    borderRadius: radius.pill,
    borderCurve: "continuous",
    paddingHorizontal: spacing(2.5),
    paddingVertical: spacing(1.25),
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 7,
  },
  count: {
    fontSize: 13,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  label: {
    fontSize: 12,
    fontWeight: "500",
  },
});
