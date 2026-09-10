/**
 * A tiny live trend of a provider's headline fraction, collected by the Rings
 * screen: one point per snapshot whose displayed value actually changed, last
 * 24 kept in memory per session. Nothing is fabricated, nothing is persisted —
 * fewer than 3 real points means no sparkline.
 */
import { useSyncExternalStore } from "react";
import Svg, { Line, Polyline } from "react-native-svg";

const LIMIT = 24;
const EMPTY: readonly number[] = [];

const store = new Map<string, number[]>();
const listeners = new Set<() => void>();

/** Feed from the Rings screen whenever a snapshot arrives. Points quantize to
 * the displayed percent, so 38.2 → 38.4 doesn't redraw a line the user never
 * saw move. */
export function recordTrendPoint(providerId: string, fraction: number): void {
  const clamped = Math.min(1, Math.max(0, fraction));
  const point = Math.round(clamped * 100) / 100;
  const points = store.get(providerId);
  if (points && points[points.length - 1] === point) return;
  const next = [...(points ?? []), point].slice(-LIMIT);
  store.set(providerId, next);
  listeners.forEach((notify) => notify());
}

export function useTrend(providerId: string): readonly number[] {
  return useSyncExternalStore(
    (notify) => {
      listeners.add(notify);
      return () => {
        listeners.delete(notify);
      };
    },
    () => store.get(providerId) ?? EMPTY,
  );
}

/**
 * A minimal 40x14 line: the trend in the band color at 45% opacity over a
 * baseline hairline. The vertical scale is the observed range (floored so a
 * flat reading draws flat, not invented noise); the x axis is point order.
 */
export function Sparkline({
  points,
  color,
  width = 40,
  height = 14,
}: {
  points: readonly number[];
  color: string;
  width?: number;
  height?: number;
}) {
  if (points.length < 3) return null;

  const padX = 2.5; // room for the round caps
  const top = 2;
  const baseline = height - 2.5;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = Math.max(max - min, 0.05);
  const x = (i: number) => padX + (i / (points.length - 1)) * (width - padX * 2);
  const y = (v: number) => baseline - ((v - min) / span) * (baseline - top);
  const coords = points.map((v, i) => `${x(i).toFixed(2)},${y(v).toFixed(2)}`).join(" ");

  return (
    <Svg width={width} height={height}>
      <Line
        x1={1}
        y1={height - 1}
        x2={width - 1}
        y2={height - 1}
        stroke={color}
        strokeOpacity={0.2}
        strokeWidth={1}
      />
      <Polyline
        points={coords}
        fill="none"
        stroke={color}
        strokeOpacity={0.45}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
