import { useState, useCallback, useEffect, useRef } from "react";
import { StyleSheet, View, Text, Pressable, Platform, Linking } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useRouter } from "expo-router";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { parsePairingLink } from "../lib/pairing";
import { haptic } from "../lib/haptics";
import { Icon } from "../components/icon";
import { spacing, radius, useTheme } from "../theme";
import { setScanHandoff } from "../lib/scan-handoff";

export default function ScanScreen() {
  const colors = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [scanned, setScanned] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) {
      requestPermission();
    }
  }, [permission, requestPermission]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const dismiss = useCallback(() => {
    router.canGoBack() ? router.back() : router.replace("/pair");
  }, [router]);

  const handleBarCodeScanned = useCallback(({ data }: { type: string; data: string }) => {
    if (scanned) return;
    const parsed = parsePairingLink(data);
    if (parsed) {
      setScanned(true);
      haptic.success();
      setScanHandoff(data);
      dismiss();
    } else {
      setHint("That's not a Codenotch code");
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setHint(null), 2000);
    }
  }, [scanned, dismiss]);

  if (!permission) {
    return <View style={styles.container} />; // Loading
  }

  if (cameraError) {
    return (
      <SafeAreaView style={styles.deniedContainer}>
        <View style={[styles.header, { top: insets.top + spacing(2) }]}>
          <Pressable onPress={dismiss} style={styles.closeButton} accessibilityLabel="Close">
            <Icon name="xmark" size={24} color={colors.background} />
          </Pressable>
        </View>
        <View style={styles.deniedContent}>
          <Text style={styles.deniedTitle}>Camera unavailable</Text>
          <Text style={styles.deniedBody}>
            Paste the link or choose the QR from Photos instead.
          </Text>
          <Pressable onPress={dismiss} style={[styles.settingsButton, { backgroundColor: colors.label }]}>
            <Text style={[styles.settingsButtonText, { color: colors.background }]}>Dismiss</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (!permission.granted && !permission.canAskAgain) {
    return (
      <SafeAreaView style={styles.deniedContainer}>
        <View style={[styles.header, { top: insets.top + spacing(2) }]}>
          <Pressable onPress={dismiss} style={styles.closeButton} accessibilityLabel="Close">
            <Icon name="xmark" size={24} color={colors.background} />
          </Pressable>
        </View>
        <View style={styles.deniedContent}>
          <Text style={styles.deniedTitle}>Camera Access Required</Text>
          <Text style={styles.deniedBody}>
            Codenotch needs camera access to scan the pairing code.
          </Text>
          <Pressable 
            style={[styles.settingsButton, { backgroundColor: colors.label }]}
            onPress={() => Linking.openSettings()}
          >
            <Text style={[styles.settingsButtonText, { color: colors.background }]}>Open Settings</Text>
          </Pressable>
          <Pressable onPress={dismiss} style={styles.pasteButton}>
            <Text style={[styles.pasteButtonText, { color: colors.accent }]}>Paste the link instead</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    // If still undetermined or loading the prompt, just show black screen
    return <View style={styles.container} />;
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{
          barcodeTypes: ["qr"],
        }}
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
        onMountError={() => setCameraError(true)}
      >
        <SafeAreaView style={styles.overlay} edges={['top', 'bottom']}>
          <View style={[styles.header, { top: insets.top + spacing(2) }]}>
            <Pressable onPress={dismiss} style={styles.closeButton} accessibilityLabel="Close">
              <Icon name="xmark" size={24} color="#fff" />
            </Pressable>
          </View>

          <View style={styles.dimRow}>
            <View style={styles.dimLayer} />
          </View>
          
          <View style={styles.centerRow}>
            <View style={styles.dimLayer} />
            <View style={styles.viewfinder} />
            <View style={styles.dimLayer} />
          </View>

          <View style={[styles.dimRow, styles.bottomDim]}>
            <Text style={styles.caption}>Point your camera at the code on your Mac</Text>
            {hint && <Text style={[styles.hint, { color: '#fff' }]}>{hint}</Text>}
            <Pressable onPress={dismiss} style={styles.pasteAction}>
              <Text style={styles.pasteActionText}>Paste link instead</Text>
            </Pressable>
            <View style={[StyleSheet.absoluteFill, styles.dimBackground, { zIndex: -1 }]} />
          </View>
        </SafeAreaView>
      </CameraView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  overlay: {
    flex: 1,
  },
  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    padding: spacing(4),
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing(2),
  },
  dimRow: {
    flex: 1,
  },
  dimLayer: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  dimBackground: {
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  centerRow: {
    flexDirection: "row",
    height: 250,
  },
  viewfinder: {
    width: 250,
    height: 250,
    borderRadius: radius.card,
    borderColor: "rgba(255,255,255,0.6)",
    borderWidth: 2,
  },
  bottomDim: {
    alignItems: "center",
    paddingTop: spacing(6),
    paddingBottom: spacing(6),
    justifyContent: "space-between",
  },
  caption: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
    textShadowColor: "rgba(0,0,0,0.8)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
    zIndex: 10,
  },
  hint: {
    fontSize: 14,
    fontWeight: "500",
    textAlign: "center",
    marginTop: spacing(3),
    backgroundColor: "rgba(0,0,0,0.8)",
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(1.5),
    borderRadius: radius.pill,
    overflow: "hidden",
    zIndex: 10,
  },
  pasteAction: {
    padding: spacing(4),
    zIndex: 10,
    marginTop: "auto",
  },
  pasteActionText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  deniedContainer: {
    flex: 1,
    backgroundColor: "#000",
  },
  deniedContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing(6),
    gap: spacing(4),
  },
  deniedTitle: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "700",
    textAlign: "center",
  },
  deniedBody: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 15,
    textAlign: "center",
  },
  settingsButton: {
    paddingVertical: spacing(3),
    paddingHorizontal: spacing(6),
    borderRadius: radius.pill,
    marginTop: spacing(2),
  },
  settingsButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  pasteButton: {
    padding: spacing(3),
  },
  pasteButtonText: {
    fontSize: 15,
  },
});
