/** Sessions — every live agent on the Mac, and what each one wants from you.
 * A chip strip answers "is anything mine?" at a glance; the grouped cards
 * below carry the detail. */
import { StyleSheet, Text, View, ScrollView, RefreshControl } from "react-native";
import { useTheme } from "../../theme";
import { radius, spacing } from "../../theme";
import { useSnapshot, useRefreshNow } from "../../state/snapshot";
import { useNow } from "../../hooks/use-now";
import { ageCopy } from "../../lib/format";
import { SessionRow } from "../../components/session-row";
import { SectionCard } from "../../components/flows/section-card";
import { SummaryChips } from "../../components/flows/count-chip";
import { SessionsSkeleton } from "../../components/flows/skeleton";
import { ErrorCard } from "../../components/flows/error-card";
import { Icon } from "../../components/icon";
import type { AgentSession } from "../../lib/types";

export default function SessionsScreen() {
  const colors = useTheme();
  const now = useNow();
  const query = useSnapshot();
  const refreshNow = useRefreshNow();

  const sessions: AgentSession[] = query.data?.sessions ?? [];
  const groups: { title: string; state: AgentSession["state"]; items: AgentSession[] }[] = [
    { title: "Waiting on you", state: "waiting", items: sessions.filter((s) => s.state === "waiting") },
    { title: "Working", state: "busy", items: sessions.filter((s) => s.state === "busy") },
    { title: "Idle", state: "idle", items: sessions.filter((s) => s.state === "idle") },
  ];
  const visible = groups.filter((g) => g.items.length > 0);
  const refreshing = refreshNow.isPending || query.isRefetching;

  const showSkeleton = query.isPending && !query.data;
  const showError = query.isError && !query.data;
  const retry = () => {
    refreshNow.mutate();
    query.refetch();
  };

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={retry}
          tintColor={colors.secondaryLabel}
        />
      }
    >
      {showSkeleton ? (
        <SessionsSkeleton />
      ) : showError ? (
        <ErrorCard
          message={(query.error as Error)?.message ?? "The Mac didn't answer."}
          onRetry={retry}
          retrying={refreshing}
        />
      ) : (
        <>
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
              <SectionCard key={group.state} title={group.title} delay={(i + 1) * 60} separatorInset={54}>
                {group.items.map((session) => (
                  <SessionRow key={session.id} session={session} now={now} />
                ))}
              </SectionCard>
            ))
          )}
          <Footer />
        </>
      )}
    </ScrollView>
  );
}

function Footer() {
  const colors = useTheme();
  const now = useNow();
  const query = useSnapshot();
  const demo = query.data?.server.demo;
  const synced = query.dataUpdatedAt
    ? ` · synced ${ageCopy(new Date(query.dataUpdatedAt).toISOString(), now)}`
    : "";
  return (
    <Text style={[styles.footer, { color: colors.tertiaryLabel }]}>
      {demo ? "Demo readings — not your Mac" : `Refreshes every minute${synced}`}
    </Text>
  );
}

/** Reached the Mac and it has nothing running — say so, and say what to do. */
function EmptySessions() {
  const colors = useTheme();
  return (
    <View style={[styles.empty, { backgroundColor: colors.card }]}>
      <View style={[styles.emptyPlate, { backgroundColor: colors.insetCard }]}>
        <Icon name="terminal" size={24} color={colors.secondaryLabel} />
      </View>
      <Text style={[styles.emptyTitle, { color: colors.label }]}>No sessions running</Text>
      <Text style={[styles.emptyBody, { color: colors.secondaryLabel }]}>
        Start Claude Code on your Mac — sessions appear here the moment they begin, and the
        moment they need you.
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
  footer: {
    fontSize: 12,
    textAlign: "center",
    fontVariant: ["tabular-nums"],
    marginTop: spacing(1),
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
