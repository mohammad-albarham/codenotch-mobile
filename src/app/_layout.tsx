/**
 * Root navigation. Pairing is a one-way door: `Stack.Protected` removes the
 * pair screen from the stack once paired and removes the app when not, so
 * back can never re-enter the old state — and the guard flip is the
 * navigation: nothing else pushes or replaces across the door, so the
 * crossing happens exactly once. The splash is held until the stored
 * connection has resolved — a cold start never flashes pairing before Home.
 */
import { useEffect } from "react";
import { AppState, Platform } from "react-native";
import { StatusBar } from "expo-status-bar";
import { DarkTheme, DefaultTheme, ThemeProvider, Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import * as SystemUI from "expo-system-ui";
import { QueryClient, QueryClientProvider, focusManager } from "@tanstack/react-query";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { ConnectionProvider, useConnection } from "../state/connection";
import { useTheme, type ThemeColors } from "../theme";

SplashScreen.preventAutoHideAsync().catch(() => {});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
    },
  },
});

// React Native has no window focus: tell TanStack Query when the app comes
// to the foreground, so a phone picked up after an hour catches up at once
// and the minute poll rests while the app is in the background.
focusManager.setEventListener((setFocused) => {
  const sub = AppState.addEventListener("change", (state) => {
    if (Platform.OS !== "web") setFocused(state === "active");
  });
  return () => sub.remove();
});

function navTheme(colors: ThemeColors) {
  const base = colors.scheme === "dark" ? DarkTheme : DefaultTheme;
  return {
    ...base,
    colors: {
      ...base.colors,
      primary: colors.accent,
      background: colors.background,
      card: colors.card,
      text: colors.label,
      border: colors.separator,
    },
  };
}

export default function RootLayout() {
  const colors = useTheme();

  // The window behind every screen wears the theme's own background, so a
  // crossfade passes through the app's color rather than the native root's
  // black — no dark dip between two light screens.
  useEffect(() => {
    SystemUI.setBackgroundColorAsync(colors.background).catch(() => {});
  }, [colors.background]);

  return (
    <SafeAreaProvider>
      {/* The keyboard's real position, frame by frame, for anything that
      rides it. The app is edge-to-edge on Android: the bars stay
      translucent, so the provider must not repaint them. */}
      <KeyboardProvider statusBarTranslucent navigationBarTranslucent preserveEdgeToEdge>
        <QueryClientProvider client={queryClient}>
          <ConnectionProvider>
            <ThemeProvider value={navTheme(colors)}>
              <RootNavigator />
            </ThemeProvider>
          </ConnectionProvider>
        </QueryClientProvider>
      </KeyboardProvider>
    </SafeAreaProvider>
  );
}

function RootNavigator() {
  const { status } = useConnection();
  const colors = useTheme();

  useEffect(() => {
    if (status === "loading") return;
    SplashScreen.hideAsync().catch(() => {});
  }, [status]);

  if (status === "loading") {
    return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }} />;
  }

  // Pairing and the app are two states, not two levels: crossing between
  // them fades, never slides — a slide would promise a back that isn't there.
  return (
    <>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false, animation: "fade", contentStyle: { backgroundColor: colors.background } }}>
        <Stack.Protected guard={status === "paired"}>
          <Stack.Screen name="(tabs)" />
        </Stack.Protected>
        <Stack.Protected guard={status === "unpaired"}>
          <Stack.Screen name="pair" />
          <Stack.Screen name="scan" options={{ presentation: "fullScreenModal", animation: "slide_from_bottom" }} />
        </Stack.Protected>
      </Stack>
    </>
  );
}
