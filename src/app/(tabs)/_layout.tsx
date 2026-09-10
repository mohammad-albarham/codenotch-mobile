/** The tab bar: the system's own (Liquid Glass on iOS 26, Material on
 * Android) — three peers, each keeping its own stack; re-tapping the active
 * tab pops to its root. Tabs are met a hundred times a day, so they get the
 * platform's behavior and nothing added. Sessions wears a badge while
 * something is waiting on you. */
import { NativeTabs } from "expo-router/unstable-native-tabs";
import { rgba, useTheme } from "../../theme";
import { useSnapshot } from "../../state/snapshot";

export default function TabsLayout() {
  const colors = useTheme();
  const waiting = useSnapshot().data?.sessions.filter((s) => s.state === "waiting").length ?? 0;

  return (
    <NativeTabs
      tintColor={colors.accent}
      iconColor={{ default: colors.secondaryLabel, selected: colors.accent }}
      labelStyle={{ default: { color: colors.secondaryLabel }, selected: { color: colors.accent } }}
      backgroundColor={process.env.EXPO_OS === "android" ? colors.card : undefined}
      indicatorColor={rgba(colors.accent, 0.16)}
      badgeBackgroundColor={colors.watch}
      badgeTextColor={colors.scheme === "dark" ? "#000000" : "#FFFFFF"}
    >
      <NativeTabs.Trigger name="(rings)">
        <NativeTabs.Trigger.Label>Rings</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="gauge.with.needle" md="speed" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="sessions">
        <NativeTabs.Trigger.Label>Sessions</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="terminal" md="terminal" />
        {waiting > 0 ? <NativeTabs.Trigger.Badge>{String(waiting)}</NativeTabs.Trigger.Badge> : null}
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="settings">
        <NativeTabs.Trigger.Label>Settings</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="gearshape" md="settings" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
