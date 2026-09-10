/** Each tab's own native stack. Roots get the iOS large title that collapses
 * on scroll; on iOS the bar is transparent so content scrolls under the
 * system's glass edge (screens use `contentInsetAdjustmentBehavior`). Android
 * keeps an opaque, inset header. Titles belong to the navigator. */
import { Stack } from "expo-router";
import { useTheme } from "../theme";

export function TabStack({ title, children }: { title: string; children?: React.ReactNode }) {
  const colors = useTheme();
  const ios = process.env.EXPO_OS === "ios";
  return (
    <Stack
      screenOptions={{
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
