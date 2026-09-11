/** Shared motion primitives. Entrances run when content the user is waiting
 * on arrives; reflows glide so a list that changes under the eye never jumps;
 * loops stay quiet enough to live next to data.
 *
 * Reduce Motion: spatial motion (the rise, the reflow glide) follows the
 * system setting, and the rise collapses to a plain cross-fade rather than a
 * hard cut. Fades are not motion, so they always run. */
import { useEffect } from "react";
import {
  Easing,
  FadeIn,
  FadeInDown,
  FadeOut,
  LinearTransition,
  ReduceMotion,
  cancelAnimation,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

/** The one entrance curve — a fast ease-out that settles, never bounces. */
export const easeOut = Easing.bezier(0.23, 1, 0.32, 1);
/** For things moving across the screen rather than arriving or leaving. */
export const easeInOut = Easing.bezier(0.77, 0, 0.175, 1);

const RISE = 8;
const STAGGER_MS = 45;
const riseCache = new Map<number, FadeInDown>();
const crossfadeCache = new Map<number, FadeIn>();

/** A fade and 8px rise under 250ms, delayed by `index` stagger steps.
 * Builders are cached — rebuilding one in render costs every re-render. */
export function riseIn(index = 0): FadeInDown {
  let builder = riseCache.get(index);
  if (!builder) {
    builder = FadeInDown.duration(240)
      .easing(easeOut)
      .withInitialValues({ opacity: 0, transform: [{ translateY: RISE }] })
      .delay(index * STAGGER_MS);
    riseCache.set(index, builder);
  }
  return builder;
}

/** The rise without the rise: what an entrance becomes under Reduce Motion. */
function crossfadeIn(index = 0): FadeIn {
  let builder = crossfadeCache.get(index);
  if (!builder) {
    builder = FadeIn.duration(200).easing(easeOut).delay(index * STAGGER_MS).reduceMotion(ReduceMotion.Never);
    crossfadeCache.set(index, builder);
  }
  return builder;
}

/** `riseIn`, or its cross-fade under Reduce Motion. */
export function useRiseIn(): (index?: number) => FadeInDown | FadeIn {
  return useReducedMotion() ? crossfadeIn : riseIn;
}

/** A row arriving inside a card that is already on screen — no rise, the
 * card is the frame of reference. */
export const fadeIn = FadeIn.duration(200).easing(easeOut).reduceMotion(ReduceMotion.Never);
/** Leaving is quicker than arriving: the user has already read it. */
export const fadeOut = FadeOut.duration(160).easing(easeOut).reduceMotion(ReduceMotion.Never);
/** Siblings closing or opening a gap. */
export const reflow = LinearTransition.duration(250).easing(easeInOut);

/**
 * A quiet opacity pulse between `low` and 1, used for "alive but calm"
 * indicators (waiting dots, skeleton blocks). Runs only while `active`; under
 * Reduce Motion it holds still at 1 — callers that want a dimmed static
 * state layer it themselves.
 */
export function useGentlePulse(active: boolean, reduceMotion: boolean, low = 0.45, periodMs = 1200) {
  const value = useSharedValue(1);
  useEffect(() => {
    if (!active || reduceMotion) {
      cancelAnimation(value);
      value.set(1);
      return;
    }
    value.set(withRepeat(withTiming(low, { duration: periodMs / 2, easing: Easing.inOut(Easing.quad) }), -1, true));
    return () => cancelAnimation(value);
  }, [active, reduceMotion, low, periodMs, value]);
  return value;
}
