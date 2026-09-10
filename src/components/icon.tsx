/** Iconography: SF Symbols on iOS (they inherit weight and Dynamic Type),
 * a tiny drawn set on Android so the two platforms both read native. */
import { ColorValue, Platform, StyleSheet, View } from "react-native";
import { SymbolView } from "expo-symbols";
import Svg, { Circle, G, Line, Path } from "react-native-svg";

export type IconName =
  | "speedometer"
  | "terminal"
  | "gearshape"
  | "checkmark.circle"
  | "exclamationmark.triangle"
  | "info.circle"
  | "arrow.clockwise"
  | "person.crop.circle"
  | "xmark.circle.fill"
  | "wifi"
  | "questionmark.circle"
  | "chevron.right"
  | "square.and.arrow.up";

const sfNames: Record<IconName, string> = {
  "chevron.right": "chevron.right",
  "square.and.arrow.up": "square.and.arrow.up",
  speedometer: "speedometer",
  terminal: "terminal",
  gearshape: "gearshape",
  "checkmark.circle": "checkmark.circle.fill",
  "exclamationmark.triangle": "exclamationmark.triangle.fill",
  "info.circle": "info.circle.fill",
  "arrow.clockwise": "arrow.clockwise",
  "person.crop.circle": "person.crop.circle",
  "xmark.circle.fill": "xmark.circle.fill",
  wifi: "wifi",
  "questionmark.circle": "questionmark.circle.fill",
};

/**
 * SF Symbols are optically uneven — at one point size, info.circle's circle
 * draws smaller than questionmark.circle's, and bare glyphs like
 * arrow.clockwise read lighter than fills. Calibrated in the simulator so a
 * given `size` lands on the same visual footprint across the set.
 */
const opticalScale: Partial<Record<IconName, number>> = {
  "info.circle": 1.2,
  "arrow.clockwise": 1.15,
  "person.crop.circle": 1.08,
  wifi: 1.1,
};

/** Symbols with a filled circular plate share one grid and match each other;
 * the outliers are listed above. */
function calibratedSize(name: IconName, size: number): number {
  return Math.round(size * (opticalScale[name] ?? 1));
}

