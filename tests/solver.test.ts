import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { encrypt, parseKey } from "../src/enigma/machine";
import { clean } from "../src/enigma/wiring";
import { SOLVED, englishness, screen, solveSetting, toKey } from "../src/crack/solver";

const quads = new Uint8Array(readFileSync("public/quadgrams.bin"));
const ints = (s: string) => Uint8Array.from(s, (c) => c.charCodeAt(0) - 65);
const text = (a: Uint8Array) => Array.from(a, (i) => String.fromCharCode(65 + i)).join("");

const MESSAGE = clean(`
  It was a bright cold day in the hut, and the clocks were striking thirteen. Nobody
  at the station had slept; the intercepts from the night before were piled on every
  desk and the coffee had run out hours ago. Somewhere in that pile was the weather
  report that would give away the whole day's key, if only someone could find it
  before the next shift arrived and the settings changed again at midnight.`);

describe("cracker", () => {
  it("recovers a message encrypted with an unknown key (rotor order given, to keep the test fast)", () => {
    const key = parseKey("IV I V", "CQX", "MRT", "AZ BY CW DX");
    const ct = ints(encrypt(key, MESSAGE));
    const best = screen(ct, key.rotors, 20)
      .slice(0, 20)
      .map((s) => solveSetting(ct, s, quads))
      .sort((a, b) => b.score - a.score)[0];
    expect(englishness(best.score)).toBeGreaterThan(SOLVED);
    expect(text(best.plaintext)).toBe(MESSAGE);
    // The recovered key may differ in "don't care" settings but must decrypt identically.
    expect(encrypt(toKey(best), text(ct))).toBe(MESSAGE);
  });

  it("scores random letters as noise", () => {
    const noise = encrypt(parseKey("I II III", "AAA", "AAA"), MESSAGE);
    expect(englishness(solveSetting(ints(noise), { rotors: [0, 1, 2], rings: [0, 0, 0], positions: [5, 5, 5] }, quads).score)).toBeLessThan(SOLVED);
  });
});
