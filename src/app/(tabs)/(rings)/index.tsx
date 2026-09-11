/** Rings — the answer at a glance, laid out like desktop codenotch: the notch
 * with every provider's ring, then each provider's card as the notch's hover
 * card shows it. And whether an agent is working, done, or waiting on you. */
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import Animated, { useAnimatedStyle, useReducedMotion } from "react-native-reanimated";
import { radius, rgba, spacing, useTheme } from "../../../theme";
import { usePullToRefresh, useSnapshot } from "../../../state/snapshot";
import { useNow } from "../../../hooks/use-now";
import { NotchPanel } from "../../../components/notch-panel";
import { ProviderCard } from "../../../components/provider-card";
import { PressableCard } from "../../../components/pressable";
import { Icon } from "../../../components/icon";
import { ErrorCard } from "../../../components/flows/error-card";
import { UnreachableBanner } from "../../../components/flows/unreachable-banner";
import { ThemedRefreshControl } from "../../../components/refresh";
import { Entrance } from "../../../components/rings/entrance";
import { RingsSkeleton } from "../../../components/flows/skeleton";
import { reflow, useGentlePulse } from "../../../components/flows/motion";
import type { SessionOverlay } from "../../../components/usage-ring";
import { ApiError } from "../../../lib/api";
import { useConnection } from "../../../state/connection";

export default function RingsScreen() {
  const colors = useTheme();
  const router = useRouter();
  const now = useNow();
  const { disconnect } = useConnection();
  const query = useSnapshot();
  const { refreshing, onRefresh, unreachable, lastReadingAt, retrying, retry } = usePullToRefresh();

  const snapshot = query.data;
  const waiting = snapshot?.sessions.filter((s) => s.state === "waiting").length ?? 0;
  const working = snapshot?.sessions.filter((s) => s.state === "busy").length ?? 0;
  // The activity lives on the Claude ring, as on the notch: waiting on you
  // outranks working, because that is the one that stops your work.
  const claudeSession: SessionOverlay = waiting > 0 ? "waiting" : working > 0 ? "busy" : null;

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.content}
      refreshControl={<ThemedRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {!snapshot && query.isPending ? (
        <RingsSkeleton />
      ) : !snapshot && query.isError ? (
        (query.error instanceof ApiError && query.error.kind === "revoked") ? (
          <Entrance index={0}>
            <ErrorCard
              iconName="xmark.circle.fill"
              title="This Mac removed this phone"
              message="Pair again to connect."
              hint={null}
              actionText="Pair again"
              onRetry={() => disconnect()}
            />
          </Entrance>
        ) : (
          <ErrorCard message={(query.error as Error)?.message ?? "Couldn't reach the agent"} onRetry={() => query.refetch()} retrying={query.isFetching} />
        )
      ) : snapshot ? (
        <>
          {/* The whole overview rises in once, when the first reading lands;
          after that only what changes moves. The tab stays mounted, so
          coming back from a provider never replays it. */}
          {unreachable ? (
            <Entrance index={0}>
              <UnreachableBanner lastReadingAt={lastReadingAt} now={now} retrying={retrying} onRetry={retry} />
            </Entrance>
          ) : null}

          <Entrance index={0}>
            <NotchPanel providers={snapshot.providers} claudeSession={claudeSession} refreshing={refreshing} />
          </Entrance>

          {waiting + working > 0 ? (
            <Entrance index={1}>
              <LiveBanner waiting={waiting} working={working} onPress={() => router.navigate("/sessions")} />
            </Entrance>
          ) : null}

          {snapshot.providers.map((provider, index) => (
            <Entrance key={provider.id} index={index + 2}>
              <ProviderCard provider={provider} now={now} />
            </Entrance>
          ))}

          <Animated.Text layout={reflow} style={[styles.footer, { color: colors.tertiaryLabel }]}>
            {snapshot.server.demo
              ? "Demo readings — not your Mac"
              : unreachable
                ? `Last reading from ${snapshot.server.name}`
                : `Live from ${snapshot.server.name} · every minute`}
          </Animated.Text>
        </>
      ) : null}
    </ScrollView>
  );
}

/** One status dot, one sentence, one chevron. The dot breathes only while
 * someone is waiting on you. */
function LiveBanner({ waiting, working, onPress }: { waiting: number; working: number; onPress: () => void }) {
  const colors = useTheme();
  const reduceMotion = useReducedMotion();
  const isWaiting = waiting > 0;
  const glow = useGentlePulse(isWaiting, reduceMotion, 0.3, 1800);
  const dotStyle = useAnimatedStyle(() => ({ opacity: glow.get() }));

  const copy = isWaiting
    ? `${waiting} waiting on you${working ? ` · ${working} working` : ""}`
    : `${working} working`;
  const dotColor = isWaiting ? colors.watch : colors.ample;

  return (
    <PressableCard
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${copy}. Opens sessions.`}
      style={[styles.banner, { backgroundColor: colors.card }]}
    >
      <View style={[styles.dotHalo, { backgroundColor: rgba(dotColor, 0.18) }]}>
        <Animated.View style={[styles.dot, { backgroundColor: dotColor }, dotStyle]} />
      </View>
      <Text numberOfLines={1} style={[styles.bannerText, { color: colors.label }]}>
        {copy}
      </Text>
      <Icon name="chevron.right" size={13} color={colors.tertiaryLabel} weight="semibold" />
    </PressableCard>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing(4),
    paddingTop: spacing(2),
    paddingBottom: spacing(8),
    gap: spacing(4),
  },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(3),
    paddingVertical: spacing(3.5),
    paddingHorizontal: spacing(4),
    borderRadius: radius.card,
    borderCurve: "continuous",
  },
  dotHalo: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  bannerText: {
    fontSize: 15,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
    flex: 1,
  },
  footer: {
    fontSize: 12,
    textAlign: "center",
    fontVariant: ["tabular-nums"],
    marginTop: spacing(1),
  },
});
