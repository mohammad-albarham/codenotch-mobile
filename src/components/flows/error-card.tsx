/** An honest failure: what happened, what fixes it, one tap to retry. */
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useTheme } from "../../theme";
import { radius, spacing } from "../../theme";
import { PressableCard } from "../pressable";
import { Icon } from "../icon";

export function ErrorCard({
  title = "Can't reach the agent",
  message,
  hint = "Is your Mac awake, on the same Wi-Fi, and is the agent running?",
  onRetry,
  retrying = false,
}: {
  title?: string;
  message: string;
  hint?: string;
  onRetry: () => void;
  retrying?: boolean;
}) {
  const colors = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: colors.card }]}>
      <View style={[styles.plate, { backgroundColor: colors.ringTrack }]}>
        <Icon name="wifi" size={20} color={colors.critical} />
      </View>
      <Text style={[styles.title, { color: colors.label }]}>{title}</Text>
      <Text style={[styles.message, { color: colors.secondaryLabel }]}>{message}</Text>
      <Text style={[styles.hint, { color: colors.tertiaryLabel }]}>{hint}</Text>
      <PressableCard
        onPress={onRetry}
        disabled={retrying}
        accessibilityRole="button"
        accessibilityLabel="Try again"
        style={[styles.retry, { backgroundColor: colors.accent }]}
      >
        {retrying ? (
          <ActivityIndicator size="small" color={colors.onAccent} />
        ) : (
          <Icon name="arrow.clockwise" size={13} color={colors.onAccent} />
        )}
        <Text style={[styles.retryText, { color: colors.onAccent }]}>
          {retrying ? "Retrying…" : "Try again"}
        </Text>
      </PressableCard>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: "center",
    padding: spacing(6),
    gap: spacing(2),
    borderRadius: radius.card,
    borderCurve: "continuous",
  },
  plate: {
    width: 48,
    height: 48,
    borderRadius: radius.card,
    borderCurve: "continuous",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing(1),
  },
  title: {
    fontSize: 16,
    fontWeight: "600",
  },
  message: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
  },
  hint: {
    fontSize: 12,
    lineHeight: 16,
    textAlign: "center",
    maxWidth: 260,
  },
  retry: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(1.5),
    borderRadius: radius.pill,
    paddingHorizontal: spacing(3.5),
    paddingVertical: spacing(2),
    marginTop: spacing(2),
  },
  retryText: {
    fontSize: 14,
    fontWeight: "600",
  },
});
