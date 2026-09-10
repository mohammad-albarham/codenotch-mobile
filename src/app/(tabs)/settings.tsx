/** Settings — the connection and its live state, what the readings mean, and
 * the way out. Everything the phone knows locally stays visible even when
 * the Mac goes quiet; only live values degrade. */
import { Alert, Linking, Pressable, StyleSheet, Text, View, ScrollView } from "react-native";
import { ActivityIndicator } from "react-native";
import * as Haptics from "expo-haptics";
import { useTheme } from "../../theme";
import { radius, spacing } from "../../theme";
import { useConnection } from "../../state/connection";
import { useSnapshot, useRefreshNow } from "../../state/snapshot";
import { useNow } from "../../hooks/use-now";
import { ageCopy } from "../../lib/format";
import { PressableRow } from "../../components/pressable";
import { Icon } from "../../components/icon";
import { StatusDot, type LinkHealth } from "../../components/flows/status-dot";
import { SettingsSkeleton } from "../../components/flows/skeleton";
import { ErrorCard } from "../../components/flows/error-card";
import { withAlpha } from "../../components/flows/with-alpha";
import { pairingString } from "../../lib/api";

const APP_VERSION = "1.0.0";
/** Past this age, a snapshot is no longer "live" — the poll has missed. */
const FRESH_MS = 90_000;

