/** Loading placeholders shaped like the screens they stand in for — the
 * layout never jumps when data lands. A quiet opacity pulse says "working";
 * still under Reduce Motion. */
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useReducedMotion } from "react-native-reanimated";
import { notch, radius, spacing, useTheme } from "../../theme";
import { useGentlePulse } from "./motion";

function Block({
  width,
  height,
  round = false,
  color,
  style,
}: {
  width?: number | `${number}%`;
  height: number;
  round?: boolean;
  color?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const colors = useTheme();
  const reduceMotion = useReducedMotion();
  const pulse = useGentlePulse(reduceMotion, 0.45, 900);
  const animated = useAnimatedStyle(() => ({ opacity: pulse.value }));
  return (
    <Animated.View
      style={[
        { width, height, borderRadius: round ? height / 2 : radius.pill, backgroundColor: color ?? colors.ringTrack },
        reduceMotion ? { opacity: 0.45 } : animated,
        style,
      ]}
    />
  );
}

/** Rings: the notch with empty tracks, then two provider cards. */
export function RingsSkeleton() {
  const colors = useTheme();
  return (
    <>
      <View style={[styles.notch, colors.scheme === "dark" && styles.notchEdge]}>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={styles.notchCell}>
            <View style={[styles.ringTrack, { borderColor: notch.ringTrack }]} />
            <Block width={34} height={12} color={notch.ringTrack} />
          </View>
        ))}
      </View>
      {[0, 1].map((card) => (
        <View key={card} style={[styles.card, { backgroundColor: colors.card }]}>
          <View style={styles.cardHeader}>
            <Block width={20} height={20} round />
            <Block width="42%" height={14} />
          </View>
          {[0, 1].map((row) => (
            <View key={row} style={styles.windowLines}>
              <View style={styles.windowTop}>
                <Block width="36%" height={13} />
                <Block width="28%" height={11} />
              </View>
              <Block width="100%" height={6} />
              <Block width="22%" height={11} />
            </View>
          ))}
        </View>
      ))}
    </>
  );
}

/** Sessions: the chips strip, then a section card of dot-and-two-line rows. */
export function SessionsSkeleton() {
  const colors = useTheme();
  return (
    <>
      <View style={styles.chips}>
        <Block width={92} height={30} round />
        <Block width={92} height={30} round />
        <Block width={70} height={30} round />
      </View>
      {[0, 1].map((section) => (
        <View key={section}>
          <Block width={96} height={12} style={styles.sectionTitle} />
          <View style={[styles.card, styles.flushCard, { backgroundColor: colors.card }]}>
            {[0, 1].map((row) => (
              <View key={row} style={styles.row}>
                <Block width={10} height={10} round style={styles.rowDot} />
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
      <View>
        <Block width={110} height={12} style={styles.sectionTitle} />
        <View style={[styles.card, styles.flushCard, { backgroundColor: colors.card }]}>
          {[0, 1, 2].map((row) => (
            <View key={row} style={[styles.row, styles.settingsRow]}>
              <Block width="30%" height={15} />
              <Block width="24%" height={13} />
            </View>
          ))}
        </View>
      </View>
      <View>
        <Block width={90} height={12} style={styles.sectionTitle} />
        <View style={[styles.card, styles.flushCard, { backgroundColor: colors.card }]}>
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
  notch: {
    flexDirection: "row",
    justifyContent: "space-around",
    backgroundColor: notch.background,
    borderRadius: radius.notch,
    borderCurve: "continuous",
    paddingTop: spacing(5),
    paddingBottom: spacing(4.5),
    paddingHorizontal: spacing(2),
  },
  notchEdge: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.1)",
  },
  notchCell: {
    flex: 1,
    alignItems: "center",
    gap: spacing(3),
  },
  ringTrack: {
    width: 58,
    height: 58,
    borderRadius: 29,
    borderWidth: 58 * 0.1325,
  },
  card: {
    borderRadius: radius.card,
    borderCurve: "continuous",
    padding: spacing(4),
    gap: spacing(4),
  },
  flushCard: {
    padding: 0,
    gap: 0,
    overflow: "hidden",
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(2.5),
  },
  windowLines: {
    gap: spacing(2),
  },
  windowTop: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  chips: {
    flexDirection: "row",
    gap: spacing(2),
  },
  sectionTitle: {
    marginBottom: spacing(2),
    marginLeft: spacing(4),
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(3),
    paddingVertical: spacing(3.5),
    paddingHorizontal: spacing(4),
  },
  rowDot: {
    marginHorizontal: 4,
  },
  settingsRow: {
    justifyContent: "space-between",
  },
  lines: {
    flex: 1,
    gap: spacing(1.5),
  },
});
