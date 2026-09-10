/** Press feedback that lands on press-in. Cards and rings scale (0.97, a
 * strong ease-out under 150 ms) and spring home on release; list rows get a
 * background highlight, never scale. */
import { useState } from "react";
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from "react-native";
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from "react-native-reanimated";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Props = Omit<PressableProps, "style"> & { children?: React.ReactNode; style?: StyleProp<ViewStyle> };

export function PressableScale({ children, style, scaleTo = 0.97, ...props }: Props & { scaleTo?: number }) {
  const pressed = useSharedValue(0);
  const reduceMotion = useReducedMotion();
  const animated = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - pressed.value * (1 - scaleTo) }],
    opacity: reduceMotion ? 1 - pressed.value * 0.25 : 1,
  }));

  return (
    <AnimatedPressable
      {...props}
      onPressIn={(event) => {
        pressed.value = withTiming(1, { duration: 120, easing: Easing.bezier(0.23, 1, 0.32, 1) });
        props.onPressIn?.(event);
      }}
      onPressOut={(event) => {
        pressed.value = withSpring(0, { duration: 300, dampingRatio: 1 });
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
  const [highlighted, setHighlighted] = useState(false);
  return (
    <Pressable
      {...props}
      onPressIn={(event) => {
        setHighlighted(true);
        props.onPressIn?.(event);
      }}
      onPressOut={(event) => {
        setHighlighted(false);
        props.onPressOut?.(event);
      }}
      style={[style, highlighted && { backgroundColor: highlightColor }]}
    >
      {children}
    </Pressable>
  );
}
