/** Rings — the answer at a glance: how much of each limit is burned, and is
 * an agent still working, done, or waiting on you. */
import { useEffect } from "react";
import { StyleSheet, Text, View, ScrollView, RefreshControl } from "react-native";
import { useRouter } from "expo-router";
import Svg, { Path } from "react-native-svg";
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import { useTheme } from "../../theme";
import { radius, spacing } from "../../theme";
import { useSnapshot, useRefreshNow } from "../../state/snapshot";
import { useNow } from "../../hooks/use-now";
import { ProviderCard } from "../../components/provider-card";
import { PressableCard } from "../../components/pressable";
import { Icon } from "../../components/icon";
import { Entrance, onceGuard } from "../../components/rings/entrance";
import { recordTrendPoint } from "../../components/rings/sparkline";
import { headlineWindow, hasReading } from "../../lib/types";

// The stagger plays once per app session — coming back from a detail screen
// must not replay it.
const FIRST_LOAD = onceGuard("rings-overview");

export default function RingsScreen() {
  const colors = useTheme();
  const router = useRouter();
  const now = useNow();
  const query = useSnapshot();
  const refreshNow = useRefreshNow();

  const snapshot = query.data;
  const providers = snapshot?.providers ?? [];

  // Feed the in-memory trend store — only real, changed readings.
  useEffect(() => {
    if (!snapshot) return;
    for (const provider of snapshot.providers) {
      const headline = headlineWindow(provider);
      if (hasReading(provider) && headline?.usedFraction != null) {
        recordTrendPoint(provider.id, headline.usedFraction);
      }
    }
  }, [snapshot]);

  const waiting = snapshot?.sessions.filter((s) => s.state === "waiting") ?? [];
  const busy = snapshot?.sessions.filter((s) => s.state === "busy") ?? [];
  // The overlay lives on the Claude ring, as on the notch: waiting on you
  // outranks working, because that is the one that stops your work.
  const claudeSession = waiting.length > 0 ? "waiting" : busy.length > 0 ? "busy" : null;

  const refreshing = refreshNow.isPending || query.isRefetching;
  const showBanner = busy.length > 0 || waiting.length > 0;
  const cardStagger = (index: number) => (FIRST_LOAD ? (showBanner ? index + 1 : index) : undefined);

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            refreshNow.mutate();
            query.refetch();
          }}
          tintColor={colors.secondaryLabel}
        />
      }
    >
      {!snapshot && query.isPending ? (
        <SkeletonGrid />
      ) : !snapshot && query.isError ? (
        <ErrorCard
          message={(query.error as Error)?.message ?? "Couldn't reach the agent"}
          onRetry={() => query.refetch()}
        />
      ) : snapshot ? (
        <>
          {showBanner && (
            <LiveBanner
              waitingCount={waiting.length}
              busyCount={busy.length}
              onPress={() => router.navigate("/(tabs)/sessions")}
              entranceIndex={FIRST_LOAD ? 0 : undefined}
            />
          )}

          <View style={styles.grid}>
            {providers.map((provider, index) => (
              <View key={provider.id} style={styles.gridChild}>
                <ProviderCard
                  provider={provider}
                  session={provider.id === "claude" ? claudeSession : null}
                  now={now}
                  entranceIndex={cardStagger(index)}
                />
              </View>
            ))}
          </View>

          <Text style={[styles.footer, { color: colors.tertiaryLabel }]}>
            {snapshot.server.demo ? "Demo readings — not your Mac" : `Live from ${snapshot.server.name}`}
            {snapshot.server.demo ? "" : " · refreshes every minute"}
          </Text>
        </>
      ) : null}
    </ScrollView>
  );
}

/** The live banner: one status dot, one sentence, one chevron. The dot
 * breathes only while someone is waiting on you. */
