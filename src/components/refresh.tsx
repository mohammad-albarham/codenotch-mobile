/** Pull to refresh in the app's own colors. iOS keeps its neutral spinner;
 * on Android the Material disc takes the card surface and the accent arrow —
 * the default white disc flashes the wrong theme in dark mode. */
import { RefreshControl, type RefreshControlProps } from "react-native";
import { useTheme } from "../theme";

export function ThemedRefreshControl(props: RefreshControlProps) {
  const colors = useTheme();
  return (
    <RefreshControl
      tintColor={colors.secondaryLabel}
      colors={[colors.accent]}
      progressBackgroundColor={colors.card}
      {...props}
    />
  );
}
