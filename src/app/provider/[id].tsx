/** Provider detail — every window, its reset, what the reading rests on, and
 * any door that is shut right now. A push: back returns to Rings. */
import { useEffect, useRef, useState } from "react";
import { Linking, StyleSheet, Text, View, ScrollView, RefreshControl } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import Animated, { runOnJS, useAnimatedReaction, useReducedMotion, useSharedValue, withSpring } from "react-native-reanimated";
import { useTheme } from "../../theme";
import { radius, spacing } from "../../theme";
import { useSnapshot, useRefreshNow } from "../../state/snapshot";
import { useNow } from "../../hooks/use-now";
import { UsageRing } from "../../components/usage-ring";
import { WindowRow } from "../../components/window-row";
import { StatusNote } from "../../components/status-note";
import { Icon } from "../../components/icon";
import { Entrance } from "../../components/rings/entrance";
import { ageCopy, percentText } from "../../lib/format";
import { headlineWindow } from "../../lib/types";

export default function ProviderScreen() {
  const colors = useTheme();
  const now = useNow();
  const reduceMotion = useReducedMotion();
  const { id } = useLocalSearchParams<{ id: string }>();
  const query = useSnapshot();
  const refreshNow = useRefreshNow();

  const provider = query.data?.providers.find((p) => p.id === id);
  const headline = provider ? headlineWindow(provider) : null;
  const reading = !!provider && provider.windows.length > 0;
  const stale = provider?.status.kind === "stale";
  const qualifier = provider?.fidelity === "official" ? "" : "~";
  const target = reading && headline?.usedFraction != null ? headline.usedFraction : null;

  // The percentage counts up with the ring's entrance sweep — once. Later
  // value changes are printed as they land; the user may be reading them.
  const [shownPercent, setShownPercent] = useState<number | null>(target != null ? 0 : null);
  const countedRef = useRef(false);
  const countProgress = useSharedValue(0);

  useEffect(() => {
    if (target == null) {
      setShownPercent(null);
      return;
    }
    if (reduceMotion || countedRef.current) {
      setShownPercent(Math.round(target * 100));
      return;
    }
    countedRef.current = true;
    countProgress.value = withSpring(target, { duration: 700, dampingRatio: 1 });
  }, [target, reduceMotion, countProgress]);

  useAnimatedReaction(
    () => countProgress.value,
    (value) => {
      runOnJS(setShownPercent)(Math.round(value * 100));
    },
    [],
  );

  const percentCopy =
    reading && headline?.usedFraction != null
      ? `${qualifier}${shownPercent ?? percentText(headline.usedFraction)}%`
      : "—";

  return (
    <>
      <Stack.Screen options={{ title: provider?.displayName ?? "…", headerBackTitle: "Rings" }} />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshNow.isPending || query.isRefetching}
            onRefresh={() => {
              refreshNow.mutate();
              query.refetch();
            }}
            tintColor={colors.secondaryLabel}
          />
        }
      >
        {!provider ? (
          <View style={[styles.heroCard, { backgroundColor: colors.card, borderRadius: radius.card }]}>
            <View style={[styles.heroRingFallback, { backgroundColor: colors.ringTrack }]} />
          </View>
        ) : (
          <>
            {provider.block ? (
              <Entrance index={0}>
                <View style={[styles.blockBanner, { backgroundColor: colors.card, borderRadius: radius.card }]}>
                  <View style={styles.blockHead}>
                    <View style={styles.blockIconPlate}>
                      <Icon name="exclamationmark.triangle" size={15} color={colors.watch} />
                    </View>
                    <Text style={[styles.blockTitle, { color: colors.watch }]}>
                      {provider.block.reason}
                      {provider.block.resetsAt &&
                      new Date(provider.block.resetsAt).getTime() > now.getTime()
                        ? ` until ${new Intl.DateTimeFormat(undefined, {
                            hour: "numeric",
                            minute: "2-digit",
                          }).format(new Date(provider.block.resetsAt))}`
                        : ""}
                    </Text>
                  </View>
                  <Text style={[styles.blockBody, { color: colors.secondaryLabel }]}>
                    Something is blocked right now — separate from the percentages below, which keep
                    counting the allowance.
                  </Text>
                </View>
              </Entrance>
            ) : null}

            <Entrance index={provider.block ? 1 : 0}>
              <View style={[styles.heroCard, { backgroundColor: colors.card, borderRadius: radius.card }]}>
                <View style={styles.heroRingWrap}>
                  <UsageRing
                    value={headline?.usedFraction ?? null}
                    size={148}
                    colors={colors}
                    hasReading={reading}
                    dimmed={stale}
                    session={provider.id === "claude" ? headlineSession(query.data?.sessions ?? []) : null}
                  />
                  <View style={StyleSheet.absoluteFill} pointerEvents="none">
                    <View style={styles.heroRingCenter}>
                      <Text style={[styles.heroPercent, { color: reading ? colors.label : colors.tertiaryLabel }]}>
                        {percentCopy}
                      </Text>
                    </View>
                  </View>
                </View>
                <Text style={[styles.heroLabel, { color: colors.secondaryLabel }]}>
                  {headline?.label ?? "No reading"}
                  {stale ? ` · updated ${ageCopy(provider.status.since, now)}` : ""}
                </Text>
              </View>
            </Entrance>

            {reading ? (
              <Entrance index={provider.block ? 2 : 1}>
                <View style={[styles.windowsCard, { backgroundColor: colors.card, borderRadius: radius.card }]}>
                  {provider.windows.map((window, index) => (
                    <View key={window.id}>
                      {index > 0 ? <View style={[styles.windowSeparator, { backgroundColor: colors.separator }]} /> : null}
                      <WindowRow window={window} now={now} dimmed={stale} />
                    </View>
                  ))}
                </View>
              </Entrance>
            ) : (
              <Entrance index={provider.block ? 2 : 1}>
                <StatusCard providerId={provider.id} displayName={provider.displayName} why={provider.status.why} />
              </Entrance>
            )}

            <Entrance index={provider.block ? 3 : 2}>
              <FidelityCard
                fidelity={provider.fidelity}
                source={provider.account?.source}
                plan={provider.account?.plan ?? null}
                account={provider.account?.account}
                manageUrl={provider.account?.manageUrl}
              />
            </Entrance>
          </>
        )}
      </ScrollView>
    </>
  );
}

