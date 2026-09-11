/** Sessions — every live agent on the Mac, and what each one wants from you.
 * A chip strip answers "is anything mine?" at a glance; the grouped cards
 * below carry the detail. */
import { ScrollView, StyleSheet, Text, View } from "react-native";
import Animated from "react-native-reanimated";
import { radius, spacing, useTheme } from "../../../theme";
import { usePullToRefresh, useSnapshot } from "../../../state/snapshot";
import { useNow } from "../../../hooks/use-now";
import { ageCopy } from "../../../lib/format";
import { SessionRow } from "../../../components/session-row";
import { SectionCard } from "../../../components/flows/section-card";
import { SummaryChips } from "../../../components/flows/count-chip";
import { SessionsSkeleton } from "../../../components/flows/skeleton";
import { ErrorCard } from "../../../components/flows/error-card";
import { fadeOut, reflow, useRiseIn } from "../../../components/flows/motion";
import { UnreachableBanner } from "../../../components/flows/unreachable-banner";
import { ThemedRefreshControl } from "../../../components/refresh";
import { Icon } from "../../../components/icon";
import type { AgentSession } from "../../../lib/types";

export default function SessionsScreen() {
  const colors = useTheme();
  const now = useNow();
  const query = useSnapshot();
  const riseIn = useRiseIn();
  const { refreshing, onRefresh, unreachable, lastReadingAt, retrying, retry } = usePullToRefresh();

  const sessions: AgentSession[] = query.data?.sessions ?? [];
  const groups: { title: string; state: AgentSession["state"]; items: AgentSession[] }[] = [
    { title: "Waiting on you", state: "waiting", items: sessions.filter((s) => s.state === "waiting") },
    { title: "Working", state: "busy", items: sessions.filter((s) => s.state === "busy") },
    { title: "Idle", state: "idle", items: sessions.filter((s) => s.state === "idle") },
  ];
  const visible = groups.filter((g) => g.items.length > 0);

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.content}
      refreshControl={<ThemedRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {query.isPending && !query.data ? (
        <SessionsSkeleton />
      ) : query.isError && !query.data ? (
        <ErrorCard
          message={(query.error as Error)?.message ?? "The Mac didn't answer."}
          onRetry={() => query.refetch()}
          retrying={query.isFetching}
        />
      ) : (
        <>
          {unreachable ? (
            <Animated.View entering={riseIn(0)} exiting={fadeOut} layout={reflow}>
              <UnreachableBanner lastReadingAt={lastReadingAt} now={now} retrying={retrying} onRetry={retry} />
            </Animated.View>
          ) : null}
          <SummaryChips
            counts={{
              waiting: groups[0].items.length,
              busy: groups[1].items.length,
              idle: groups[2].items.length,
            }}
          />
          {visible.length === 0 ? (
            <EmptySessions />
          ) : (
            visible.map((group, i) => (
              <SectionCard key={group.state} title={group.title} index={i + 1} separatorInset={54}>
                {group.items.map((session) => (
                  <SessionRow key={session.id} session={session} now={now} />
                ))}
              </SectionCard>
            ))
          )}
          <Animated.Text layout={reflow} style={[styles.footer, { color: colors.tertiaryLabel }]}>
            {query.data?.server.demo
              ? "Demo readings — not your Mac"
              : `${unreachable ? "Last synced" : "Refreshes every minute · synced"} ${ageCopy(new Date(query.dataUpdatedAt).toISOString(), now)}`}
          </Animated.Text>
        </>
      )}
    </ScrollView>
  );
}

/** Reached the Mac and it has nothing running — say so, and say what to do. */
function EmptySessions() {
  const colors = useTheme();
  const riseIn = useRiseIn();
  return (
    <Animated.View entering={riseIn(1)} exiting={fadeOut} layout={reflow} style={[styles.empty, { backgroundColor: colors.card }]}>
      <View style={[styles.emptyPlate, { backgroundColor: colors.insetCard }]}>
        <Icon name="terminal" size={24} color={colors.secondaryLabel} />
      </View>
      <Text style={[styles.emptyTitle, { color: colors.label }]}>No sessions running</Text>
      <Text style={[styles.emptyBody, { color: colors.secondaryLabel }]}>
        Start Claude Code on your Mac — sessions appear here the moment they begin, and the moment they need you.
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing(4),
    paddingTop: spacing(2),
    paddingBottom: spacing(8),
    gap: spacing(5),
  },
  footer: {
    fontSize: 12,
    textAlign: "center",
    fontVariant: ["tabular-nums"],
  },
  empty: {
    alignItems: "center",
    padding: spacing(8),
    gap: spacing(2),
    borderRadius: radius.card,
    borderCurve: "continuous",
  },
  emptyPlate: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing(1),
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "600",
  },
  emptyBody: {
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
    maxWidth: 260,
  },
});