export default function SettingsScreen() {
  const colors = useTheme();
  const now = useNow();
  const { config, disconnect } = useConnection();
  const snapshot = useSnapshot();
  const refreshNow = useRefreshNow();

  const data = snapshot.data;
  const showSkeleton = snapshot.isPending && !data;
  const showError = snapshot.isError && !data;

  const confirmDisconnect = () => {
    Alert.alert("Disconnect from the Mac?", "You'll need the pairing string again to reconnect.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Disconnect",
        style: "destructive",
        onPress: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
          disconnect();
        },
      },
    ]);
  };

  if (showSkeleton) {
    return (
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
        <SettingsSkeleton />
      </ScrollView>
    );
  }

  if (showError) {
    return (
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
        <Text style={[styles.sectionTitle, { color: colors.secondaryLabel }]}>Connection</Text>
        <View style={[styles.group, { backgroundColor: colors.card }]}>
          <StatusRow health="down" />
          <Separator />
          <Row label="Mac" value={config?.serverName ?? "—"} />
          <Separator />
          <Row label="Address" value={config ? `${config.host}:${config.port}` : "—"} mono />
        </View>
        <ErrorCard
          title="The readings stopped"
          message={(snapshot.error as Error)?.message ?? "The Mac didn't answer the last poll."}
          hint="Is your Mac awake, on the same Wi-Fi, and is the agent running?"
          onRetry={() => {
            refreshNow.mutate();
            snapshot.refetch();
          }}
          retrying={refreshNow.isPending || snapshot.isRefetching}
        />
      </ScrollView>
    );
  }

  const age = snapshot.dataUpdatedAt
    ? now.getTime() - snapshot.dataUpdatedAt
    : Number.POSITIVE_INFINITY;
  const health: LinkHealth =
    snapshot.isError || age > FRESH_MS ? "stale" : data ? "live" : "waiting";

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
      <Text style={[styles.sectionTitle, { color: colors.secondaryLabel }]}>Connection</Text>
      <View style={[styles.group, { backgroundColor: colors.card }]}>
        <StatusRow
          health={health}
          trailing={
            health === "stale" ? (
              ageCopy(data ? new Date(snapshot.dataUpdatedAt).toISOString() : null, now)
            ) : health === "live" ? (
              ageCopy(new Date(snapshot.dataUpdatedAt).toISOString(), now)
            ) : undefined
          }
        />
        <Separator />
        <Row label="Mac" value={data?.server.name ?? config?.serverName ?? "—"} />
        <Separator />
        <Row
          label="Address"
          value={config ? `${config.host}:${config.port}` : "—"}
          mono
          trailing={data?.server.demo ? <Badge text="DEMO" color={colors.watch} /> : undefined}
        />
        <Separator />
        <PressableRow onPress={() => refreshNow.mutate()} style={styles.rowHit}>
          <View style={styles.rowInner}>
            <View style={styles.rowTexts}>
              <Text style={[styles.rowLabel, { color: colors.accent }]}>
                {refreshNow.isPending ? "Refreshing…" : "Refresh now"}
              </Text>
              <Text style={[styles.rowHint, { color: colors.tertiaryLabel }]}>
                Asks the Mac for fresh readings
              </Text>
            </View>
            {refreshNow.isPending ? (
              <ActivityIndicator size="small" color={colors.accent} />
            ) : null}
          </View>
        </PressableRow>
        {refreshNow.isError && !refreshNow.isPending ? (
          <View style={[styles.inlineError, { borderTopColor: colors.separator }]}>
            <Icon name="exclamationmark.triangle" size={14} color={colors.critical} />
            <Text style={[styles.inlineErrorText, { color: colors.critical }]} numberOfLines={2}>
              {(refreshNow.error as Error)?.message ?? "Refresh failed"}
            </Text>
            <Pressable
              onPress={() => refreshNow.mutate()}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Try again"
            >
              <Text style={[styles.inlineRetry, { color: colors.accent }]}>Try again</Text>
            </Pressable>
          </View>
        ) : null}
      </View>

      <Text style={[styles.sectionTitle, { color: colors.secondaryLabel }]}>Readings</Text>
      <View style={[styles.group, { backgroundColor: colors.card }]}>
        <View style={styles.readingRow}>
          <View style={[styles.readingPlate, { backgroundColor: withAlpha(colors.ample, 0.12) }]}>
            <Icon name="checkmark.circle" size={15} color={colors.ample} />
          </View>
          <View style={styles.readingTexts}>
            <Text style={[styles.rowLabel, styles.readingTitle, { color: colors.label }]}>Official</Text>
            <Text style={[styles.readingBody, { color: colors.secondaryLabel }]}>
              Read from the vendor's own usage endpoint — Claude and GLM, when a key exists on the Mac.
            </Text>
          </View>
        </View>
        <View style={[styles.readingSeparator, { backgroundColor: colors.separator }]} />
        <View style={styles.readingRow}>
          <View style={[styles.readingPlate, { backgroundColor: withAlpha(colors.accent, 0.12) }]}>
            <Text style={[styles.tilde, { color: colors.accent }]}>~</Text>
          </View>
          <View style={styles.readingTexts}>
            <Text style={[styles.rowLabel, styles.readingTitle, { color: colors.label }]}>Derived</Text>
            <Text style={[styles.readingBody, { color: colors.secondaryLabel }]}>
              Worked out from local files — Codex's rollout logs. Marked with ~ and never dressed
              up as official.
            </Text>
          </View>
        </View>
      </View>
      <Text style={[styles.sectionFooter, { color: colors.tertiaryLabel }]}>
        Readings stay on your network. The phone never sees tokens.
      </Text>

      <Text style={[styles.sectionTitle, { color: colors.secondaryLabel }]}>About</Text>
      <View style={[styles.group, { backgroundColor: colors.card }]}>
        <Row label="Version" value={`${APP_VERSION} · agent ${data?.server.version ?? "—"}`} mono />
        <Separator />
        <PressableRow
          onPress={() => Linking.openURL("https://github.com/vinzdg/codenotch")}
          style={styles.rowHit}
        >
          <View style={styles.rowInner}>
            <Text style={[styles.rowLabel, { color: colors.accent }]}>About codenotch</Text>
          </View>
        </PressableRow>
      </View>

      <View style={[styles.group, { backgroundColor: colors.card, marginTop: spacing(4) }]}>
        <PressableRow onPress={confirmDisconnect} style={styles.rowHit} highlightColor="rgba(255,59,48,0.10)">
          <View style={styles.rowInner}>
            <Text style={[styles.rowLabel, styles.disconnect, { color: colors.critical }]}>
              Disconnect
            </Text>
          </View>
        </PressableRow>
      </View>

      <Text style={[styles.footerCaption, { color: colors.tertiaryLabel }]}>
        Pairing string — copy it to move the connection to another phone.
      </Text>
      <Text style={[styles.footer, { color: colors.tertiaryLabel }]} selectable>
        {config ? pairingString(config) : ""}
      </Text>
    </ScrollView>
  );
}