function AndroidGlyph({ name, size, color }: { name: IconName; size: number; color: ColorValue }) {
  const stroke = color;
  const sw = 1.8;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {name === "checkmark.circle" && (
        <G>
          <Circle cx="12" cy="12" r="9" fill={color} />
          <Path d="M8 12.2 10.8 15 16 9.4" stroke="#FFFFFF" strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </G>
      )}
      {name === "exclamationmark.triangle" && (
        <G>
          <Path d="M12 3.5 21.5 20h-19Z" fill={color} strokeLinejoin="round" />
          <Line x1="12" y1="9.5" x2="12" y2="14.5" stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" />
          <Circle cx="12" cy="17.4" r="1.15" fill="#FFFFFF" />
        </G>
      )}
      {name === "info.circle" && (
        <G>
          <Circle cx="12" cy="12" r="9" fill={color} />
          <Circle cx="12" cy="8.2" r="1.2" fill="#FFFFFF" />
          <Line x1="12" y1="11.4" x2="12" y2="16.4" stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" />
        </G>
      )}
      {name === "arrow.clockwise" && (
        <Path d="M19 12a7 7 0 1 1-2.05-4.95M19 3.5v4h-4" stroke={stroke} strokeWidth={sw} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      )}
      {name === "speedometer" && (
        <G>
          <Path d="M4.5 16.5a8 8 0 1 1 15 0" stroke={stroke} strokeWidth={sw} fill="none" strokeLinecap="round" />
          <Line x1="12" y1="14.5" x2="15.5" y2="9.5" stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
        </G>
      )}
      {name === "terminal" && (
        <G>
          <Path d="M4.8 5.5h14.4a1.8 1.8 0 0 1 1.8 1.8v9.4a1.8 1.8 0 0 1-1.8 1.8H4.8A1.8 1.8 0 0 1 3 16.7V7.3a1.8 1.8 0 0 1 1.8-1.8Z" stroke={stroke} strokeWidth={sw} fill="none" />
          <Path d="m7 9.5 3 2.5-3 2.5M12.5 15h4" stroke={stroke} strokeWidth={sw} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </G>
      )}
      {name === "gearshape" && (
        <G>
          <Circle cx="12" cy="12" r="3" stroke={stroke} strokeWidth={sw} fill="none" />
          <Path d="M12 3.8v2M12 18.2v2M20.2 12h-2M5.8 12h-2M17.7 6.3l-1.4 1.4M7.7 16.3l-1.4 1.4M17.7 17.7l-1.4-1.4M7.7 7.7 6.3 6.3" stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
        </G>
      )}
      {name === "person.crop.circle" && (
        <G>
          <Circle cx="12" cy="12" r="9" stroke={stroke} strokeWidth={sw} fill="none" />
          <Circle cx="12" cy="10" r="2.6" stroke={stroke} strokeWidth={sw} fill="none" />
          <Path d="M6.8 18.2c1-2.4 2.9-3.6 5.2-3.6s4.2 1.2 5.2 3.6" stroke={stroke} strokeWidth={sw} fill="none" />
        </G>
      )}
      {name === "xmark.circle.fill" && (
        <G>
          <Circle cx="12" cy="12" r="9" fill={color} />
          <Path d="m9 9 6 6M15 9l-6 6" stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" />
        </G>
      )}
      {name === "wifi" && (
        <Path d="M4 10.5a11.3 11.3 0 0 1 16 0M7 13.8a7 7 0 0 1 10 0M10 17a3.4 3.4 0 0 1 4 0M12 19.6h.01" stroke={stroke} strokeWidth={sw} fill="none" strokeLinecap="round" />
      )}
      {name === "chevron.right" && (
        <Path d="m9 5 7 7-7 7" stroke={stroke} strokeWidth={2.2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      )}
      {name === "square.and.arrow.up" && (
        <Path d="M12 3.5v11M8 7.2l4-3.7 4 3.7M7.5 10.5H6.3a1.8 1.8 0 0 0-1.8 1.8v6.4a1.8 1.8 0 0 0 1.8 1.8h11.4a1.8 1.8 0 0 0 1.8-1.8v-6.4a1.8 1.8 0 0 0-1.8-1.8h-1.2" stroke={stroke} strokeWidth={sw} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      )}
      {name === "questionmark.circle" && (
        <G>
          <Circle cx="12" cy="12" r="9" fill={color} />
          <Path d="M9.8 9.4a2.3 2.3 0 1 1 3.3 2.6c-.8.4-1.1 1-1.1 1.8v.3" stroke="#FFFFFF" strokeWidth={1.9} fill="none" strokeLinecap="round" />
          <Circle cx="12" cy="16.9" r="1.1" fill="#FFFFFF" />
        </G>
      )}
    </Svg>
  );
}

export function Icon({
  name,
  size = 20,
  color,
  weight = "regular",
}: {
  name: IconName;
  size?: number;
  color: ColorValue;
  weight?: "regular" | "medium" | "semibold";
}) {
  if (Platform.OS === "ios") {
    return (
      <View style={[styles.plate, { width: size, height: size }]}>
        <SymbolView
          name={sfNames[name] as any}
          size={calibratedSize(name, size)}
          tintColor={color}
          weight={weight}
          fallback={<View style={[styles.fallback, { backgroundColor: color, width: size, height: size, borderRadius: size / 2 }]} />}
        />
      </View>
    );
  }
  // The drawn Android set is uniform by construction — no calibration.
  return <AndroidGlyph name={name} size={size} color={color} />;
}

const styles = StyleSheet.create({
  fallback: {},
  plate: {
    alignItems: "center",
    justifyContent: "center",
  },
});
