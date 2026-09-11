/** Haptics are punctuation: one per outcome the user caused, on the same
 * frame as the visual, never the only feedback. iOS gets its notification
 * generator; Android gets the system's own haptic constants rather than a
 * simulated vibration pattern, which buzzes instead of clicks. */
import * as Haptics from "expo-haptics";

const android = process.env.EXPO_OS === "android";

function fire(promise: Promise<void>) {
  promise.catch(() => {});
}

export const haptic = {
  /** Something the user asked for worked: paired, refreshed. */
  success() {
    fire(
      android
        ? Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Confirm)
        : Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
    );
  },
  /** Something the user asked for failed: a wrong code, a refresh that
   * couldn't reach the Mac. */
  error() {
    fire(
      android
        ? Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Reject)
        : Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),
    );
  },
  /** A destructive choice was committed. */
  warning() {
    fire(
      android
        ? Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Confirm)
        : Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning),
    );
  },
};
