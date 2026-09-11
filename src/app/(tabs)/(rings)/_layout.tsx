import { Stack } from "expo-router";
import { TabStack } from "../../../components/tab-stack";

// A deep link straight to a provider lands with Rings underneath, so back
// always has somewhere to go.
export const unstable_settings = {
  initialRouteName: "index",
};

/** Rings, and the provider detail it pushes — back returns to Rings. One
 * screen per provider: a double tap on a card, or a tap on its ring while
 * its detail is already open, lands on that one screen instead of stacking a
 * copy that back would have to unwind. */
export default function RingsStack() {
  return (
    <TabStack title="Rings">
      <Stack.Screen name="provider/[id]" options={{ title: "" }} dangerouslySingular />
    </TabStack>
  );
}
