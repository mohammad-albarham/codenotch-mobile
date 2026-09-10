import { Stack } from "expo-router";
import { TabStack } from "../../../components/tab-stack";

// A deep link straight to a provider lands with Rings underneath, so back
// always has somewhere to go.
export const unstable_settings = {
  initialRouteName: "index",
};

/** Rings, and the provider detail it pushes — back returns to Rings. */
export default function RingsStack() {
  return (
    <TabStack title="Rings">
      <Stack.Screen name="provider/[id]" options={{ title: "" }} />
    </TabStack>
  );
}
