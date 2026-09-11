/** Opens and closes a block by its height, with a fade — for content that
 * appears inside a column whose siblings must make room for it smoothly.
 * The growing height is itself the motion: on a centered column every block
 * re-centers frame by frame as it opens, the way they already follow the
 * keyboard, so no sibling needs a layout transition (which would chase a
 * keyboard-driven relayout frame by frame and fall behind).
 *
 * The height is animated only while the block moves. At rest the clip
 * carries its measured height as a plain style: an animated height left in
 * place keeps the UI thread re-rounding the centered column to the pixel
 * grid, and on Android the whole column shivers by a pixel for as long as
 * the block is open. The clip itself stays mounted throughout — swapping it
 * for another view at rest pops the column for a frame.
 *
 * The caller keeps rendering the content while `visible` turns false, so the
 * block collapses around what it said rather than going blank first. Under
 * Reduce Motion it cuts: a fade alone would still leave the column to jump. */
import { useEffect, useState, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { easeOut } from "./motion";

const OPEN_MS = 240;
const CLOSE_MS = 180;

export function Reveal({ visible, children }: { visible: boolean; children: ReactNode }) {
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(visible ? 1 : 0);
  const contentHeight = useSharedValue(0);
  const [measured, setMeasured] = useState(0);
  // The visibility the block last came to rest at. Until it matches
  // `visible`, the block is moving and its height is animated.
  const [settled, setSettled] = useState(visible);

  useEffect(() => {
    const target = visible ? 1 : 0;
    if (reduceMotion) {
      progress.set(target);
      setSettled(visible);
      return;
    }
    progress.set(
      withTiming(target, { duration: visible ? OPEN_MS : CLOSE_MS, easing: easeOut }, (finished) => {
        if (finished) scheduleOnRN(setSettled, visible);
      }),
    );
  }, [visible, reduceMotion, progress]);

  const animated = useAnimatedStyle(() => ({
    height: contentHeight.get() * progress.get(),
    opacity: progress.get(),
  }));
  const atRest = settled === visible;

  return (
    <Animated.View
      style={[styles.clip, atRest ? { height: visible ? measured : 0, opacity: visible ? 1 : 0 } : animated]}
      pointerEvents={visible ? "box-none" : "none"}
      accessibilityElementsHidden={!visible}
      importantForAccessibility={visible ? "auto" : "no-hide-descendants"}
    >
      <View
        style={styles.content}
        onLayout={(event) => {
          // Pixel-grid rounding can hand the content a height a pixel apart
          // depending on where the column sits; ignore it rather than feed it
          // back into the column's position.
          const height = event.nativeEvent.layout.height;
          if (Math.abs(height - measured) < 1) return;
          setMeasured(height);
          contentHeight.set(height);
        }}
      >
        {children}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  clip: { overflow: "hidden" },
  // Laid out at its natural height inside the clip, so it is measured while
  // the clip is still closed.
  content: { position: "absolute", top: 0, left: 0, right: 0 },
});