function LiveBanner({
  waitingCount,
  busyCount: working,
  onPress,
  entranceIndex,
}: {
  waitingCount: number;
  busyCount: number;
  onPress: () => void;
  entranceIndex?: number;
}) {
  const colors = useTheme();
  const reduceMotion = useReducedMotion();
  const glow = useSharedValue(1);
  const waiting = waitingCount > 0;

  useEffect(() => {
    if (waiting && !reduceMotion) {
      glow.value = withRepeat(withTiming(0.35, { duration: 900, easing: Easing.inOut(Easing.quad) }), -1, true);
    } else {
      glow.value = 1;
    }
  }, [waiting, reduceMotion, glow]);

  const dotStyle = useAnimatedStyle(() => ({ opacity: glow.value }));

  const banner = (
    <PressableCard
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={
        waiting
          ? `${waitingCount} waiting on you${working ? `, ${working} working` : ""}. Opens sessions.`
          : `${working} working. Opens sessions.`
      }
      style={[styles.liveBanner, { backgroundColor: colors.card, borderRadius: radius.card }]}
    >
      <Animated.View style={[styles.dot, { backgroundColor: waiting ? colors.watch : colors.ample }, dotStyle]} />
      <Text numberOfLines={1} style={[styles.liveText, { color: colors.label }]}>
        {waiting
          ? `${waitingCount} waiting on you${working ? ` · ${working} working` : ""}`
          : `${working} working`}
      </Text>
      <Chevron color={colors.tertiaryLabel} />
    </PressableCard>
  );

  if (entranceIndex == null) return banner;
  return <Entrance index={entranceIndex}>{banner}</Entrance>;
}

/** A quiet disclosure chevron — drawn here because the shared icon set is
 * SF Symbols glyphs, and this wants to be a pure stroke. */
function Chevron({ color }: { color: string }) {
  return (
    <Svg width={7} height={12} viewBox="0 0 7 12">
      <Path
        d="M1 1 6 6 1 11"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

/** Skeletons match the final layout's shape: header with plan pill, ring,
 * headline label, trend line. */
function SkeletonGrid() {
  const colors = useTheme();
  return (
    <View style={styles.grid}>
      {[0, 1, 2, 3].map((i) => (
        <View key={i} style={[styles.skeletonCard, { backgroundColor: colors.card, borderRadius: radius.card }]}>
          <View style={styles.skeletonHeader}>
            <View style={[styles.skeletonLine, { backgroundColor: colors.ringTrack, width: "52%", height: 13 }]} />
            <View style={[styles.skeletonPill, { backgroundColor: colors.ringTrack }]} />
          </View>
          <View style={styles.skeletonRingWrap}>
            <View style={[styles.skeletonRing, { backgroundColor: colors.ringTrack }]} />
          </View>
          <View style={[styles.skeletonLine, { backgroundColor: colors.ringTrack, width: "62%", height: 11, alignSelf: "center" }]} />
          <View style={[styles.skeletonSpark, { backgroundColor: colors.ringTrack }]} />
        </View>
      ))}
    </View>
  );
}

function ErrorCard({ message, onRetry }: { message: string; onRetry: () => void }) {
  const colors = useTheme();
  return (
    <PressableCard
      onPress={onRetry}
      style={[styles.errorCard, { backgroundColor: colors.card, borderRadius: radius.card }]}
    >
      <Icon name="wifi" size={22} color={colors.critical} />
      <Text style={[styles.errorTitle, { color: colors.label }]}>Can't reach the agent</Text>
      <Text style={[styles.errorMessage, { color: colors.secondaryLabel }]}>{message}</Text>
      <Text style={[styles.errorRetry, { color: colors.accent }]}>Tap to retry</Text>
    </PressableCard>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing(4),
    paddingBottom: spacing(6),
    gap: spacing(4),
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing(3),
  },
  gridChild: {
    width: "47.5%",
  },
  liveBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(2.5),
    paddingVertical: spacing(3),
    paddingHorizontal: spacing(4),
  },
  dot: {
    width: 9,
    height: 9,
    borderRadius: 9,
  },
  liveText: {
    fontSize: 15,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
    flex: 1,
  },
  footer: {
    fontSize: 12,
    textAlign: "center",
    fontVariant: ["tabular-nums"],
  },
  skeletonCard: {
    width: "47.5%",
    flexGrow: 1,
    padding: spacing(4),
    gap: spacing(2),
    borderCurve: "continuous",
  },
  skeletonHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 22,
  },
  skeletonLine: {
    height: 12,
    borderRadius: radius.pill,
  },
  skeletonPill: {
    width: 34,
    height: 16,
    borderRadius: radius.pill,
  },
  skeletonRingWrap: {
    alignItems: "center",
    paddingVertical: spacing(3),
  },
  skeletonRing: {
    width: 96,
    height: 96,
    borderRadius: 96,
  },
  skeletonSpark: {
    width: 40,
    height: 6,
    borderRadius: radius.pill,
    alignSelf: "center",
  },
  errorCard: {
    alignItems: "center",
    padding: spacing(6),
    gap: spacing(2),
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: "600",
  },
  errorMessage: {
    fontSize: 13,
    textAlign: "center",
  },
  errorRetry: {
    fontSize: 14,
    fontWeight: "600",
    marginTop: spacing(1),
  },
});