/** The connection's first row: a live dot, a state in words, an age. */
function StatusRow({ health, trailing }: { health: LinkHealth; trailing?: string }) {
  const colors = useTheme();
  const copy =
    health === "live"
      ? "Connected"
      : health === "stale"
        ? "Reconnecting…"
        : health === "down"
          ? "Can't reach the Mac"
          : "Syncing…";
  return (
    <View style={[styles.rowInner, styles.staticRow]}>
      <View style={styles.statusLead}>
        <StatusDot health={health} />
        <Text style={[styles.rowLabel, { color: colors.label }]}>{copy}</Text>
      </View>
      {trailing ? (
        <Text style={[styles.rowValue, { color: colors.secondaryLabel }]}>{trailing}</Text>
      ) : null}
    </View>
  );
}

function Row({
  label,
  value,
  mono,
  trailing,
}: {
  label: string;
  value: string;
  mono?: boolean;
  trailing?: React.ReactNode;
}) {
  const colors = useTheme();
  return (
    <View style={[styles.rowInner, styles.staticRow]}>
      <Text style={[styles.rowLabel, { color: colors.label }]}>{label}</Text>
      <View style={styles.trailing}>
        {trailing}
        <Text selectable style={[styles.rowValue, { color: colors.secondaryLabel }, mono && styles.mono]} numberOfLines={1}>
          {value}
        </Text>
      </View>
    </View>
  );
}

function Badge({ text, color }: { text: string; color: string }) {
  return (
    <View style={[styles.badge, { borderColor: color }]}>
      <Text style={[styles.badgeText, { color }]}>{text}</Text>
    </View>
  );
}

function Separator() {
  const colors = useTheme();
  return <View style={[styles.separator, { backgroundColor: colors.separator }]} />;
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing(4),
    paddingBottom: spacing(6),
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginTop: spacing(5),
    marginBottom: spacing(1.5),
  },
  sectionFooter: {
    fontSize: 12,
    lineHeight: 16,
    marginTop: spacing(1.5),
    paddingHorizontal: spacing(1),
  },
  group: {
    borderCurve: "continuous",
    overflow: "hidden",
  },
  rowHit: {
    paddingHorizontal: spacing(4),
  },
  rowInner: {
    paddingVertical: spacing(3.5),
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing(3),
  },
  staticRow: {
    paddingHorizontal: spacing(4),
  },
  statusLead: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(2.5),
  },
  rowTexts: {
    flex: 1,
    gap: 2,
  },
  rowLabel: {
    fontSize: 16,
  },
  rowHint: {
    fontSize: 12,
    marginTop: 2,
  },
  rowValue: {
    fontSize: 15,
    textAlign: "right",
    flexShrink: 1,
    fontVariant: ["tabular-nums"],
  },
  mono: {
    fontVariant: ["tabular-nums"],
  },
  trailing: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(2),
    flexShrink: 1,
  },
  inlineError: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(2),
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(2.5),
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  inlineErrorText: {
    fontSize: 12,
    lineHeight: 16,
    flex: 1,
  },
  inlineRetry: {
    fontSize: 13,
    fontWeight: "600",
  },
  badge: {
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: spacing(1.5),
    paddingVertical: 1,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: spacing(4),
  },
  readingRow: {
    flexDirection: "row",
    gap: spacing(3),
    padding: spacing(4),
    alignItems: "flex-start",
  },
  readingSeparator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: spacing(4) + 30 + spacing(3),
  },
  readingPlate: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  readingTexts: {
    flex: 1,
    gap: 2,
  },
  readingTitle: {
    fontSize: 15,
    fontWeight: "600",
  },
  readingBody: {
    fontSize: 13,
    lineHeight: 18,
  },
  tilde: {
    fontSize: 17,
    fontWeight: "700",
    lineHeight: 19,
  },
  disconnect: {
    textAlign: "center",
    width: "100%",
  },
  footerCaption: {
    fontSize: 11,
    textAlign: "center",
    marginTop: spacing(7),
    marginBottom: spacing(1),
  },
  footer: {
    fontSize: 10,
    textAlign: "center",
    fontVariant: ["tabular-nums"],
  },
});
