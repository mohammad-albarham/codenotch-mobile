/**
 * The usage ring — desktop codenotch's ProviderRing, at phone size.
 *
 * Geometry is the notch's, as proportions of the diameter: a thick grey track
 * (0.13 D) with a thinner arc (0.068 D) riding its centre line, starting at
 * 12 o'clock and sweeping clockwise by the fraction used, in its band color.
 * Whatever sits in the middle (the provider's mark, or a number) is passed as
 * children.
 *
 * - A new reading sweeps from the one shown before — a ring that snaps reads
 *   as a glitch, one that sweeps reads as a measurement being taken.
 * - Refreshing turns the arc exactly once, landing where the reading belongs:
 *   the thing being refetched is the thing that moves.
 * - Working: a thin neutral arc spins *inside* the track. Waiting on you: that
 *   inner ring pulses amber. Different radius, weight and color from the usage
 *   arc, so it reads as a separate fact.
 * - Stale dims the reading (not the activity, which is first-hand). Blocked or
 *   spent shows critical and dims the mark. No reading draws no arc — never an
 *   authoritative-looking 0%.
 */
import { useEffect, useRef, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle } from "react-native-svg";
import type { ThemeColors } from "../theme";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export type SessionOverlay = "busy" | "waiting" | null;

/** Desktop UsageBand thresholds — the frame shows 21% green, 52% yellow, 73%
 * orange, so the phone must too, or the two apps disagree about one reading. */
export function bandColor(usedFraction: number, colors: ThemeColors): string {
  if (usedFraction < 0.5) return colors.ample;
  if (usedFraction < 0.7) return colors.watch;
  return colors.critical;
}

export function UsageRing({
  value,
  size,
  colors,
  hasReading = true,
  dimmed = false,
  blocked = false,
  session = null,
  refreshing = false,
  children,
}: {
  value: number | null; // 0..1+
  size: number;
  colors: ThemeColors;
  hasReading?: boolean;
  dimmed?: boolean;
  blocked?: boolean;
  session?: SessionOverlay;
  refreshing?: boolean;
  children?: ReactNode;
}) {
  const reduceMotion = useReducedMotion();
  const trackStroke = size * 0.1325;
  const arcStroke = size * 0.068;
  const radius = (size - trackStroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  const drawArc = hasReading && value != null;
  const fraction = drawArc ? Math.min(1, Math.max(0, value)) : 0;
  const exhausted = blocked || (value != null && value >= 1);
  const arcColor = exhausted ? colors.critical : bandColor(fraction, colors);

  // Sweep from the value shown before; on mount, from the empty ring.
  const shown = useSharedValue(reduceMotion ? fraction : 0);
  const lastFraction = useRef<number | null>(null);
  useEffect(() => {
    if (lastFraction.current === fraction) return;
    lastFraction.current = fraction;
    shown.set(reduceMotion ? fraction : withSpring(fraction, { duration: 700, dampingRatio: 1 }));
  }, [fraction, reduceMotion, shown]);

  const arcProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - shown.get()),
  }));

  // One finite turn per refresh — 360° is 0°, so it lands on the reading.
  const turn = useSharedValue(0);
  useEffect(() => {
    if (!refreshing || reduceMotion) return;
    turn.set(
      withTiming(turn.get() + 360, {
        duration: 950,
        easing: Easing.bezier(0.32, 0, 0.14, 1),
      }),
    );
  }, [refreshing, reduceMotion, turn]);
  const turnStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.get()}deg` }] }));

  // The inner activity ring.
  const activityDiameter = size * 0.615;
  const activityStroke = Math.max(1.5, size * 0.047);
  const activityRadius = activityDiameter / 2;
  const activityCircumference = 2 * Math.PI * activityRadius;
  const spin = useSharedValue(0);
  const pulse = useSharedValue(1);
  useEffect(() => {
    cancelAnimation(spin);
    cancelAnimation(pulse);
    spin.set(0);
    pulse.set(1);
    if (reduceMotion) return;
    if (session === "busy") {
      spin.set(withRepeat(withTiming(360, { duration: 1100, easing: Easing.linear }), -1, false));
    } else if (session === "waiting") {
      pulse.set(withRepeat(withTiming(0.3, { duration: 900, easing: Easing.inOut(Easing.ease) }), -1, true));
    }
  }, [session, reduceMotion, spin, pulse]);
  const spinStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.get()}deg` }] }));
  const pulseStyle = useAnimatedStyle(() => ({ opacity: pulse.get() }));

  return (
    <View style={{ width: size, height: size }}>
      <View style={[StyleSheet.absoluteFill, dimmed && styles.dimmed]}>
        <Svg width={size} height={size}>
          <Circle cx={center} cy={center} r={radius} stroke={colors.ringTrack} strokeWidth={trackStroke} fill="none" />
        </Svg>
        {drawArc ? (
          <Animated.View style={[StyleSheet.absoluteFill, turnStyle]}>
            <Svg width={size} height={size}>
              <AnimatedCircle
                cx={center}
                cy={center}
                r={radius}
                stroke={arcColor}
                strokeWidth={arcStroke}
                fill="none"
                strokeLinecap="round"
                strokeDasharray={`${circumference} ${circumference}`}
                strokeDashoffset={circumference}
                animatedProps={arcProps}
                transform={`rotate(-90 ${center} ${center})`}
              />
            </Svg>
          </Animated.View>
        ) : null}
        <View style={[StyleSheet.absoluteFill, styles.center, exhausted && styles.spentMark]} pointerEvents="none">
          {children}
        </View>
      </View>

      {session === "busy" ? (
        <Animated.View style={[StyleSheet.absoluteFill, spinStyle]} pointerEvents="none">
          <Svg width={size} height={size}>
            <Circle
              cx={center}
              cy={center}
              r={activityRadius}
              stroke={colors.label}
              strokeWidth={activityStroke}
              fill="none"
              strokeLinecap="round"
              strokeDasharray={`${activityCircumference * 0.25} ${activityCircumference}`}
              transform={`rotate(-90 ${center} ${center})`}
            />
          </Svg>
        </Animated.View>
      ) : null}
      {session === "waiting" ? (
        <Animated.View style={[StyleSheet.absoluteFill, pulseStyle]} pointerEvents="none">
          <Svg width={size} height={size}>
            <Circle cx={center} cy={center} r={activityRadius} stroke={colors.watch} strokeWidth={activityStroke} fill="none" />
          </Svg>
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center" },
  dimmed: { opacity: 0.45 },
  spentMark: { opacity: 0.35 },
});
