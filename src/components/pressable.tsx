/** Press feedback that lands on press-in: cards scale 0.97 and pick up a
 * hairline border in label color at 8%; list rows get a background highlight,
 * never scale. */
import { useState } from "react";
import { Pressable, PressableProps, StyleSheet, StyleProp, ViewStyle } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withSpring, withTiming, useReducedMotion } from "react-native-reanimated";
import { useTheme, rgba } from "../theme";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type CardProps = Omit<PressableProps, "style"> & { children?: React.ReactNode; style?: StyleProp<ViewStyle> };

export function PressableCard({ children, style, ...props }: CardProps) {
  const pressed = useSharedValue(0);
  const reduceMotion = useReducedMotion();
  const colors = useTheme();

  // Discrete border flip rather than color interpolation — at 8% hairline the
  // step is imperceptible, and plain strings keep the worklet bulletproof.
  const animated = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - pressed.value * 0.03 }],
    opacity: 1 - pressed.value * 0.1,
    borderColor: pressed.value > 0.5 ? rgba(colors.label, 0.08) : "rgba(0,0,0,0)",
  }));

  return (
    <AnimatedPressable
      {...props}
      onPressIn={(event) => {
        pressed.value = reduceMotion
          ? withTiming(1, { duration: 0 })
          : withTiming(1, { duration: 120, easing: Easing.bezier(0.23, 1, 0.32, 1) });
        props.onPressIn?.(event);
      }}
      onPressOut={(event) => {
        pressed.value = withSpring(0, { duration: 300, dampingRatio: 1 });
        props.onPressOut?.(event);
      }}
      style={[styles.cardPress, animated, style]}
    >
      {children}
    </AnimatedPressable>
  );
}

export function PressableRow({
  children,
  style,
  highlightColor = "rgba(127,127,127,0.14)",
  ...props
}: CardProps & { highlightColor?: string }) {
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

const styles = StyleSheet.create({
  // Hairline, transparent at rest, tinted on press-in — never a layout shift.
  cardPress: { borderWidth: StyleSheet.hairlineWidth },
});
