/** Loading placeholders shaped like the screens they stand in for — the
 * layout never jumps when data lands. A quiet opacity pulse says "working";
 * still under Reduce Motion. */
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useReducedMotion } from "react-native-reanimated";
import { useTheme } from "../../theme";
import { radius, spacing } from "../../theme";
import { useGentlePulse } from "./motion";

function Block({ width, height, round = false, style }: {
  width?: number | `${number}%`;
  height: number;
  round?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const colors = useTheme();
  const reduceMotion = useReducedMotion();
  const pulse = useGentlePulse(reduceMotion, 0.45, 900);
  const animated = useAnimatedStyle(() => ({ opacity: pulse.value }));
  return (
    <Animated.View
      style={[
        animated,
        {
          width,
          height,
          borderRadius: round ? height / 2 : radius.pill,
          backgroundColor: colors.ringTrack,
        },
        reduceMotion && { opacity: 0.45 },
        style,
      ]}
    />
  );
}

/** Sessions: the chips strip, then section cards of dot-and-two-line rows. */
export function SessionsSkeleton() {
  const colors = useTheme();
  return (
    <>
      <View style={styles.chips}>
        <Block width={92} height={26} round />
        <Block width={92} height={26} round />
        <Block width={70} height={26} round />
      </View>
      {[0, 1].map((section) => (
        <View key={section}>
          <Block width={96} height={12} style={{ marginBottom: spacing(1.5), marginTop: spacing(1) }} />
          <View style={[styles.card, { backgroundColor: colors.card }]}>
            {[0, 1].map((row) => (
              <View key={row} style={styles.row}>
                <Block width={11} height={11} round style={{ marginHorizontal: 7.5 }} />
                <View style={styles.lines}>
                  <Block width="58%" height={13} />
                  <Block width="38%" height={11} />
                </View>
              </View>
            ))}
          </View>
        </View>
      ))}
    </>
  );
}

/** Settings: the connection group, then the readings group with its plates. */
export function SettingsSkeleton() {
  const colors = useTheme();
  return (
    <>
      <View style={styles.section}>
        <Block width={110} height={12} style={{ marginBottom: spacing(1.5) }} />
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          {[0, 1, 2].map((row) => (
            <View key={row} style={[styles.row, styles.settingsRow]}>
              <Block width="30%" height={15} />
              <Block width="24%" height={13} />
            </View>
          ))}
        </View>
      </View>
      <View style={styles.section}>
        <Block width={90} height={12} style={{ marginBottom: spacing(1.5) }} />
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          {[0, 1].map((row) => (
            <View key={row} style={[styles.row, styles.settingsRow]}>
              <Block width={30} height={30} round />
              <View style={styles.lines}>
                <Block width="34%" height={14} />
                <Block width="72%" height={11} />
              </View>
            </View>
          ))}
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  chips: {
    flexDirection: "row",
    gap: spacing(2),
    marginBottom: spacing(2),
  },
  section: {
    marginTop: spacing(2),
  },
  card: {
    borderRadius: radius.card,
    borderCurve: "continuous",
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(3),
    paddingVertical: spacing(3),
  },
  settingsRow: {
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(3.5),
  },
  lines: {
    flex: 1,
    gap: spacing(1.5),
  },
});
