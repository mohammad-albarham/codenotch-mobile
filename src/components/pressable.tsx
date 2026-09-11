/** Press feedback that lands on press-in. Cards and rings scale (0.97, a
 * strong ease-out under 150 ms) and spring home on release — interrupted
 * mid-press, the spring carries on from where the card is. Under Reduce
 * Motion the scale becomes a dim. List rows get a background highlight,
 * never scale: it lands at once and fades out as a table row's does. All of
 * it runs on the UI thread — a press never waits on a React render. A finger
 * drifting a few points while held doesn't cancel the press.
 *
 * Everything pressable here lives in a scroll view, so feedback waits out
 * the scroll view's own decision, as UIKit's does: a touch that turns into a
 * scroll within PRESS_DELAY_MS never presses, and the card under the finger
 * doesn't flinch as the list starts moving. A quick tap still shows its full
 * press — React Native holds pressed state for at least 130 ms. */
import { Pressable, StyleSheet, type Insets, type PressableProps, type StyleProp, type ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { easeOut } from "./flows/motion";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const RETENTION: Insets = { top: 16, left: 16, right: 16, bottom: 16 };
const PRESS_DELAY_MS = 90;

type Props = Omit<PressableProps, "style"> & { children?: React.ReactNode; style?: StyleProp<ViewStyle> };

export function PressableScale({ children, style, scaleTo = 0.97, ...props }: Props & { scaleTo?: number }) {
  const pressed = useSharedValue(0);
  const reduceMotion = useReducedMotion();
  const animated = useAnimatedStyle(() => ({
    transform: [{ scale: reduceMotion ? 1 : 1 - pressed.get() * (1 - scaleTo) }],
    opacity: reduceMotion ? 1 - pressed.get() * 0.25 : 1,
  }));

  return (
    <AnimatedPressable
      pressRetentionOffset={RETENTION}
      unstable_pressDelay={PRESS_DELAY_MS}
      {...props}
      onPressIn={(event) => {
        pressed.set(withTiming(1, { duration: 120, easing: easeOut }));
        props.onPressIn?.(event);
      }}
      onPressOut={(event) => {
        pressed.set(withSpring(0, { duration: 300, dampingRatio: 1 }));
        props.onPressOut?.(event);
      }}
      style={[style, animated]}
    >
      {children}
    </AnimatedPressable>
  );
}

/** A card-sized PressableScale. */
export const PressableCard = PressableScale;

export function PressableRow({
  children,
  style,
  highlightColor = "rgba(127,127,127,0.14)",
  ...props
}: Props & { highlightColor?: string }) {
  const pressed = useSharedValue(0);
  const highlight = useAnimatedStyle(() => ({ opacity: pressed.get() }));
  return (
    <Pressable
      pressRetentionOffset={RETENTION}
      unstable_pressDelay={PRESS_DELAY_MS}
      {...props}
      onPressIn={(event) => {
        pressed.set(withTiming(1, { duration: 60, easing: easeOut }));
        props.onPressIn?.(event);
      }}
      onPressOut={(event) => {
        pressed.set(withTiming(0, { duration: 240, easing: easeOut }));
        props.onPressOut?.(event);
      }}
      style={style}
    >
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { backgroundColor: highlightColor }, highlight]}
      />
      {children}
    </Pressable>
  );
}
