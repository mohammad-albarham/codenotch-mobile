/**
 * The usage ring — codenotch's signature, adapted for a phone.
 *
 * Track grey; the arc takes its band color (ample / watch / critical), washed
 * with a same-hue two-stop gradient for material depth — lightness only, no
 * new hues. On mount, and on every value change, the arc springs from the
 * previously shown value, so a reading never teleports. While an agent session
 * is working a thin arc spins inside the ring; when one is blocked waiting on
 * you a halo outside the ring breathes amber. A ring without a reading is
 * drawn empty — never an authoritative-looking 0%.
 */
import { useEffect, useId, useRef } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { Easing, useAnimatedProps, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withSpring, withTiming } from "react-native-reanimated";
import Svg, { Circle, Defs, LinearGradient, Stop } from "react-native-svg";
import { darken, lighten, type ThemeColors } from "../theme";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export type SessionOverlay = "busy" | "waiting" | null;

export function bandColor(usedFraction: number, colors: ThemeColors): string {
  if (usedFraction >= 0.9) return colors.critical;
  if (usedFraction >= 0.7) return colors.watch;
  return colors.ample;
}

export function UsageRing({
  value,
  size,
  colors,
  hasReading = true,
  dimmed = false,
  session,
}: {
  value: number | null; // 0..1+
  size: number;
  colors: ThemeColors;
  hasReading?: boolean;
  dimmed?: boolean;
  session?: SessionOverlay;
}) {
  const reduceMotion = useReducedMotion();
  const gradientId = `ring-grad-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const stroke = Math.max(4, size * 0.062);
  // Always reserve headroom for the overlays (spinner inside, halo outside) so
  // the ring's geometry never jumps when a session appears mid-life.
  const radius = (size - stroke * 2 - 6) / 2;
  const circumference = 2 * Math.PI * radius;

  const fraction = Math.min(1, Math.max(0, value ?? 0));
  const animatedFraction = useSharedValue(reduceMotion ? fraction : 0);
  const shownFractionRef = useRef<number | null>(null);

  useEffect(() => {
    if (shownFractionRef.current === fraction) return;
    const first = shownFractionRef.current === null;
    shownFractionRef.current = fraction;
    if (reduceMotion) {
      animatedFraction.value = fraction;
      return;
    }
    if (first) animatedFraction.value = 0; // mount: sweep up from the empty ring
    animatedFraction.value = withSpring(fraction, { duration: 700, dampingRatio: 1 });
  }, [fraction, reduceMotion, animatedFraction]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - animatedFraction.value),
  }));

  // Busy: a thin inner arc, faded in, spinning steadily.
  const spin = useSharedValue(0);
  const busyFade = useSharedValue(0);
  useEffect(() => {
    const active = session === "busy" && !reduceMotion;
    busyFade.value = withTiming(session === "busy" ? 1 : 0, { duration: 180, easing: Easing.bezier(0.23, 1, 0.32, 1) });
    if (active) {
      spin.value = withRepeat(withTiming(360, { duration: 1600, easing: Easing.linear }), -1, false);
    } else {
      spin.value = 0;
    }
  }, [session, reduceMotion, spin, busyFade]);

  // Waiting: a halo outside the track that breathes amber.
  const pulse = useSharedValue(1);
  const waitingFade = useSharedValue(0);
  useEffect(() => {
    const active = session === "waiting" && !reduceMotion;
    waitingFade.value = withTiming(session === "waiting" ? 1 : 0, { duration: 250, easing: Easing.bezier(0.23, 1, 0.32, 1) });
    if (active) {
      pulse.value = withRepeat(withTiming(0.1, { duration: 1100, easing: Easing.inOut(Easing.quad) }), -1, true);
    } else {
      pulse.value = 1;
    }
  }, [session, reduceMotion, pulse, waitingFade]);

  const spinStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.value}deg` }], opacity: busyFade.value }));
  const pulseStyle = useAnimatedStyle(() => ({
    opacity: waitingFade.value * pulse.value * (dimmed ? 0.4 : 0.9),
  }));
  const staticHaloStyle = useAnimatedStyle(() => ({ opacity: dimmed ? 0.4 * 0.55 : 0.55 }));

  const arcColor = value == null ? colors.ringTrack : bandColor(value, colors);
  const arcStroke = hasReading && value != null ? `url(#${gradientId})` : colors.ringTrack;
  const haloRadius = radius + stroke * 0.95;
  const spinnerRadius = radius - stroke * 0.85;
  const spinnerCircumference = 2 * Math.PI * spinnerRadius;

  return (
    <View style={[styles.wrap, { width: size, height: size, opacity: dimmed ? 0.45 : 1 }]}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Defs>
          {/* Painted in the circle's local space; the -90° rotation maps local
          right → screen top, so the arc starts light and deepens as it
          sweeps. Same hue, lightness only. */}
          <LinearGradient id={gradientId} gradientUnits="userSpaceOnUse" x1={size} y1={size / 2} x2={0} y2={size / 2}>
            <Stop offset="0" stopColor={lighten(arcColor, 0.22)} />
            <Stop offset="1" stopColor={darken(arcColor, 0.06)} />
          </LinearGradient>
        </Defs>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={colors.ringTrack}
          strokeWidth={stroke}
          fill="none"
        />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={arcStroke}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={circumference}
          animatedProps={animatedProps}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>

      {session === "busy" && (
        <Animated.View style={[StyleSheet.absoluteFill, spinStyle]}>
          <Svg width={size} height={size}>
            <Circle
              cx={size / 2}
              cy={size / 2}
              r={spinnerRadius}
              stroke={colors.secondaryLabel}
              strokeWidth={Math.max(2, stroke * 0.42)}
              fill="none"
              strokeLinecap="round"
              strokeDasharray={`${spinnerCircumference * 0.22} ${spinnerCircumference * 0.78}`}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
            />
          </Svg>
        </Animated.View>
      )}

      {session === "waiting" && !reduceMotion && (
        <Animated.View style={[StyleSheet.absoluteFill, pulseStyle]}>
          <Svg width={size} height={size}>
            <Circle
              cx={size / 2}
              cy={size / 2}
              r={haloRadius}
              stroke={colors.watch}
              strokeWidth={stroke * 0.5}
              fill="none"
              strokeLinecap="round"
            />
          </Svg>
        </Animated.View>
      )}
      {session === "waiting" && reduceMotion && (
        <Animated.View style={[StyleSheet.absoluteFill, staticHaloStyle]}>
          <Svg width={size} height={size}>
            <Circle
              cx={size / 2}
              cy={size / 2}
              r={haloRadius}
              stroke={colors.watch}
              strokeWidth={stroke * 0.5}
              fill="none"
            />
          </Svg>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", justifyContent: "center" },
});