function headlineSession(sessions: { state: string }[]): "busy" | "waiting" | null {
  if (sessions.some((s) => s.state === "waiting")) return "waiting";
  if (sessions.some((s) => s.state === "busy")) return "busy";
  return null;
}

function StatusCard({ providerId, displayName, why }: { providerId: string; displayName: string; why?: string }) {
  const colors = useTheme();
  const prompt: Record<string, string> = {
    claude: "Run Claude Code once — it signs in and refreshes the token this reads. Use /login there to change account.",
    cursor: "Sign in to Cursor in the editor; the agent borrows its session.",
    codex: "Run Codex once — it records rate limits in its own logs.",
    glm: "Set up a GLM Coding Plan key for a coding tool on the Mac.",
  };
  const text = why ?? prompt[providerId] ?? `Sign in to ${displayName} to read your usage`;
  return (
    <View style={[styles.statusCard, { backgroundColor: colors.card, borderRadius: radius.card }]}>
      <StatusNote icon="info.circle" text={text} color={colors.secondaryLabel} />
    </View>
  );
}

function FidelityCard({
  fidelity,
  source,
  plan,
  account,
  manageUrl,
}: {
  fidelity: string;
  source?: string;
  plan?: string | null;
  account?: string;
  manageUrl?: string;
}) {
  const colors = useTheme();
  const derived = fidelity !== "official";
  const facts = [
    source ? `Read from ${source}` : null,
    plan ? `Plan: ${plan}` : null,
    account ?? null,
  ].filter(Boolean) as string[];

  return (
    <View style={[styles.fidelityCard, { backgroundColor: colors.card, borderRadius: radius.card }]}>
      <View style={styles.fidelityHead}>
        <Text style={[styles.fidelityTilde, { color: colors.accent }]}>{derived ? "~" : "✓"}</Text>
        <Text style={[styles.fidelityTitle, { color: colors.label }]}>
          {derived ? "Derived reading" : "Official reading"}
        </Text>
        {manageUrl ? (
          <Text
            onPress={() => Linking.openURL(manageUrl)}
            style={[styles.manageLink, { color: colors.accent }]}
          >
            Manage
          </Text>
        ) : null}
      </View>
      <Text style={[styles.fidelityBody, { color: colors.secondaryLabel }]}>
        {derived
          ? "Worked out from local files on the Mac — no vendor endpoint involved. The ~ marks it everywhere."
          : "Read from the vendor's own usage endpoint — the same numbers its panel shows."}
        {facts.length ? ` ${facts.join(" · ")}.` : ""}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing(4),
    paddingBottom: spacing(6),
    gap: spacing(4),
  },
  blockBanner: {
    padding: spacing(4),
    gap: spacing(1.5),
    borderCurve: "continuous",
  },
  blockHead: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing(1.5),
  },
  blockIconPlate: {
    width: 18,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  blockTitle: {
    fontSize: 15,
    fontWeight: "700",
    flex: 1,
  },
  blockBody: {
    fontSize: 13,
    lineHeight: 18,
  },
  heroCard: {
    alignItems: "center",
    padding: spacing(6),
    gap: spacing(3),
    borderCurve: "continuous",
  },
  heroRingFallback: {
    width: 148,
    height: 148,
    borderRadius: 148,
  },
  heroRingWrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  heroRingCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  heroPercent: {
    fontSize: 34,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
  heroLabel: {
    fontSize: 14,
    fontVariant: ["tabular-nums"],
    textAlign: "center",
  },
  windowsCard: {
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(2),
    borderCurve: "continuous",
  },
  windowSeparator: {
    height: StyleSheet.hairlineWidth,
  },
  statusCard: {
    padding: spacing(4),
    borderCurve: "continuous",
  },
  fidelityCard: {
    padding: spacing(4),
    gap: spacing(2),
    borderCurve: "continuous",
  },
  fidelityHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(2),
  },
  fidelityTilde: {
    fontSize: 17,
    fontWeight: "800",
    width: 20,
    textAlign: "center",
  },
  fidelityTitle: {
    fontSize: 15,
    fontWeight: "600",
    flex: 1,
  },
  manageLink: {
    fontSize: 15,
    fontWeight: "500",
  },
  fidelityBody: {
    fontSize: 13,
    lineHeight: 18,
  },
});
