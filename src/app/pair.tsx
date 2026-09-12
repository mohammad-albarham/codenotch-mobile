/**
 * Pairing — a one-way door. Storing the pairing flips the root layout's
 * guard, which removes this screen from the stack entirely and lands on
 * Home — back can never re-enter it.
 *
 * The column is centered, so anything that changes its height moves every
 * block in it, and they all move by relayout, frame by frame: the keyboard's
 * own curve drives the padding beneath the column, and the hint and the
 * error card open by their height. No block carries a layout transition —
 * one would chase the keyboard's per-frame relayout and fall behind it.
 */
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Platform, ScrollView, StyleSheet, Text, TextInput, View, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
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
import { prefetchSnapshot } from "../state/snapshot";
import { ApiError, pair, pairV3 } from "../lib/api";
import { parsePairingLink, type PairingInfo } from "../lib/pairing";
import { PressableCard } from "../components/pressable";
import { Icon } from "../components/icon";
import { easeOut, useRiseIn } from "../components/flows/motion";
import { Reveal } from "../components/flows/reveal";
import { haptic } from "../lib/haptics";
import * as Clipboard from "expo-clipboard";
import * as ImagePicker from "expo-image-picker";
import { consumeScanHandoff } from "../lib/scan-handoff";
import { scanFromURLAsync } from "expo-camera";

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

/** The success micro-moment: the checkmark lands (200ms) and is seen for a
 * beat before the door closes. The first reading is fetched meanwhile, so
 * Rings arrives full — but a slow Mac never holds the door past
 * PREFETCH_CAP_MS; Rings shows its skeleton instead. */
