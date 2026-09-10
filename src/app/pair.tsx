/**
 * Pairing — a one-way door. You arrive here unpaired; you leave by landing
 * on Home with `replace`, so back can never re-enter this screen. The guard
 * in the root layout removes it from the stack entirely once paired.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { useRouter, useLocalSearchParams } from "expo-router";
import Animated, {
  Keyframe,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import * as Linking from "expo-linking";
import * as Device from "expo-device";
import { notch, radius, rgba, spacing, useTheme } from "../theme";
import { useConnection } from "../state/connection";
import { ApiError, pair, parsePairingString } from "../lib/api";
import { PressableCard } from "../components/pressable";
import { Icon } from "../components/icon";
import { UsageRing } from "../components/usage-ring";
import { ProviderGlyph } from "../components/glyphs/provider-glyph";
import { easeOut, fadeIn, fadeOut, reflow, riseIn } from "../components/flows/motion";

/** The success micro-moment: the checkmark lands (200ms) and is seen for a
 * beat before the door closes. */
const SUCCESS_HOLD_MS = 450;

/** "Connected" arrives from a hair smaller — never from nothing. */
const CONFIRM_IN = new Keyframe({
  0: { opacity: 0, transform: [{ scale: 0.9 }] },
  100: { opacity: 1, transform: [{ scale: 1 }], easing: easeOut },
}).duration(200);

/** The field says no the way macOS does: a short, decaying shake. */
const SHAKE = [-8, 8, -6, 6, -3, 0];
const SHAKE_STEP_MS = 45;

