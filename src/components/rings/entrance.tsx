/**
 * A block on a live screen: it rises in (a fade + 8px rise, under 250ms, on
 * the strong ease-out curve) when it first appears, fades out when it goes,
 * and glides when a sibling above it comes or goes — a banner arriving
 * mid-read must not shove the cards under the user's eye. Under Reduce
 * Motion the rise becomes a cross-fade and the glide is immediate.
 */
import type { StyleProp, ViewStyle } from "react-native";
import Animated from "react-native-reanimated";
import { fadeOut, reflow, useRiseIn } from "../flows/motion";

export function Entrance({
  index = 0,
  children,
  style,
}: {
  index?: number;
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const riseIn = useRiseIn();
  return (
    <Animated.View entering={riseIn(index)} exiting={fadeOut} layout={reflow} style={style}>
      {children}
    </Animated.View>
  );
}
