/**
 * Root navigation. Pairing is a one-way door: `Stack.Protected` removes the
 * pair screen from the stack once paired and removes the app when not, so
 * back can never re-enter the old state. The splash is held until the stored
 * connection has resolved — a cold start never flashes pairing before Home.
 */
import { useEffect } from "react";
import { AppState, Platform } from "react-native";
import { StatusBar } from "expo-status-bar";
import { DarkTheme, DefaultTheme, ThemeProvider, Stack, usePathname, useRouter } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { QueryClient, QueryClientProvider, focusManager } from "@tanstack/react-query";
import { SafeAreaProvider } from "react-native-safe-area-context";
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
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <ConnectionProvider>
          <ThemeProvider value={navTheme(colors)}>
            <RootNavigator />
          </ThemeProvider>
        </ConnectionProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

function RootNavigator() {
  const { status } = useConnection();
  const colors = useTheme();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (status === "loading") return;
    SplashScreen.hideAsync().catch(() => {});
  }, [status]);

  // Land by state, and correct the stack if a guard flip left us stranded
  // (e.g. disconnect while deep in a provider screen).
  useEffect(() => {
    if (status === "paired" && pathname === "/pair") router.replace("/");
    if (status === "unpaired" && pathname !== "/pair") router.replace("/pair");
  }, [status, pathname, router]);

  if (status === "loading") {
    return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }} />;
  }

  return (
    <>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
        <Stack.Protected guard={status === "paired"}>
          <Stack.Screen name="(tabs)" />
        </Stack.Protected>
        <Stack.Protected guard={status === "unpaired"}>
          <Stack.Screen name="pair" />
        </Stack.Protected>
      </Stack>
    </>
  );
}