export default function PairScreen() {
  const colors = useTheme();
  const reduceMotion = useReducedMotion();
  const router = useRouter();
  const params = useLocalSearchParams<{ pairing?: string }>();
  const { pair: storePairing } = useConnection();
  const [text, setText] = useState("");
  const [focused, setFocused] = useState(false);
  const [state, setState] = useState<"idle" | "connecting" | "error">("idle");
  const [justPaired, setJustPaired] = useState(false);
  const [error, setError] = useState<{ title: string; body: string } | null>(null);
  const navigateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shake = useSharedValue(0);
  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shake.get() }] }));

  useEffect(() => {
    return () => {
      if (navigateTimer.current) clearTimeout(navigateTimer.current);
    };
  }, []);

  // codenotch:// deep links land here prefilled, cold or warm. Expo Go
  // prefixes the scheme with exp+, so match both shapes. A link that already
  // carries a valid pairing string pairs immediately — opening the link IS
  // the confirmation, like scanning a QR code.
  const connectRef = useRef<(value: string) => void>(() => {});

  useEffect(() => {
    const sub = Linking.addEventListener("url", ({ url }) => {
      if (/^(exp\+)?codenotch:\/\//.test(url)) {
        setText(url);
        connectRef.current(url);
      }
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (typeof params.pairing === "string" && params.pairing) {
      setText(params.pairing);
      connectRef.current(params.pairing);
    }
  }, [params.pairing]);

  const config = useMemo(() => parsePairingString(text), [text]);

  const connect = async (raw?: string) => {
    const parsed = raw !== undefined ? parsePairingString(raw) : config;
    if (!parsed || state === "connecting" || justPaired) return;
    setState("connecting");
    setError(null);
    try {
      const info = await pair(parsed, Device.deviceName ?? Device.modelName ?? "Phone");
      await storePairing(parsed, info.server);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setJustPaired(true);
      // Let the checkmark land before the door closes — skipped under
      // Reduce Motion.
      if (reduceMotion) {
        router.replace("/");
      } else {
        navigateTimer.current = setTimeout(() => router.replace("/"), SUCCESS_HOLD_MS);
      }
    } catch (e) {
      // Shake and buzz on the same frame; the red edge and the card below
      // carry it alone under Reduce Motion or with haptics off.
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      if (!reduceMotion) {
        shake.set(withSequence(...SHAKE.map((x) => withTiming(x, { duration: SHAKE_STEP_MS }))));
      }
      setState("error");
      if (e instanceof ApiError) {
        if (e.kind === "unreachable") {
          setError({
            title: "The Mac isn't answering",
            body: "Is the phone on the same Wi-Fi, and is the agent running? Check the address and try again.",
          });
        } else if (e.kind === "clock-skew") {
          setError({
            title: "Clocks disagree",
            body: "Set the phone's clock to automatic (Settings › General › Date & Time) and try again.",
          });
        } else {
          setError({ title: "The agent said no", body: "The pairing code doesn't match. Copy the string again from the agent's window." });
        }
      } else {
        setError({ title: "Something went wrong", body: String(e) });
      }
    }
  };

  // The deep-link listeners below can fire before `connect` exists on first
  // render; hand them the latest one. Assigned during render so it is never
  // a stale no-op on mount.
  connectRef.current = (value: string) => {
    void connect(value);
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={["top", "bottom"]}>
      {/* Padding on both platforms: Android is edge-to-edge, so the window no
      longer resizes for the keyboard and Connect would sit under it. */}
      <KeyboardAvoidingView style={styles.flex} behavior="padding">
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Animated.View entering={riseIn(0)} style={[styles.hero, colors.scheme === "dark" && styles.heroEdge]}>
            {/* The notch, not yet connected: every mark in an empty track —
            no reading, so no arc. */}
            {["claude", "codex", "glm"].map((id) => (
              <UsageRing key={id} value={null} size={44} colors={notch} hasReading={false}>
                <ProviderGlyph providerId={id} size={44 * 0.393} color={notch.label} />
              </UsageRing>
            ))}
          </Animated.View>

          <Animated.View entering={riseIn(1)} style={styles.intro}>
            <Text style={[styles.title, { color: colors.label }]}>Connect to your Mac</Text>
            <Text style={[styles.body, { color: colors.secondaryLabel }]}>
              Your usage lives on the Mac, so a tiny agent reads it there and answers only your
              network.
            </Text>
          </Animated.View>

          <Animated.View entering={riseIn(2)} style={styles.steps}>
            <View style={styles.step}>
              <View style={[styles.stepNum, { backgroundColor: rgba(colors.accent, 0.12) }]}>
                <Text style={[styles.stepNumText, { color: colors.accent }]}>1</Text>
              </View>
              <Text style={[styles.stepText, { color: colors.secondaryLabel }]}>
                Run the agent on your Mac
              </Text>
            </View>
            <View style={styles.step}>
              <View style={[styles.stepNum, { backgroundColor: rgba(colors.accent, 0.12) }]}>
                <Text style={[styles.stepNumText, { color: colors.accent }]}>2</Text>
              </View>
              <Text style={[styles.stepText, { color: colors.secondaryLabel }]}>
                Paste its pairing string below
              </Text>
            </View>
          </Animated.View>

          <Animated.View entering={riseIn(3)}>
            <Animated.View style={shakeStyle}>
              <TextInput
                value={text}
                onChangeText={(value) => {
                  setText(value);
                  if (state === "error") {
                    setState("idle");
                    setError(null);
                  }
                }}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                editable={state !== "connecting" && !justPaired}
                autoCapitalize="none"
                autoCorrect={false}
                spellCheck={false}
                keyboardAppearance={colors.scheme}
                placeholder="codenotch://192.168.1.20:8787/…"
                placeholderTextColor={colors.tertiaryLabel}
                selectionColor={colors.accent}
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.card,
                    color: colors.label,
                    borderColor: state === "error"
                      ? colors.critical
                      : text && !config
                        ? colors.watch
                        : focused
                          ? rgba(colors.accent, 0.4)
                          : colors.separator,
                  },
                ]}
              />
            </Animated.View>
            {text && !config ? (
              <Animated.Text
                entering={fadeIn}
                exiting={fadeOut}
                style={[styles.fieldHint, { color: colors.tertiaryLabel }]}
              >
                That doesn't look like a pairing string — it starts with codenotch://
              </Animated.Text>
            ) : null}

            {error ? (
              <Animated.View
                entering={riseIn(0)}
                exiting={fadeOut}
                layout={reflow}
                style={[styles.errorCard, { backgroundColor: colors.card }]}
              >
                <Icon name="exclamationmark.triangle" size={18} color={colors.critical} />
                <View style={styles.errorTexts}>
                  <Text style={[styles.errorTitle, { color: colors.label }]}>{error.title}</Text>
                  <Text style={[styles.errorBody, { color: colors.secondaryLabel }]}>{error.body}</Text>
                </View>
              </Animated.View>
            ) : null}

            {/* The button and hint make room for the error card by gliding,
            not jumping — the button is where the thumb is. */}
            <Animated.View layout={reflow}>
              <PressableCard
                onPress={() => void connect()}
                disabled={!config || state === "connecting" || justPaired}
                accessibilityRole="button"
                accessibilityLabel="Connect"
                style={[
                  styles.button,
                  { backgroundColor: config && state !== "connecting" ? colors.accent : colors.ringTrack },
                ]}
              >
                {justPaired ? (
                  <Animated.View entering={CONFIRM_IN} style={styles.buttonConnected}>
                    <Icon name="checkmark.circle" size={17} color={colors.onAccent} />
                    <Text style={[styles.buttonText, { color: colors.onAccent }]}>Connected</Text>
                  </Animated.View>
                ) : (
                  <Text
                    style={[
                      styles.buttonText,
                      { color: config && state !== "connecting" ? colors.onAccent : colors.tertiaryLabel },
                    ]}
                  >
                    {state === "connecting" ? "Connecting…" : "Connect"}
                  </Text>
                )}
              </PressableCard>

              <Text style={[styles.hint, { color: colors.tertiaryLabel }]}>
                Run it on the Mac:{" "}
                <Text style={styles.mono}>python3 agent/codenotch_agent.py</Text>
              </Text>
            </Animated.View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  content: {
    flexGrow: 1,
    justifyContent: "center",
    padding: spacing(6),
    paddingBottom: spacing(12),
    gap: spacing(4),
  },
  hero: {
    flexDirection: "row",
    gap: spacing(4),
    alignSelf: "center",
    backgroundColor: notch.background,
    borderRadius: radius.notch,
    borderCurve: "continuous",
    paddingHorizontal: spacing(5),
    paddingVertical: spacing(4),
    marginBottom: spacing(2),
  },
  heroEdge: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.12)",
  },
  intro: {
    gap: spacing(2),
  },
  title: {
    fontSize: 26,
    fontWeight: "700",
    textAlign: "center",
    marginTop: spacing(2),
  },
  body: {
    fontSize: 15,
    lineHeight: 21,
    textAlign: "center",
    paddingHorizontal: spacing(2),
  },
  steps: {
    alignSelf: "center",
    gap: spacing(2.5),
  },
  step: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(2.5),
  },
  stepNum: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  stepNumText: {
    fontSize: 12,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  stepText: {
    fontSize: 13,
  },
  input: {
    borderRadius: radius.input,
    borderCurve: "continuous",
    borderWidth: 1,
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(3.5),
    fontSize: 14,
    fontFamily: Platform.select({ ios: "Menlo", default: "monospace" }),
  },
  fieldHint: {
    fontSize: 12,
    marginTop: spacing(2),
    paddingHorizontal: spacing(1),
  },
  errorCard: {
    flexDirection: "row",
    gap: spacing(3),
    padding: spacing(4),
    borderRadius: radius.card,
    borderCurve: "continuous",
    alignItems: "flex-start",
    marginTop: spacing(4),
  },
  errorTexts: {
    flex: 1,
    gap: 2,
  },
  errorTitle: {
    fontSize: 15,
    fontWeight: "600",
  },
  errorBody: {
    fontSize: 13,
    lineHeight: 18,
  },
  button: {
    borderRadius: radius.pill,
    paddingVertical: spacing(4),
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing(4),
    minHeight: 52,
  },
  buttonConnected: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(2),
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "700",
  },
  hint: {
    fontSize: 12,
    textAlign: "center",
    marginTop: spacing(2),
  },
  mono: {
    fontFamily: Platform.select({ ios: "Menlo", default: "monospace" }),
    fontSize: 11,
  },
});
