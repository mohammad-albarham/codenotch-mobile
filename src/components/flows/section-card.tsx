/** A grouped section: a tight uppercase header above one continuous card,
 * rows separated by hairlines inset to the text edge. The card enters once,
 * on first load, with a small per-section delay. */
import { Children } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown, useReducedMotion } from "react-native-reanimated";
import { useTheme } from "../../theme";
import { radius, spacing } from "../../theme";
import { easeOut } from "./motion";

export function SectionCard({
  title,
  children,
  delay = 0,
  separatorInset = spacing(4),
}: {
  title: string;
  children: React.ReactNode;
  /** Delay in ms — stagger siblings on first load. */
  delay?: number;
  /** How far the hairlines are inset from the card's left edge, so they
   * start at the text, not the card. */
  separatorInset?: number;
}) {
  const colors = useTheme();
  const reduceMotion = useReducedMotion();
  const kids = Children.toArray(children);
  return (
    <Animated.View
      entering={
        reduceMotion ? undefined : FadeInDown.duration(240).delay(delay).easing(easeOut)
      }
    >
      <Text style={[styles.title, { color: colors.secondaryLabel }]}>{title}</Text>
      <View style={[styles.card, { backgroundColor: colors.card }]}>
        {kids.map((kid, i) => (
          <View key={i}>
            {i > 0 ? (
              <View style={[styles.separator, { backgroundColor: colors.separator, marginLeft: separatorInset }]} />
            ) : null}
            {kid}
          </View>
        ))}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: spacing(2),
    marginLeft: spacing(4),
  },
  card: {
    borderRadius: radius.card,
    borderCurve: "continuous",
    overflow: "hidden",
  },
  separator: {
    height: StyleSheet.hairlineWidth,
  },
});
