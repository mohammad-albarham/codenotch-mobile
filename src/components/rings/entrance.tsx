/**
 * Entrance motion: a fade + 8px rise, under 300ms, on the strong ease-out
 * curve. Under Reduce Motion it renders its children plainly. A module-level
 * `onceGuard` lets a screen play its stagger exactly once per app session —
 * remounts (navigating back) stay still.
 */
import { useEffect } from "react";
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withTiming } from "react-native-reanimated";

const RISE = 8;
const DURATION = 240;
const STAGGER_MS = 45;

const playedKeys = new Set<string>();

/** True the first time a key is asked, false forever after — the "first load
 * only" gate. Call it once at module scope of a screen, never inside render. */
export function onceGuard(key: string): boolean {
  if (playedKeys.has(key)) return false;
  playedKeys.add(key);
  return true;
}

export function Entrance({
  index = 0,
  children,
  style,
}: {
  index?: number;
  children?: React.ReactNode;
  style?: object;
}) {
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(reduceMotion ? 1 : 0);

  useEffect(() => {
    if (reduceMotion) {
      progress.value = 1;
      return;
    }
    progress.value = withDelay(
      index * STAGGER_MS,
      withTiming(1, { duration: DURATION, easing: Easing.bezier(0.23, 1, 0.32, 1) }),
    );
  }, [index, reduceMotion, progress]);

  const animated = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: RISE * (1 - progress.value) }],
  }));

  return <Animated.View style={[animated, style]}>{children}</Animated.View>;
}
