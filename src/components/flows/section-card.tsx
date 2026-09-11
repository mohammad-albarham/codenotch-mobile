/** A grouped section: a tight uppercase header above one continuous card,
 * rows separated by hairlines inset to the text edge. The card rises in when
 * it first appears, with a small per-section stagger. After that the list is
 * live: a row that joins fades in, one that leaves fades out, and the card
 * and the sections below it glide to their new places instead of jumping.
 * Rows present when the card mounts arrive with the card, not on their own. */
import { Children, isValidElement } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { LayoutAnimationConfig } from "react-native-reanimated";
import { useTheme } from "../../theme";
import { radius, spacing } from "../../theme";
import { fadeIn, fadeOut, reflow, useRiseIn } from "./motion";

export function SectionCard({
  title,
  children,
  index = 0,
  separatorInset = spacing(4),
}: {
  title: string;
  children: React.ReactNode;
  /** Stagger position among sibling sections on first load. */
  index?: number;
  /** How far the hairlines are inset from the card's left edge, so they
   * start at the text, not the card. */
  separatorInset?: number;
}) {
  const colors = useTheme();
  const riseIn = useRiseIn();
  const kids = Children.toArray(children);
  return (
    <Animated.View entering={riseIn(index)} exiting={fadeOut} layout={reflow}>
      <Text style={[styles.title, { color: colors.secondaryLabel }]}>{title}</Text>
      <Animated.View layout={reflow} style={[styles.card, { backgroundColor: colors.card }]}>
        <LayoutAnimationConfig skipEntering>
          {kids.map((kid, i) => (
            <Animated.View
              key={isValidElement(kid) && kid.key != null ? kid.key : i}
              entering={fadeIn}
              exiting={fadeOut}
              layout={reflow}
            >
              {i > 0 ? (
                <View style={[styles.separator, { backgroundColor: colors.separator, marginLeft: separatorInset }]} />
              ) : null}
              {kid}
            </Animated.View>
          ))}
        </LayoutAnimationConfig>
      </Animated.View>
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
