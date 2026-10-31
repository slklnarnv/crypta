import { describe, expect, it } from "vitest";
import { MESSAGES } from "../src/daily/messages";
import {
  CABLES,
  dateOfDay,
  dayNumber,
  decrypt,
  knowledge,
  parsePairs,
  puzzleFor,
  score,
  shareText,
} from "../src/daily/puzzle";
import { clean, index } from "../src/enigma/wiring";

describe("daily puzzle", () => {
  it("gives the same puzzle for the same date, whatever the time of day", () => {
    const morning = puzzleFor(dayNumber(new Date(2026, 10, 14, 0, 5)));
    const night = puzzleFor(dayNumber(new Date(2026, 10, 14, 23, 55)));
    expect(night).toEqual(morning);
    expect(morning.ciphertext).toBe(puzzleFor(morning.day).ciphertext);
  });

  it("counts days from launch and maps them back to the date", () => {
    expect(dayNumber(new Date(2026, 9, 31))).toBe(0);
    expect(dayNumber(new Date(2027, 0, 1))).toBe(62);
    // Across the March clock change, days still step by exactly one.
    expect(dayNumber(new Date(2027, 2, 29)) - dayNumber(new Date(2027, 2, 27))).toBe(2);
    const d = dateOfDay(62);
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2027, 0, 1]);
  });

  it("changes the puzzle every day and uses each message once per 30-day cycle", () => {
    const days = Array.from({ length: MESSAGES.length }, (_, i) => puzzleFor(30 + i));
    expect(new Set(days.map((p) => p.subject)).size).toBe(MESSAGES.length);
    expect(new Set(days.map((p) => p.ciphertext)).size).toBe(MESSAGES.length);
  });

  it("has messages of 120 to 200 letters", () => {
    for (const m of MESSAGES) {
      expect(clean(m.text).length).toBeGreaterThanOrEqual(120);
      expect(clean(m.text).length).toBeLessThanOrEqual(200);
    }
  });

  it("plugs five disjoint cables, each joining letters seen at least three times", () => {
    for (let day = 0; day < 90; day++) {
      const p = puzzleFor(day);
      const letters = p.key.plugs.flat();
      expect(p.key.plugs).toHaveLength(CABLES);
      expect(new Set(letters).size).toBe(2 * CABLES);
      for (const c of letters) expect(p.plaintext.split("").filter((ch) => index(ch) === c).length).toBeGreaterThanOrEqual(3);
      expect(decrypt(p, p.key.plugs)).toBe(p.plaintext);
    }
  });

  it("marks cables green, yellow or grey", () => {
    const secret = parsePairs("AB CD EF GH IJ");
    expect(score(parsePairs("BA DC EG XY KZ"), secret)).toEqual(["green", "green", "yellow", "grey", "grey"]);
    const k = knowledge([parsePairs("AB CX XY QZ MN"), parsePairs("XC")], secret);
    expect([k[index("A")], k[index("C")], k[index("X")], k[index("Q")], k[index("P")]]).toEqual([
      "paired",
      "plugged",
      "free",
      "free",
      undefined,
    ]);
  });

  it("shares only the squares, greens first", () => {
    const p = puzzleFor(3);
    const share = shareText(p, [p.key.plugs.slice().reverse()], true);
    expect(share).toBe(`crypta daily #4 1/6\n🟩🟩🟩🟩🟩`);
    expect(share).not.toMatch(/[A-Z]{2}\s[A-Z]{2}/);
  });
});
