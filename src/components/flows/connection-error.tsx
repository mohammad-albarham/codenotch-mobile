/** The error card for a failed snapshot, worded for what actually failed.
 *
 * `unknown-device` means the Mac has no record of this phone: it was removed
 * in Codenotch's settings, or the Mac's pairings were reset. Retrying can
 * never fix that, so the card offers Pair again instead. Error replies are
 * unauthenticated (PHONE-LINK-V3.md), so nothing is unpaired on the reply
 * alone — only when the person taps the button. */
import { isUnknownDevice } from "../../lib/api";
import { haptic } from "../../lib/haptics";
import { useConnection } from "../../state/connection";
import { ErrorCard } from "./error-card";

export function ConnectionErrorCard({
  error,
  onRetry,
  retrying,
}: {
  error: unknown;
  onRetry: () => void;
  retrying: boolean;
}) {
  const { config, disconnect } = useConnection();
  const mac = config?.api === 3;

  if (isUnknownDevice(error)) {
    return (
      <ErrorCard
        iconName="iphone"
        title="This Mac doesn't know this phone"
        message="It was removed in Codenotch on the Mac, or the Mac's pairings were reset."
        hint="Pair again to reconnect."
        actionText="Pair again"
        onRetry={() => {
          haptic.warning();
          void disconnect();
        }}
      />
    );
  }

  return (
    <ErrorCard
      title={mac ? "Can't reach your Mac" : "Can't reach the agent"}
      message={(error as Error | null)?.message ?? (mac ? "Couldn't reach your Mac" : "Couldn't reach the agent")}
      hint={
        mac
          ? "Is your Mac awake, on the same Wi-Fi, and is Codenotch open?"
          : "Is your Mac awake, on the same Wi-Fi, and is the agent running?"
      }
      onRetry={onRetry}
      retrying={retrying}
    />
  );
}
