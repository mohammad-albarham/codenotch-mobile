/** Settings — the connection and its live state, what the readings mean, and
 * the way out. Everything the phone knows locally stays visible even when
 * the Mac goes quiet; only live values degrade. */
import { ActionSheetIOS, ActivityIndicator, Alert, Pressable, ScrollView, Share, StyleSheet, Text, View } from "react-native";
import Constants from "expo-constants";
import * as WebBrowser from "expo-web-browser";
import Animated from "react-native-reanimated";
import { radius, rgba, spacing, useTheme } from "../../../theme";
import { useConnection } from "../../../state/connection";
import { useRefreshNow, useSnapshot } from "../../../state/snapshot";
import { useNow } from "../../../hooks/use-now";
import { ageCopy } from "../../../lib/format";
import { pairingString } from "../../../lib/api";
import { PressableRow } from "../../../components/pressable";
import { Icon } from "../../../components/icon";
import { StatusDot, type LinkHealth } from "../../../components/flows/status-dot";
import { SettingsSkeleton } from "../../../components/flows/skeleton";
import { ErrorCard } from "../../../components/flows/error-card";
import { fadeIn, fadeOut, reflow, useRiseIn } from "../../../components/flows/motion";
import { haptic } from "../../../lib/haptics";

const APP_VERSION = Constants.expoConfig?.version ?? "—";
/** Past this age, a snapshot is no longer "live" — the poll has missed. */
const FRESH_MS = 90_000;

export default function SettingsScreen() {
  const colors = useTheme();
  const now = useNow();
  const riseIn = useRiseIn();
  const { config, disconnect } = useConnection();
  const snapshot = useSnapshot();
  const refreshNow = useRefreshNow();
  const data = snapshot.data;

  // A destructive confirm is the system action sheet on iOS and a Material
  // dialog on Android.
  const confirmDisconnect = () => {
    const title = "Disconnect from the Mac?";
    const message = "You'll need the pairing string again to reconnect.";
    const commit = () => {
      haptic.warning();
      void disconnect();
    };
    if (process.env.EXPO_OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title,
          message,
          options: ["Disconnect", "Cancel"],
          destructiveButtonIndex: 0,
          cancelButtonIndex: 1,
          userInterfaceStyle: colors.scheme,
        },
        (index) => {
          if (index === 0) commit();
        },
      );
      return;
    }
    Alert.alert(title, message, [
      { text: "Cancel", style: "cancel" },
      { text: "Disconnect", style: "destructive", onPress: commit },
    ]);
  };

  // A refresh the user asked for answers in the hand as well as on screen:
  // the status row turns "Connected · just now", or the inline error appears.
  const refresh = () =>
    refreshNow.mutate(undefined, {
      onSuccess: () => haptic.success(),
      onError: () => haptic.error(),
    });

  const sharePairing = () => {
    if (!config) return;
    Share.share({ message: pairingString(config) }).catch(() => {});
  };

  if (snapshot.isPending && !data) {
    return (
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
        <SettingsSkeleton />
      </ScrollView>
    );
  }

  const age = snapshot.dataUpdatedAt ? now.getTime() - snapshot.dataUpdatedAt : Number.POSITIVE_INFINITY;
  const health: LinkHealth = !data ? "down" : snapshot.isError || age > FRESH_MS ? "stale" : "live";
  const syncedAgo = data ? ageCopy(new Date(snapshot.dataUpdatedAt).toISOString(), now) : undefined;

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
      <Section title="Connection">
        <StatusRow health={health} trailing={syncedAgo} />
        <Separator />
        <Row label="Mac" value={data?.server.name ?? config?.serverName ?? "—"} />
        <Separator />
        <Row
          label="Address"
          value={config ? `${config.host}:${config.port}` : "—"}
          trailing={data?.server.demo ? <Badge text="DEMO" color={colors.watch} /> : undefined}
        />
        <Separator />
        <Row label="Paired with" value={config?.api === 2 ? "Codenotch for Mac" : "Python agent"} />
        {data ? (
          <>
            <Separator />
            <PressableRow
              onPress={refresh}
              disabled={refreshNow.isPending}
              style={styles.row}
              accessibilityRole="button"
            >
              <View style={styles.rowTexts}>
                <Text style={[styles.rowLabel, { color: colors.accent }]}>
                  {refreshNow.isPending ? "Refreshing…" : "Refresh now"}
                </Text>
                <Text style={[styles.rowHint, { color: colors.tertiaryLabel }]}>Asks the Mac for fresh readings</Text>
              </View>
              {refreshNow.isPending ? <ActivityIndicator size="small" color={colors.secondaryLabel} /> : null}
            </PressableRow>
          </>
        ) : null}
        {refreshNow.isError && !refreshNow.isPending ? (
          <Animated.View entering={fadeIn} exiting={fadeOut} style={[styles.inlineError, { borderTopColor: colors.separator }]}>
            <Icon name="exclamationmark.triangle" size={14} color={colors.critical} />
            <Text style={[styles.inlineErrorText, { color: colors.critical }]} numberOfLines={2}>
              {(refreshNow.error as Error)?.message ?? "Refresh failed"}
            </Text>
            <Pressable
              onPress={refresh}
              hitSlop={14}
              accessibilityRole="button"
              style={({ pressed }) => pressed && styles.textPressed}
            >
              <Text style={[styles.inlineRetry, { color: colors.accent }]}>Try again</Text>
            </Pressable>
          </Animated.View>
        ) : null}
      </Section>

      {!data && snapshot.isError ? (
        <Animated.View entering={riseIn(0)} exiting={fadeOut} layout={reflow}>
          <ErrorCard
            title="The readings stopped"
            message={(snapshot.error as Error)?.message ?? "The Mac didn't answer the last poll."}
            onRetry={() => snapshot.refetch()}
            retrying={snapshot.isFetching}
          />
        </Animated.View>
      ) : null}

      <Section title="Readings" footer="Readings stay on your network. The phone never sees tokens.">
        <ReadingRow
          plate={<Icon name="checkmark.circle" size={15} color={colors.accent} />}
          title="Official"
          body="Straight from the vendor's own usage endpoint — Claude and GLM, when a key exists on the Mac."
        />
        <Separator inset={spacing(4) + 30 + spacing(3)} />
        <ReadingRow
          plate={<Text style={[styles.tilde, { color: colors.accent }]}>~</Text>}
          title="Derived"
          body="Worked out from local files — Codex's rollout logs. Marked with ~ and never dressed up as official."
        />
      </Section>

      <Section
        title="Pairing"
        footer="Share the pairing string to move this connection to another phone. Anyone holding it can read your usage."
      >
        <PressableRow onPress={sharePairing} style={styles.row} accessibilityRole="button">
          <Text style={[styles.rowLabel, { color: colors.accent }]}>Share pairing string</Text>
          <Icon name="square.and.arrow.up" size={17} color={colors.accent} />
        </PressableRow>
      </Section>

      <Section title="About">
        <Row label="Version" value={`${APP_VERSION} · agent ${data?.server.version ?? "—"}`} />
        <Separator />
        <PressableRow
          onPress={() => WebBrowser.openBrowserAsync("https://github.com/vinzdg/codenotch").catch(() => {})}
          style={styles.row}
          accessibilityRole="link"
        >
          <Text style={[styles.rowLabel, { color: colors.label }]}>codenotch for Mac</Text>
          <Icon name="chevron.right" size={13} color={colors.tertiaryLabel} weight="semibold" />
        </PressableRow>
      </Section>

      <Animated.View layout={reflow} style={[styles.group, { backgroundColor: colors.card }]}>
        <PressableRow
          onPress={confirmDisconnect}
          style={[styles.row, styles.centerRow]}
          highlightColor={rgba(colors.critical, 0.12)}
          accessibilityRole="button"
        >
          <Text style={[styles.rowLabel, { color: colors.critical }]}>Disconnect</Text>
        </PressableRow>
      </Animated.View>
    </ScrollView>
  );
}

