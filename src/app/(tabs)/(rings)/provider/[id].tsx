/** Provider detail — the ring large, every window, what the reading rests on,
 * and any door that is shut right now. A push within the Rings tab: back
 * returns to Rings. */
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { radius, spacing, useTheme } from "../../../../theme";
import { usePullToRefresh, useSnapshot } from "../../../../state/snapshot";
import { useNow } from "../../../../hooks/use-now";
import { UsageRing, type SessionOverlay } from "../../../../components/usage-ring";
import { WindowRow } from "../../../../components/window-row";
import { StatusNote } from "../../../../components/status-note";
import { BlockBanner, authPrompt } from "../../../../components/provider-card";
import { ProviderGlyph } from "../../../../components/glyphs/provider-glyph";
import { Entrance } from "../../../../components/rings/entrance";
import { PressableRow } from "../../../../components/pressable";
import { Icon } from "../../../../components/icon";
import { ageCopy, percentText, resetCopy } from "../../../../lib/format";
import { headlineWindow, type AgentSession } from "../../../../lib/types";

const HERO_RING = 132;

export default function ProviderScreen() {
  const colors = useTheme();
  const now = useNow();
  const { id } = useLocalSearchParams<{ id: string }>();
  const query = useSnapshot();
  const { refreshing, onRefresh } = usePullToRefresh();

  const provider = query.data?.providers.find((p) => p.id === id);
  const headline = provider ? headlineWindow(provider) : null;
  const fraction = headline?.usedFraction ?? null;
  const reading = !!provider && provider.windows.length > 0 && fraction != null;
  const stale = provider?.status.kind === "stale";
  const derived = provider?.fidelity !== "official";
  const session: SessionOverlay = provider?.id === "claude" ? headlineSession(query.data?.sessions ?? []) : null;

  return (
    <>
      <Stack.Screen options={{ title: provider?.displayName ?? "" }} />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.secondaryLabel} />}
      >
        {!provider ? (
          <View style={[styles.hero, { backgroundColor: colors.card }]}>
            <View style={[styles.heroFallback, { borderColor: colors.ringTrack }]} />
          </View>
        ) : (
          <>
            <Entrance index={0}>
              <View style={[styles.hero, { backgroundColor: colors.card }]}>
                <UsageRing
                  value={fraction}
                  size={HERO_RING}
                  colors={colors}
                  hasReading={reading}
                  dimmed={stale}
                  blocked={!!provider.block}
                  session={session}
                  refreshing={refreshing}
                >
                  <ProviderGlyph providerId={provider.id} displayName={provider.displayName} size={HERO_RING * 0.393} color={colors.label} />
                </UsageRing>
                <View style={styles.heroTexts}>
                  <Text
                    selectable
                    style={[styles.heroPercent, { color: reading ? colors.label : colors.tertiaryLabel }, stale && styles.dimmed]}
                  >
                    {reading && fraction != null ? `${derived ? "~" : ""}${percentText(fraction)}%` : "—"}
                  </Text>
                  <Text style={[styles.heroLabel, { color: colors.secondaryLabel }]}>
                    {headline?.label ?? "No reading"}
                    {headline && reading ? ` · ${resetCopy(headline.resetsAt, now)}` : ""}
                  </Text>
                  {stale ? (
                    <Text style={[styles.heroStale, { color: colors.tertiaryLabel }]}>
                      Updated {ageCopy(provider.status.since, now)}
                    </Text>
                  ) : null}
                </View>
              </View>
            </Entrance>

            {provider.block ? (
              <Entrance index={1}>
                <View style={[styles.card, { backgroundColor: colors.card }]}>
                  <BlockBanner reason={provider.block.reason} resetsAt={provider.block.resetsAt} now={now} />
                  <Text style={[styles.body, { color: colors.secondaryLabel }]}>
                    Something is blocked right now — separate from the allowances below, which keep counting.
                  </Text>
                </View>
              </Entrance>
            ) : null}

            <Entrance index={2}>
              {provider.windows.length > 0 ? (
                <View style={[styles.card, styles.windows, { backgroundColor: colors.card }]}>
                  {provider.windows.map((window) => (
                    <WindowRow
                      key={window.id}
                      window={window}
                      now={now}
                      colors={colors}
                      derived={derived}
                      dimmed={stale}
                    />
                  ))}
                </View>
              ) : (
                <View style={[styles.card, { backgroundColor: colors.card }]}>
                  <StatusNote
                    icon="info.circle"
                    text={provider.status.why ?? statusPrompt(provider.id, provider.displayName)}
                    color={colors.secondaryLabel}
                  />
                </View>
              )}
            </Entrance>

            {/* What a reading rests on only means something once there is one. */}
            {provider.windows.length > 0 ? (
              <Entrance index={3}>
                <FidelityCard
                  derived={derived}
                  source={provider.account?.source}
                  plan={provider.account?.plan ?? null}
                  account={provider.account?.account}
                  manageUrl={provider.account?.manageUrl}
                />
              </Entrance>
            ) : null}
          </>
        )}
      </ScrollView>
    </>
  );
}

