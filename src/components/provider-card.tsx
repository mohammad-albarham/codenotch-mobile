/** One provider on the overview grid. */
import { StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useTheme } from "../theme";
import { radius, spacing } from "../theme";
import { UsageRing, bandColor, type SessionOverlay } from "./usage-ring";
import { PressableCard } from "./pressable";
import { StatusNote } from "./status-note";
import { Entrance } from "./rings/entrance";
import { Sparkline, useTrend } from "./rings/sparkline";
import { ageCopy, percentText } from "../lib/format";
import { headlineWindow, hasReading, type ProviderSnapshot } from "../lib/types";

export function ProviderCard({
  provider,
  session,
  now,
  entranceIndex,
}: {
  provider: ProviderSnapshot;
  session?: SessionOverlay;
  now: Date;
  /** Stagger slot for the first-load entrance; omit to enter without motion. */
  entranceIndex?: number;
}) {
  const colors = useTheme();
  const router = useRouter();
  const headline = headlineWindow(provider);
  const reading = hasReading(provider);
  const stale = provider.status.kind === "stale";
  const qualifier = provider.fidelity === "official" ? "" : "~";
  const trend = useTrend(provider.id);
  const headlineFraction = headline?.usedFraction ?? null;
  const showTrend = reading && headlineFraction != null && trend.length >= 3;

  const card = (
    <PressableCard
      accessibilityRole="button"
      accessibilityLabel={`${provider.displayName}, ${
        reading && headlineFraction != null ? `${percentText(headlineFraction)} percent used` : "no reading"
      }`}
      onPress={() => router.push(`/provider/${provider.id}`)}
      style={[styles.card, { backgroundColor: colors.card, borderRadius: radius.card }]}
    >
      <View style={styles.header}>
        <Text numberOfLines={1} style={[styles.name, { color: colors.label }]}>
          {provider.displayName}
        </Text>
        {provider.account?.plan ? (
          <View style={[styles.planPill, { backgroundColor: colors.insetCard }]}>
            <Text numberOfLines={1} style={[styles.planText, { color: colors.secondaryLabel }]}>
              {String(provider.account.plan).toUpperCase()}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.ringWrap}>
        <UsageRing
          value={headlineFraction}
          size={96}
          colors={colors}
          hasReading={reading}
          dimmed={stale}
          session={session}
        />
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <View style={styles.ringCenter}>
            <Text style={[styles.ringText, { color: reading ? colors.label : colors.tertiaryLabel }]}>
              {reading && headlineFraction != null ? `${qualifier}${percentText(headlineFraction)}%` : "—"}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.headlineUnit}>
        <Text numberOfLines={1} style={[styles.headlineLabel, { color: colors.secondaryLabel }]}>
          {headline?.label ?? "No reading"}
        </Text>
        {showTrend && (
          <View style={styles.sparkWrap} pointerEvents="none">
            <Sparkline points={trend} color={bandColor(headlineFraction!, colors)} />
          </View>
        )}
      </View>

      {(provider.block || hasStatusLine(provider)) && (
        <View style={styles.footer}>
          <View style={[styles.footerRule, { backgroundColor: colors.separator }]} />
          <BlockLine provider={provider} now={now} />
          <StatusLine provider={provider} now={now} />
        </View>
      )}
    </PressableCard>
  );

  if (entranceIndex == null) return card;
  return (
    <Entrance index={entranceIndex}>
      {card}
    </Entrance>
  );
}

/** True when StatusLine below will render something. */
function hasStatusLine(p: ProviderSnapshot): boolean {
  switch (p.status.kind) {
    case "stale":
    case "needsAuth":
    case "accessDenied":
    case "unsupported":
    case "error":
      return true;
    default:
      return p.windows.length === 0;
  }
}

function BlockLine({ provider, now }: { provider: ProviderSnapshot; now: Date }) {
  const colors = useTheme();
  if (!provider.block) return null;
  const reset = provider.block.resetsAt ? new Date(provider.block.resetsAt) : null;
  const clock = reset && reset.getTime() > now.getTime()
    ? new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(reset)
    : null;
  return (
    <View style={[styles.banner, { backgroundColor: colors.insetCard }]}>
      <Text numberOfLines={1} style={[styles.bannerText, { color: colors.watch }]}>
        {provider.block.reason}
        {clock ? ` until ${clock}` : ""}
      </Text>
    </View>
  );
}

function StatusLine({ provider, now }: { provider: ProviderSnapshot; now: Date }) {
  const colors = useTheme();
  switch (provider.status.kind) {
    case "stale":
      return (
        <StatusNote icon="arrow.clockwise" text={`Updated ${ageCopy(provider.status.since, now)}`} color={colors.tertiaryLabel} />
      );
    case "needsAuth":
      return <StatusNote icon="person.crop.circle" text={authPrompt(provider.id, provider.displayName)} color={colors.secondaryLabel} />;
    case "accessDenied":
      return (
        <StatusNote
          icon="xmark.circle.fill"
          text="The Mac was refused access to the saved login"
          color={colors.secondaryLabel}
        />
      );
    case "unsupported":
      return <StatusNote icon="info.circle" text={provider.status.why ?? "No reading"} color={colors.tertiaryLabel} />;
    case "error":
      return <StatusNote icon="exclamationmark.triangle" text={provider.status.why ?? "No reading"} color={colors.tertiaryLabel} />;
    default:
      if (provider.windows.length === 0) {
        return <StatusNote icon="questionmark.circle" text="Waiting for the first reading…" color={colors.tertiaryLabel} />;
      }
      return null;
  }
}

function authPrompt(id: string, displayName: string): string {
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
    gap: spacing(2),
    borderCurve: "continuous",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing(2),
    minHeight: 22,
  },
  name: {
    fontSize: 17,
    fontWeight: "600",
    flexShrink: 1,
  },
  planPill: {
    borderRadius: radius.pill,
    paddingHorizontal: spacing(1.5),
    paddingVertical: 3,
    borderCurve: "continuous",
  },
  planText: {
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 0.6,
  },
  ringWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing(1),
  },
  ringCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  ringText: {
    fontSize: 22,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  headlineUnit: {
    alignItems: "center",
    gap: spacing(1),
  },
  headlineLabel: {
    fontSize: 13,
    textAlign: "center",
  },
  sparkWrap: {
    alignItems: "center",
    justifyContent: "center",
    height: 14,
  },
  footer: {
    gap: spacing(2),
    marginTop: spacing(0.5),
  },
  footerRule: {
    height: StyleSheet.hairlineWidth,
  },
  banner: {
    borderRadius: radius.input,
    paddingHorizontal: spacing(2.5),
    paddingVertical: spacing(1.5),
    borderCurve: "continuous",
  },
  bannerText: {
    fontSize: 12,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
});