/** A grouped section. When a row comes or goes (the refresh error, the
 * refresh row itself once data lands) the card and everything below glide
 * rather than jump. */
function Section({ title, footer, children }: { title: string; footer?: string; children: React.ReactNode }) {
  const colors = useTheme();
  return (
    <Animated.View layout={reflow}>
      <Text style={[styles.sectionTitle, { color: colors.secondaryLabel }]}>{title}</Text>
      <Animated.View layout={reflow} style={[styles.group, { backgroundColor: colors.card }]}>
        {children}
      </Animated.View>
      {footer ? <Text style={[styles.sectionFooter, { color: colors.tertiaryLabel }]}>{footer}</Text> : null}
    </Animated.View>
  );
}

/** The connection's first row: a live dot, a state in words, an age. */
function StatusRow({ health, trailing }: { health: LinkHealth; trailing?: string }) {
  const colors = useTheme();
  const copy =
    health === "live" ? "Connected" : health === "stale" ? "Reconnecting…" : health === "down" ? "Can't reach the Mac" : "Syncing…";
  return (
    <View style={styles.row}>
      <View style={styles.statusLead}>
        <StatusDot health={health} />
        <Text style={[styles.rowLabel, { color: colors.label }]}>{copy}</Text>
      </View>
      {trailing ? <Text style={[styles.rowValue, { color: colors.secondaryLabel }]}>{trailing}</Text> : null}
    </View>
  );
}

function Row({ label, value, trailing }: { label: string; value: string; trailing?: React.ReactNode }) {
  const colors = useTheme();
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, { color: colors.label }]}>{label}</Text>
      <View style={styles.trailing}>
        {trailing}
        <Text selectable numberOfLines={1} style={[styles.rowValue, { color: colors.secondaryLabel }]}>
          {value}
        </Text>
      </View>
    </View>
  );
}

function ReadingRow({ plate, title, body }: { plate: React.ReactNode; title: string; body: string }) {
  const colors = useTheme();
  return (
    <View style={styles.readingRow}>
      <View style={[styles.readingPlate, { backgroundColor: rgba(colors.accent, 0.14) }]}>{plate}</View>
      <View style={styles.readingTexts}>
        <Text style={[styles.readingTitle, { color: colors.label }]}>{title}</Text>
        <Text style={[styles.readingBody, { color: colors.secondaryLabel }]}>{body}</Text>
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

function Separator({ inset = spacing(4) }: { inset?: number }) {
  const colors = useTheme();
  return <View style={[styles.separator, { backgroundColor: colors.separator, marginLeft: inset }]} />;
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing(4),
    paddingTop: spacing(2),
    paddingBottom: spacing(10),
    gap: spacing(6),
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: spacing(2),
    marginLeft: spacing(4),
  },
  sectionFooter: {
    fontSize: 12,
    lineHeight: 16,
    marginTop: spacing(2),
    paddingHorizontal: spacing(4),
  },
  group: {
    borderRadius: radius.card,
    borderCurve: "continuous",
    overflow: "hidden",
  },
  row: {
    minHeight: 52,
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(3),
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing(3),
  },
  centerRow: {
    justifyContent: "center",
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
  },
  rowValue: {
    fontSize: 15,
    textAlign: "right",
    flexShrink: 1,
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
  // A text button dims under the finger, as a bar button does.
  textPressed: {
    opacity: 0.4,
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
  },
  readingRow: {
    flexDirection: "row",
    gap: spacing(3),
    padding: spacing(4),
    alignItems: "flex-start",
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
});
