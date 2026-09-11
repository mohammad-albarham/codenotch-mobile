/** The Mac stopped answering while readings are on screen: say so above
 * them, say how old they are, and make the whole strip the retry. Same shape
 * as the live-sessions banner on Rings — one dot, one sentence, one action.
 * The dot holds still: a pulse means someone is waiting on you. */
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { radius, rgba, spacing, useTheme } from "../../theme";
import { ageCopy } from "../../lib/format";
import { PressableCard } from "../pressable";

export function UnreachableBanner({
  lastReadingAt,
  now,
  retrying,
  onRetry,
}: {
  lastReadingAt: number;
  now: Date;
  retrying: boolean;
  onRetry: () => void;
}) {
  const colors = useTheme();
  const age = lastReadingAt ? ageCopy(new Date(lastReadingAt).toISOString(), now) : null;
  return (
    <PressableCard
      onPress={onRetry}
      disabled={retrying}
      accessibilityRole="button"
      accessibilityLabel={`Can't reach the Mac.${age ? ` Last reading ${age}.` : ""} Try again.`}
      style={[styles.banner, { backgroundColor: colors.card }]}
    >
      <View style={[styles.dotHalo, { backgroundColor: rgba(colors.critical, 0.16) }]}>
        <View style={[styles.dot, { backgroundColor: colors.critical }]} />
      </View>
      <View style={styles.texts}>
        <Text numberOfLines={1} style={[styles.title, { color: colors.label }]}>
          Can't reach the Mac
        </Text>
        {age ? (
          <Text numberOfLines={1} style={[styles.detail, { color: colors.secondaryLabel }]}>
            Last reading {age}
          </Text>
        ) : null}
      </View>
      {retrying ? (
        <ActivityIndicator size="small" color={colors.secondaryLabel} />
      ) : (
        <Text style={[styles.action, { color: colors.accent }]}>Try again</Text>
      )}
    </PressableCard>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(3),
    paddingVertical: spacing(3),
    paddingHorizontal: spacing(4),
    borderRadius: radius.card,
    borderCurve: "continuous",
    minHeight: 56,
  },
  dotHalo: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  texts: {
    flex: 1,
    gap: 1,
  },
  title: {
    fontSize: 15,
    fontWeight: "600",
  },
  detail: {
    fontSize: 13,
    fontVariant: ["tabular-nums"],
  },
  action: {
    fontSize: 15,
    fontWeight: "600",
  },
});