function headlineSession(sessions: AgentSession[]): SessionOverlay {
  if (sessions.some((s) => s.state === "waiting")) return "waiting";
  if (sessions.some((s) => s.state === "busy")) return "busy";
  return null;
}

function statusPrompt(providerId: string, displayName: string): string {
  const prompts: Record<string, string> = {
    claude: "Run Claude Code once — it signs in and refreshes the token this reads. Use /login there to change account.",
    cursor: "Sign in to Cursor in the editor; the agent borrows its session.",
    codex: "Run Codex once — it records rate limits in its own logs.",
    glm: "Set up a GLM Coding Plan key for a coding tool on the Mac.",
  };
  return prompts[providerId] ?? authPrompt(providerId, displayName);
}

function FidelityCard({
  derived,
  source,
  plan,
  account,
  manageUrl,
}: {
  derived: boolean;
  source?: string;
  plan?: string | null;
  account?: string;
  manageUrl?: string;
}) {
  const colors = useTheme();
  const facts = [source ? `Source: ${source}` : null, plan ? `Plan: ${plan}` : null, account ?? null].filter(
    Boolean,
  ) as string[];

  return (
    <View style={[styles.card, styles.flush, { backgroundColor: colors.card }]}>
      <View style={styles.fidelity}>
        <View style={styles.fidelityHead}>
          <Text style={[styles.fidelityMark, { color: colors.accent }]}>{derived ? "~" : "✓"}</Text>
          <Text style={[styles.fidelityTitle, { color: colors.label }]}>{derived ? "Derived reading" : "Official reading"}</Text>
        </View>
        <Text style={[styles.body, { color: colors.secondaryLabel }]}>
          {derived
            ? "Worked out from local files on the Mac — no vendor endpoint involved. The ~ marks it everywhere."
            : "Straight from the vendor's own usage endpoint — the same numbers its panel shows."}
        </Text>
        {facts.length ? (
          <Text selectable style={[styles.facts, { color: colors.tertiaryLabel }]}>
            {facts.join(" · ")}
          </Text>
        ) : null}
      </View>
      {manageUrl ? (
        <PressableRow
          onPress={() => WebBrowser.openBrowserAsync(manageUrl).catch(() => {})}
          accessibilityRole="link"
          style={[styles.manageRow, { borderTopColor: colors.separator }]}
        >
          <Text style={[styles.manageText, { color: colors.accent }]}>Manage plan</Text>
          <Icon name="chevron.right" size={13} color={colors.tertiaryLabel} weight="semibold" />
        </PressableRow>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing(4),
    paddingTop: spacing(2),
    paddingBottom: spacing(8),
    gap: spacing(4),
  },
  hero: {
    alignItems: "center",
    paddingTop: spacing(7),
    paddingBottom: spacing(6),
    paddingHorizontal: spacing(4),
    gap: spacing(5),
    borderRadius: radius.card,
    borderCurve: "continuous",
  },
  heroFallback: {
    width: HERO_RING,
    height: HERO_RING,
    borderRadius: HERO_RING / 2,
    borderWidth: HERO_RING * 0.1325,
  },
  heroTexts: {
    alignItems: "center",
    gap: spacing(1),
  },
  heroPercent: {
    fontSize: 44,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
    letterSpacing: -0.8,
  },
  heroLabel: {
    fontSize: 15,
    fontVariant: ["tabular-nums"],
    textAlign: "center",
  },
  heroStale: {
    fontSize: 13,
    fontVariant: ["tabular-nums"],
  },
  dimmed: { opacity: 0.45 },
  card: {
    padding: spacing(4),
    gap: spacing(3),
    borderRadius: radius.card,
    borderCurve: "continuous",
  },
  windows: {
    gap: spacing(5),
  },
  flush: {
    padding: 0,
    gap: 0,
    overflow: "hidden",
  },
  body: {
    fontSize: 13,
    lineHeight: 18,
  },
  fidelity: {
    padding: spacing(4),
    gap: spacing(2),
  },
  fidelityHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(2),
  },
  fidelityMark: {
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
  facts: {
    fontSize: 12,
    lineHeight: 16,
  },
  manageRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(3.5),
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  manageText: {
    fontSize: 15,
    fontWeight: "500",
  },
});
