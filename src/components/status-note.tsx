/** An inline, honest status line — what went wrong and, when we know, what fixes it. */
import { StyleSheet, Text, View } from "react-native";
import { spacing } from "../theme";
import { Icon, type IconName } from "./icon";

export type StatusNoteIcon = IconName;

export function StatusNote({
  icon,
  text,
  color,
}: {
  icon: IconName;
  text: string;
  color: string;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.iconPlate}>
        <Icon name={icon} size={14} color={color} />
      </View>
      <Text numberOfLines={2} style={[styles.text, { color }]}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing(1.5),
    paddingHorizontal: spacing(0.5),
  },
  iconPlate: {
    width: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  text: {
    fontSize: 12,
    flex: 1,
    lineHeight: 16,
  },
});
