/** One provider's usage, as desktop codenotch's hover card shows it: the mark
 * and "Claude Usage", then every window — label and reset, bar, "% Used".
 * Honest states replace the windows when there is no reading. Tapping opens
 * the provider. */
import { StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { radius, spacing, useTheme } from "../theme";
import { PressableCard } from "./pressable";
import { StatusNote } from "./status-note";
import { WindowRow } from "./window-row";
import { Icon } from "./icon";
import { ProviderGlyph } from "./glyphs/provider-glyph";
import { ageCopy, untilClock } from "../lib/format";
import type { ProviderSnapshot } from "../lib/types";

export function ProviderCard({ provider, now }: { provider: ProviderSnapshot; now: Date }) {
  const colors = useTheme();
  const router = useRouter();
  const stale = provider.status.kind === "stale";
  const derived = provider.fidelity !== "official";

  return (
    <PressableCard
      accessibilityRole="button"
      accessibilityHint="Opens the provider's details"
      onPress={() => router.push(`/provider/${provider.id}`)}
      style={[styles.card, { backgroundColor: colors.card }]}
    >
      <View style={styles.header}>
        <ProviderGlyph providerId={provider.id} displayName={provider.displayName} size={20} color={colors.label} />
        <Text numberOfLines={1} style={[styles.title, { color: colors.label }]}>
          {provider.displayName} Usage
        </Text>
        {provider.account?.plan ? (
          <View style={[styles.planPill, { backgroundColor: colors.insetCard }]}>
            <Text numberOfLines={1} style={[styles.planText, { color: colors.secondaryLabel }]}>
              {String(provider.account.plan).toUpperCase()}
            </Text>
          </View>
        ) : null}
        <Icon name="chevron.right" size={13} color={colors.tertiaryLabel} weight="semibold" />
      </View>

      {provider.block ? <BlockBanner reason={provider.block.reason} resetsAt={provider.block.resetsAt} now={now} /> : null}

      {provider.windows.length > 0 ? (
        <View style={styles.windows}>
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
      ) : null}

      <StatusLine provider={provider} now={now} />
    </PressableCard>
  );
}

export function BlockBanner({ reason, resetsAt, now }: { reason: string; resetsAt: string | null; now: Date }) {
  const colors = useTheme();
  const clock = untilClock(resetsAt, now);
  return (
    <View style={[styles.block, { backgroundColor: colors.insetCard }]}>
      <Icon name="exclamationmark.triangle" size={14} color={colors.critical} />
      <Text style={[styles.blockText, { color: colors.label }]}>
        {reason}
        {clock ? ` until ${clock}` : ""}
      </Text>
    </View>
  );
}

/** The honest-state line: stale age, or why there is no reading. Renders
 * nothing for a fresh, complete reading. */
function StatusLine({ provider, now }: { provider: ProviderSnapshot; now: Date }) {
  const colors = useTheme();
  switch (provider.status.kind) {
    case "stale":
      return <StatusNote icon="arrow.clockwise" text={`Updated ${ageCopy(provider.status.since, now)}`} color={colors.tertiaryLabel} />;
    case "needsAuth":
      return <StatusNote icon="person.crop.circle" text={authPrompt(provider.id, provider.displayName)} color={colors.secondaryLabel} />;
    case "accessDenied":
      return <StatusNote icon="xmark.circle.fill" text="The Mac was refused access to the saved login" color={colors.secondaryLabel} />;
    case "unsupported":
      return <StatusNote icon="info.circle" text={provider.status.why ?? "No reading"} color={colors.secondaryLabel} />;
    case "error":
      return <StatusNote icon="exclamationmark.triangle" text={provider.status.why ?? "No reading"} color={colors.secondaryLabel} />;
    default:
      if (provider.windows.length === 0) {
        return <StatusNote icon="questionmark.circle" text="Waiting for the first reading…" color={colors.secondaryLabel} />;
      }
      return null;
  }
}

export function authPrompt(id: string, displayName: string): string {
  switch (id) {
    case "claude":
      return "Run Claude Code once to refresh the token";
    case "cursor":
      return "Sign in to Cursor in the editor";
    case "codex":
      return "Sign in to Codex to read your usage";
    case "glm":
      return "Set up a GLM Coding Plan key on the Mac";
    default:
      return `Sign in to ${displayName} to read your usage`;
  }
}

const styles = StyleSheet.create({
  card: {
    padding: spacing(4),
    gap: spacing(4),
    borderRadius: radius.card,
    borderCurve: "continuous",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(2.5),
    minHeight: 24,
  },
  title: {
    fontSize: 17,
    fontWeight: "600",
    flex: 1,
  },
  planPill: {
    borderRadius: radius.pill,
    paddingHorizontal: spacing(2),
    paddingVertical: 3,
  },
  planText: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.6,
  },
  windows: {
    gap: spacing(5),
  },
  block: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(2),
    borderRadius: radius.input,
    borderCurve: "continuous",
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2.5),
  },
  blockText: {
    fontSize: 13,
    fontWeight: "500",
    flex: 1,
    fontVariant: ["tabular-nums"],
  },
});
