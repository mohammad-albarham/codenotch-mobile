/**
 * Root navigation. Pairing is a one-way door: `Stack.Protected` removes the
 * pair screen from the stack once paired and removes the app when not, so
 * back can never re-enter the old state. The splash is held until the stored
 * connection has resolved — a cold start never flashes pairing before Home.
 */
import { useEffect, useMemo } from "react";
import { StatusBar } from "expo-status-bar";
import { DarkTheme, DefaultTheme, ThemeProvider, Stack, usePathname, useRouter } from "expo-router";
import { useColorScheme } from "react-native";
import * as SplashScreen from "expo-splash-screen";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ConnectionProvider, useConnection } from "../state/connection";

SplashScreen.preventAutoHideAsync().catch(() => {});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
    },
  },
});

const LightNav = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: "#14813F",
    background: "#F2F2F7",
    card: "#FFFFFF",
    text: "#0A0A0C",
    border: "#E3E3E8",
  },
};

const DarkNav = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: "#30D158",
    background: "#000000",
    card: "#1A1A1E",
    text: "#F2F2F7",
    border: "#2A2A30",
  },
};

export default function RootLayout() {
  const scheme = useColorScheme();
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <ConnectionProvider>
          <ThemeProvider value={scheme === "dark" ? DarkNav : LightNav}>
            <RootNavigator />
          </ThemeProvider>
        </ConnectionProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

function RootNavigator() {
  const { status } = useConnection();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (status === "loading") return;
    SplashScreen.hideAsync().catch(() => {});
  }, [status]);

  // Land by state, and correct the stack if a guard flip left us stranded
  // (e.g. disconnect while deep in a provider screen).
  useEffect(() => {
    if (status === "loading") return;
    if (status === "paired" && (pathname === "/pair" || pathname === "/")) {
      router.replace("/(tabs)");
    }
    if (status === "unpaired" && pathname !== "/pair") {
      router.replace("/pair");
    }
  }, [status, pathname, router]);

  if (status === "loading") {
    return <Stack screenOptions={{ headerShown: false }} />;
  }

  return (
    <>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Protected guard={status === "paired"}>
          <Stack.Screen name="(tabs)" />
        </Stack.Protected>
        <Stack.Protected guard={status === "unpaired"}>
          <Stack.Screen name="pair" />
        </Stack.Protected>
        <Stack.Screen
          name="provider/[id]"
          options={{
            headerShown: true,
            headerBackTitle: "Rings",
          }}
        />
      </Stack>
    </>
  );
}
