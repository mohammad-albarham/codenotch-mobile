/** One agent session: is it working, waiting on you, or done? A waiting row
 * gets a steady amber dot with a slow, soft ping — urgent, but calm. */
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming, useReducedMotion } from "react-native-reanimated";
import { useEffect } from "react";
import { useTheme } from "../theme";
import { spacing } from "../theme";
import { ageCopy } from "../lib/format";
import type { AgentSession } from "../lib/types";

export function SessionRow({ session, now }: { session: AgentSession; now: Date }) {
  const colors = useTheme();
  const reduceMotion = useReducedMotion();
  const ping = useSharedValue(0);

  useEffect(() => {
    if (session.state === "waiting" && !reduceMotion) {
      ping.value = 0;
      ping.value = withRepeat(
        withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.quad) }),
        -1,
        false,
      );
    } else {
      ping.value = 0;
    }
  }, [session.state, reduceMotion, ping]);

  const pingStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + ping.value * 1.3 }],
    opacity: 0.4 * (1 - ping.value),
  }));

  return (
    <View style={styles.row}>
      <View style={styles.indicator}>
        {session.state === "busy" ? (
          <ActivityIndicator size="small" color={colors.accent} />
        ) : session.state === "waiting" ? (
          <View style={styles.dotWell}>
            <Animated.View style={[styles.dot, styles.ping, { backgroundColor: colors.watch }, pingStyle]} />
            <View style={[styles.dot, { backgroundColor: colors.watch }]} />
          </View>
        ) : (
          <View style={[styles.dot, { backgroundColor: colors.tertiaryLabel, opacity: 0.55 }]} />
        )}
      </View>

      <View style={styles.texts}>
        <View style={styles.nameLine}>
          <Text numberOfLines={1} style={[styles.name, { color: colors.label }]}>
            {session.name}
          </Text>
          <Text numberOfLines={1} style={[styles.since, { color: colors.tertiaryLabel }]}>
            {session.state === "waiting"
              ? "waiting on you"
              : session.state === "busy"
                ? "working"
                : `idle · ${ageCopy(session.since, now)}`}
          </Text>
        </View>
        <Text numberOfLines={1} style={[styles.detail, { color: colors.secondaryLabel }]}>
          {session.detail}
        </Text>
        {session.state === "waiting" && session.waitingFor ? (
          <Text numberOfLines={1} style={[styles.waitingFor, { color: colors.watch }]}>
            {session.waitingFor}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: spacing(3),
    paddingVertical: spacing(3),
    paddingHorizontal: spacing(4),
    alignItems: "center",
  },
  indicator: {
    width: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  dotWell: {
    width: 11,
    height: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  dot: {
    width: 11,
    height: 11,
    borderRadius: 11,
  },
  ping: {
    position: "absolute",
    top: 0,
    left: 0,
  },
  texts: {
    flex: 1,
    gap: 1,
  },
  nameLine: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: spacing(2),
  },
  name: {
    fontSize: 15,
    fontWeight: "600",
    flexShrink: 1,
  },
  since: {
    fontSize: 12,
    fontVariant: ["tabular-nums"],
    flexShrink: 0,
  },
  detail: {
    fontSize: 13,
  },
  waitingFor: {
    fontSize: 13,
    fontWeight: "600",
  },
});
