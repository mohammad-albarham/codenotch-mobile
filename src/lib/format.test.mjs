// Run with: bun test src/lib/format.test.mjs
// The rules mirror desktop codenotch's Percent / LimitWindow.summary, so the
// phone and the Mac never print two different numbers for one reading.
import { expect, test } from "bun:test";
import { compactCount, percentHalves, percentText, resetCopy, usedCopy, windowReading } from "./format";

const window = (over) => ({
  id: "w",
  label: "W",
  usedFraction: null,
  remaining: null,
  used: null,
  resetsAt: null,
  ...over,
});

test("a real reading under one percent never prints as 0", () => {
  expect(percentText(0.003)).toBe("0.3");
  expect(percentText(0.0004)).toBe("<0.1");
  expect(percentText(0)).toBe("0");
  expect(percentText(0.38)).toBe("38");
});

test("both halves add up, from the rounded used half", () => {
  expect(percentHalves(0.095)).toEqual({ used: "10", left: "90" });
  expect(percentHalves(0.003)).toEqual({ used: "0.3", left: "99.7" });
  expect(percentHalves(0.9996)).toEqual({ used: ">99.9", left: "<0.1" });
  expect(usedCopy(0.11)).toBe("11% Used · 89% left");
  expect(usedCopy(0.24, true)).toBe("~24% Used · 76% left");
});

test("counts compact the way desktop's card prints them", () => {
  expect(compactCount(840)).toBe("840");
  expect(compactCount(12_345)).toBe("12k");
  expect(compactCount(1_234_567)).toBe("1.2M");
});

test("a count in another unit reads in the Mac's words, never raw", () => {
  expect(windowReading(window({ used: 1428, usedText: "$14.28" }), false)).toBe("$14.28");
  expect(windowReading(window({ used: 1428 }), false)).toBe("1428 used");
  expect(windowReading(window({ used: 0, detail: "1.2M tokens" }), false)).toBe("1.2M tokens");
  expect(windowReading(window({ remaining: 25_000 }), false)).toBe("25k left");
  expect(windowReading(window({ usedFraction: 0.5, detail: "$25 of $50" }), true)).toBe("~$25 of $50");
  expect(windowReading(window({}), false)).toBe("No reading");
});

test("a reset long past says when it was, not that it is happening", () => {
  const now = new Date("2026-11-24T21:00:00Z");
  expect(resetCopy("2026-11-24T20:55:00Z", now)).toBe("resetting now");
  expect(resetCopy("2026-09-20T22:02:43Z", now)).toMatch(/^reset Sep 2[01]$/);
  expect(resetCopy("2025-09-20T22:02:43Z", now)).toMatch(/^reset Sep 2[01], 2025$/);
});