const SUCCESS_HOLD_MS = 450;
const PREFETCH_CAP_MS = 1200;

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

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
  const riseIn = useRiseIn();
  const queryClient = useQueryClient();
  const router = useRouter();
  const params = useLocalSearchParams<{ pairing?: string; v?: string; h?: string; p?: string; c?: string; n?: string }>();
  const { pair: storePairing, repairRequired } = useConnection();
  const [text, setText] = useState("");
  const [focused, setFocused] = useState(false);
  const [state, setState] = useState<"idle" | "connecting" | "error">("idle");
  const [justPaired, setJustPaired] = useState(false);
  // The last error stays in state while its card closes, so the card
  // collapses around what it said.
  const [error, setError] = useState<{ title: string; body: string } | null>(
    repairRequired
      ? { title: "Re-pair your phone after updating", body: "Scan the new code on your Mac to use the encrypted connection." }
      : null,
  );
  const [errorOpen, setErrorOpen] = useState(repairRequired);
  const shake = useSharedValue(0);
  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shake.get() }] }));

  const inFlightRef = useRef(false);
  const handledLinkRef = useRef<string | null>(null);

  const connectRef = useRef<(value: string) => void>(() => {});

  const connect = async (raw?: string) => {
    const rawToUse = raw !== undefined ? raw : text;
    if (inFlightRef.current) return;

    if (handledLinkRef.current === rawToUse) {
      return;
    }

    const parsed = parsePairingLink(rawToUse);
    if (!parsed || state === "connecting" || justPaired) return;
    
    inFlightRef.current = true;
    handledLinkRef.current = rawToUse;
    // An open error card stays through the retry — closing it for the
    // request's few milliseconds would only blink it.
    setState("connecting");
    try {
      let info;
      let finalConfig;
      if (parsed.version !== 1) {
        info = await pairV3(parsed, Device.deviceName ?? Device.modelName ?? "Phone", Platform.OS as "ios" | "android" | "web");
        finalConfig = info.config;
      } else {
        info = await pair(parsed, Device.deviceName ?? Device.modelName ?? "Phone");
        finalConfig = { host: parsed.host, port: parsed.port, secret: parsed.secret, api: 1 as const };
      }
      
      haptic.success();
      setErrorOpen(false);
      setJustPaired(true);
      // Let the checkmark land (skipped under Reduce Motion) while the first
      // reading loads, then store the pairing: the root guard flips and the
      // door closes — once, with the root's fade.
      await Promise.all([
        wait(reduceMotion ? 0 : SUCCESS_HOLD_MS),
        Promise.race([prefetchSnapshot(queryClient, finalConfig).catch(() => {}), wait(PREFETCH_CAP_MS)]),
      ]);
      await storePairing(finalConfig, info.server);
    } catch (e) {
      setJustPaired(false);
      handledLinkRef.current = null;
      // Shake and buzz on the same frame; the red edge and the card below
      // carry it alone under Reduce Motion or with haptics off.
      haptic.error();
      if (!reduceMotion) {
        shake.set(withSequence(...SHAKE.map((x) => withTiming(x, { duration: SHAKE_STEP_MS }))));
      }
      setState("error");
      if (e instanceof ApiError) {
        if (e.kind === "unreachable") {
          const serverName = parsed && "serverName" in parsed && parsed.serverName ? parsed.serverName : "your Mac";
          setError({
            title: `Can't reach ${serverName}`,
            body: parsed?.version !== 1
              ? "Is your Mac awake, on the same Wi-Fi, and is Codenotch open?" 
              : "Make sure your phone is on the same Wi-Fi as your Mac and Codenotch is open.",
          });
        } else if (e.kind === "out-of-date") {
          setError({
            title: "Your Mac app is out of date",
            body: "Update Codenotch on your Mac, then scan its new pairing code.",
          });
        } else if (e.kind === "clock-skew") {
          setError({
            title: "Clocks disagree",
            body: "Set the phone's clock to automatic (Settings › General › Date & Time) and try again.",
          });
        } else if (e.kind === "code-expired") {
          setError({
            title: "That code expired",
            body: "Your Mac is already showing a fresh one — scan it again.",
          });
        } else {
          setError({
            title: "That code didn't work",
            body: "Scan the code on your Mac again.",
          });
        }
      } else {
        setError({
          title: "Connection failed",
          body: "Something went wrong while trying to connect.",
        });
      }
      setErrorOpen(true);
    } finally {
      inFlightRef.current = false;
    }
  };

  // The deep-link listeners below can fire before `connect` exists on first
  // render; hand them the latest one. Assigned during render so it is never
  // a stale no-op on mount.
  connectRef.current = connect;

  useEffect(() => {
    const sub = Linking.addEventListener("url", ({ url }) => {
      if (/^(exp\+)?codenotch:\/\//.test(url)) {
        setText(url);
        connectRef.current(url);
      }
    });
    return () => sub.remove();
  }, []);

  const { pairing, v, h, p, c, n } = params;
  
  // codenotch:// deep links land here prefilled, cold or warm. Expo Go
  // prefixes the scheme with exp+, so match both shapes. A link that already
  // carries a valid pairing string pairs immediately — opening the link IS
  // the confirmation, like scanning a QR code.
  useEffect(() => {
    if (typeof pairing === "string" && pairing) {
      setText(pairing);
      connectRef.current(pairing);
    } else if (v === "2" || v === "3") {
      const p_h = typeof h === "string" ? h : "";
      const p_p = typeof p === "string" ? p : "";
      const p_c = typeof c === "string" ? c : "";
      const p_n = typeof n === "string" ? n : "";
      const link = `codenotch://pair?v=${v}&h=${encodeURIComponent(p_h)}&p=${encodeURIComponent(p_p)}&c=${encodeURIComponent(p_c)}&n=${encodeURIComponent(p_n)}`;
      setText(link);
      connectRef.current(link);
    }
  }, [pairing, v, h, p, c, n]);

  useFocusEffect(
    useCallback(() => {
      const handoff = consumeScanHandoff();
      if (handoff) {
        setText(handoff);
        connectRef.current(handoff);
      }
    }, [])
  );

  const config = useMemo(() => parsePairingLink(text), [text]);
  // Connect is lit while there is something to connect to, dims while the
  // request is out, and lights again as the checkmark lands.
  const lit = justPaired || (!!config && state !== "connecting");

  const handlePaste = async () => {
    const str = await Clipboard.getStringAsync();
    if (str) {
      setText(str);
      void connect(str);
    }
  };

  const handlePickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: false,
        quality: 1,
      });

      if (!result.canceled && result.assets[0]) {
        const scannedResults = await scanFromURLAsync(result.assets[0].uri, ["qr"]);
        if (scannedResults.length > 0 && scannedResults[0].data) {
          const parsed = parsePairingLink(scannedResults[0].data);
          if (parsed) {
            setText(scannedResults[0].data);
            void connect(scannedResults[0].data);
            return;
          }
        }
        setState("error");
        setError({
          title: "No code found",
          body: "That image doesn't seem to contain a Codenotch pairing code.",
        });
        setErrorOpen(true);
        if (!reduceMotion) {
          shake.set(withSequence(...SHAKE.map((x) => withTiming(x, { duration: SHAKE_STEP_MS }))));
        }
      }
    } catch (e) {
      setState("error");
      setError({
        title: "Couldn't scan image",
        body: "There was a problem reading the selected image.",
      });
      setErrorOpen(true);
      if (!reduceMotion) {
        shake.set(withSequence(...SHAKE.map((x) => withTiming(x, { duration: SHAKE_STEP_MS }))));
      }
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView style={styles.flex} behavior="padding" keyboardVerticalOffset={spacing(4)}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Animated.View entering={riseIn(1)} style={styles.intro}>
            <View style={[styles.hero, { backgroundColor: colors.card }, styles.heroEdge]}>
              <Icon name="display" size={42} color={colors.label} />
              <Icon name="iphone" size={42} color={colors.accent} />
            </View>
            <Text style={[styles.title, { color: colors.label }]}>Connect to your Mac</Text>
            <Text style={[styles.body, { color: colors.secondaryLabel }]}>
              Open Codenotch on your Mac, go to Settings › Phone and choose Connect a Phone.
            </Text>
          </Animated.View>

          <Animated.View entering={riseIn(2)}>
            <View style={{ marginTop: spacing(6) }}>
              <PressableCard
                onPress={() => router.navigate("/scan")}
                accessibilityRole="button"
                style={[styles.button, { backgroundColor: colors.accent, minHeight: 52, flexDirection: "row", gap: spacing(2) }]}
              >
                <Icon name="qrcode.viewfinder" size={19} color={colors.onAccent} />
                <Text style={[styles.buttonText, { color: colors.onAccent }]}>Scan QR Code</Text>
              </PressableCard>
            </View>
          </Animated.View>

          <Animated.View entering={riseIn(3)} style={styles.inputContainer}>
            <View style={styles.inputRow}>
              <Animated.View style={[shakeStyle, { flex: 1 }]}>
                <AnimatedTextInput
                  value={text}
                  onChangeText={(value) => {
                    setText(value);
                    if (state === "error") {
                      setState("idle");
                      setErrorOpen(false);
                    }
                  }}
                  onFocus={() => setFocused(true)}
                  onBlur={() => setFocused(false)}
                  onSubmitEditing={() => void connect()}
                  editable={state !== "connecting" && !justPaired}
                  keyboardType="url"
                  returnKeyType="go"
                  enablesReturnKeyAutomatically
                  autoCapitalize="none"
                  autoCorrect={false}
                  spellCheck={false}
                  keyboardAppearance={colors.scheme}
                  placeholder="codenotch://pair?…"
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
              {Platform.OS === 'ios' ? (
                <Clipboard.ClipboardPasteButton
                  displayMode="iconAndLabel"
                  onPress={(e: any) => {
                    if (e.text) {
                      setText(e.text);
                      void connect(e.text);
                    }
                  }}
                  style={[styles.pasteButton, { backgroundColor: colors.card }]}
                />
              ) : (
                <PressableCard onPress={handlePaste} style={[styles.pasteButtonAlt, { backgroundColor: colors.card, borderColor: colors.separator }]}>
                  <Icon name="doc.on.clipboard" size={16} color={colors.accent} />
                  <Text style={[styles.pasteText, { color: colors.accent }]}>Paste</Text>
                </PressableCard>
              )}
            </View>

            <Reveal visible={!!text && !config}>
              <Text style={[styles.fieldHint, { color: colors.tertiaryLabel }]}>
                That doesn't look like a valid Codenotch link
              </Text>
            </Reveal>

            <Reveal visible={errorOpen}>
              {error ? (
                <View style={[styles.errorCard, { backgroundColor: colors.card }]}>
                  <Icon name="exclamationmark.triangle" size={18} color={colors.critical} />
                  <View style={styles.errorTexts}>
                    <Text style={[styles.errorTitle, { color: colors.label }]}>{error.title}</Text>
                    <Text style={[styles.errorBody, { color: colors.secondaryLabel }]}>{error.body}</Text>
                  </View>
                </View>
              ) : null}
            </Reveal>

            <Reveal visible={!!config}>
              <View>
                <PressableCard
                  onPress={() => void connect()}
                  disabled={!config || state === "connecting" || justPaired}
                  accessibilityRole="button"
                  accessibilityLabel="Connect"
                  style={[
                    styles.button,
                    { backgroundColor: lit ? colors.accent : colors.ringTrack },
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
                        { color: lit ? colors.onAccent : colors.tertiaryLabel },
                      ]}
                    >
                      {state === "connecting" ? `Connecting to ${config && "serverName" in config ? config.serverName : "Mac"}…` : "Connect"}
                    </Text>
                  )}
                </PressableCard>
              </View>
            </Reveal>

            <View style={{ marginTop: spacing(6), alignItems: 'center' }}>
              <Pressable
                onPress={handlePickImage}
                accessibilityRole="button"
              >
                <Text style={[styles.textButton, { color: colors.accent }]}>
                  Choose QR from Photos
                </Text>
              </Pressable>
            </View>

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
  inputContainer: {
    marginTop: spacing(2),
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(3),
  },
  pasteButton: {
    height: 48,
    width: 90,
    borderRadius: radius.input,
    borderCurve: 'continuous',
  },
  pasteButtonAlt: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing(4),
    borderRadius: radius.input,
    borderWidth: 1,
    borderCurve: 'continuous',
    gap: spacing(2),
  },
  pasteText: {
    fontSize: 14,
    fontWeight: '600',
  },
  textButton: {
    fontSize: 15,
    fontWeight: "600",
    padding: spacing(2),
  },
  // The focus ring, the "not a pairing string" amber and the error red fade
  // between each other instead of snapping.
  input: {
    transitionProperty: "borderColor",
    transitionDuration: "150ms",
    transitionTimingFunction: "ease-out",
    borderRadius: radius.input,
    borderCurve: "continuous",
    borderWidth: 1,
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(3.5),
    fontSize: 14,
    fontFamily: Platform.select({ ios: "Menlo", default: "monospace" }),
  } as any,
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
  // Connect lights up as the string becomes valid — a state change, so it
  // fades rather than flips.
  button: {
    transitionProperty: "backgroundColor",
    transitionDuration: "180ms",
    transitionTimingFunction: "ease-out",
    borderRadius: radius.pill,
    paddingVertical: spacing(4),
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing(4),
    minHeight: 52,
  } as any,
  buttonConnected: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(2),
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "700",
  },
});
