/**
 * The notch, brought to the phone: a black panel with every provider's ring
 * side by side — the layout desktop codenotch uses on the top and bottom
 * edges. Black in both appearances, as it is on the Mac. Each cell is its
 * provider's mark inside the ring and the percent beneath; tapping one opens
 * that provider.
 */
import { StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { notch, radius, rgba, spacing, useTheme } from "../theme";
import { UsageRing, type SessionOverlay } from "./usage-ring";
import { ProviderGlyph } from "./glyphs/provider-glyph";
import { PressableScale } from "./pressable";
import { percentText } from "../lib/format";
import { headlineWindow, hasReading, type ProviderSnapshot } from "../lib/types";

const RING = 58;

export function NotchPanel({
  providers,
  claudeSession,
  refreshing,
}: {
  providers: ProviderSnapshot[];
  claudeSession: SessionOverlay;
  refreshing: boolean;
}) {
  const colors = useTheme();
  const visible = providers.filter((p) => hasReading(p) || p.status.kind === "stale");
  return (
    <View
      style={[
        styles.panel,
        // On a black phone the black notch needs an edge to be a shape at all.
        colors.scheme === "dark" && { borderColor: rgba("#FFFFFF", 0.1), borderWidth: StyleSheet.hairlineWidth },
      ]}
    >
      {visible.map((provider) => (
        <NotchCell
          key={provider.id}
          provider={provider}
          session={provider.id === "claude" ? claudeSession : null}
          refreshing={refreshing}
        />
      ))}
    </View>
  );
}

function NotchCell({
  provider,
  session,
  refreshing,
}: {
  provider: ProviderSnapshot;
  session: SessionOverlay;
  refreshing: boolean;
}) {
  const router = useRouter();
  const headline = headlineWindow(provider);
  const reading = hasReading(provider) && headline?.usedFraction != null;
  const fraction = headline?.usedFraction ?? null;
  const stale = provider.status.kind === "stale";
  const derived = provider.fidelity !== "official";
  const percent = reading && fraction != null ? `${derived ? "~" : ""}${percentText(fraction)}%` : "—";

  return (
    <PressableScale
      style={styles.cell}
      onPress={() => router.push(`/provider/${provider.id}`)}
      accessibilityRole="button"
      accessibilityLabel={`${provider.displayName}, ${
        reading && fraction != null ? `${derived ? "about " : ""}${percentText(fraction)} percent used` : "no reading"
      }${provider.block ? `, ${provider.block.reason.toLowerCase()}` : ""}${
        session === "waiting" ? ", a session is waiting on you" : session === "busy" ? ", working" : ""
      }`}
    >
      <UsageRing
        value={fraction}
        size={RING}
        colors={notch}
        hasReading={reading}
        dimmed={stale}
        blocked={!!provider.block}
        session={session}
        refreshing={refreshing}
      >
        <ProviderGlyph providerId={provider.id} displayName={provider.displayName} size={RING * 0.393} color={notch.label} />
      </UsageRing>
      <Text
        numberOfLines={1}
        // The notch is a fixed instrument: its numbers grow with Dynamic
        // Type, but not past the cell they sit in.
        maxFontSizeMultiplier={1.3}
        adjustsFontSizeToFit
        style={[styles.percent, { color: reading ? notch.label : notch.secondaryLabel }, stale && styles.dimmed]}
      >
        {percent}
      </Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  panel: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    columnGap: spacing(3),
    rowGap: spacing(4),
    backgroundColor: notch.background,
    borderRadius: radius.notch,
    borderCurve: "continuous",
    paddingTop: spacing(5),
    paddingBottom: spacing(4.5),
    paddingHorizontal: spacing(2),
  },
  cell: {
    width: RING,
    alignItems: "center",
    gap: spacing(2.5),
  },
  percent: {
    fontSize: 17,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
    letterSpacing: -0.2,
  },
  dimmed: { opacity: 0.45 },
});
