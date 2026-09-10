/** Each tab's own native stack. Roots get the iOS large title that collapses
 * on scroll; on iOS the bar is transparent so content scrolls under the
 * system's glass edge (screens use `contentInsetAdjustmentBehavior`). Android
 * keeps an opaque, inset header. Titles belong to the navigator. Pushes are
 * the platform's own, untouched; under Reduce Motion they crossfade, and the
 * back swipe runs the same fade under the finger. */
import { Stack } from "expo-router";
import { useReducedMotion } from "react-native-reanimated";
import { useTheme } from "../theme";

export function TabStack({ title, children }: { title: string; children?: React.ReactNode }) {
  const colors = useTheme();
  const reduceMotion = useReducedMotion();
  const ios = process.env.EXPO_OS === "ios";
  return (
    <Stack
      screenOptions={{
        animation: reduceMotion ? "fade" : "default",
        animationMatchesGesture: reduceMotion,
        headerTransparent: ios,
        headerShadowVisible: false,
        headerLargeTitleShadowVisible: false,
        headerStyle: ios ? undefined : { backgroundColor: colors.background },
        headerTintColor: colors.accent,
        headerTitleStyle: { color: colors.label },
        headerLargeTitleStyle: { color: colors.label },
        headerBackButtonDisplayMode: "minimal",
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="index" options={{ title, headerLargeTitleEnabled: true }} />
      {children}
    </Stack>
  );
}
