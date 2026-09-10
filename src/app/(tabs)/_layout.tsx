/** Tab bar: three peers, each keeping its own stack. Tabs never slide;
 * re-tapping the active tab pops to its root. Labels are set small and
 * slightly tracked, Apple-tab style; color alone carries selection. */
import { ColorValue, Platform, Pressable } from "react-native";
import { Tabs } from "expo-router";
import * as Haptics from "expo-haptics";
import { useTheme } from "../../theme";
import { Icon, type IconName } from "../../components/icon";

export default function TabsLayout() {
  const colors = useTheme();

  return (
    <Tabs
      screenListeners={{
        tabPress: () => {
          if (Platform.OS === "ios") Haptics.selectionAsync().catch(() => {});
        },
      }}
      screenOptions={{
        headerShadowVisible: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.tertiaryLabel,
        tabBarStyle: { backgroundColor: colors.card },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: "600",
          letterSpacing: 0.2,
        },
        tabBarButton: (props) => (
          <Pressable
            {...(props as any)}
            android_ripple={{ color: "rgba(127,127,127,0.2)", borderless: true }}
          />
        ),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Rings",
          tabBarIcon: ({ color, size }) => <TabIcon name="speedometer" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="sessions"
        options={{
          title: "Sessions",
          tabBarIcon: ({ color, size }) => <TabIcon name="terminal" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ color, size }) => <TabIcon name="gearshape" color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}

function TabIcon({ name, color, size }: { name: IconName; color: ColorValue; size: number }) {
  return <Icon name={name} size={size - 2} color={color} />;
}
