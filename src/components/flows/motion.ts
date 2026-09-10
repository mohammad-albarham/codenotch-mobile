/** Shared motion primitives for the flows screens. Entrances run once, on
 * first load; loops stay quiet enough to live next to data. */
import { useEffect } from "react";
import { Easing, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";

/** The one entrance curve — a fast ease-out that settles, never bounces. */
export const easeOut = Easing.bezier(0.23, 1, 0.32, 1);

/**
 * A quiet opacity pulse between `low` and 1, used for "alive but calm"
 * indicators (stale dots, skeleton blocks). Under Reduce Motion it holds
 * still at 1; callers that want a dimmed static state layer it themselves.
 */
export function useGentlePulse(reduceMotion: boolean, low = 0.45, periodMs = 1200) {
  const value = useSharedValue(1);
  useEffect(() => {
    if (reduceMotion) {
      value.value = 1;
      return;
    }
    value.value = withRepeat(
      withTiming(low, { duration: periodMs / 2, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
  }, [reduceMotion, low, periodMs, value]);
  return value;
}
