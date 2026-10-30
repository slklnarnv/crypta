import { describe, expect, it } from "vitest";
import { Enigma, encrypt, parseKey, randomKey } from "../src/enigma/machine";
import { BACKWARD, FORWARD, REFLECTOR, letter } from "../src/enigma/wiring";
import vectors from "./vectors.json";
import { mulberry } from "../src/lib/random";

describe("Enigma I", () => {
  it("matches the textbook vector AAAAA → BDZGO", () => {
    expect(encrypt(parseKey("I II III", "AAA", "AAA"), "AAAAA")).toBe("BDZGO");
  });

  it("double-steps the middle rotor: ADU → ADV → AEW → BFX", () => {
    const m = new Enigma(parseKey("I II III", "AAA", "ADU"));
    const windows = [0, 1, 2].map(() => m.press(0).positions.map(letter).join(""));
    expect(windows).toEqual(["ADV", "AEW", "BFX"]);
  });

  it("has valid wiring: rotors are permutations, reflectors fixed-point-free involutions", () => {
    FORWARD.forEach((f, w) => f.forEach((v, i) => expect(BACKWARD[w][v]).toBe(i)));
    for (const r of REFLECTOR) r.forEach((v, i) => (expect(r[v]).toBe(i), expect(v).not.toBe(i)));
  });

  it.each(vectors.map((v, i) => [i, v] as const))("agrees with py-enigma on vector %i", (_, v) => {
    const key = parseKey(v.rotors.join(" "), v.rings, v.positions, v.plugs.join(" "), v.reflector);
    expect(encrypt(key, v.plaintext)).toBe(v.ciphertext);
  });

  it("is its own inverse, and never encrypts a letter to itself", () => {
    const key = randomKey(10, mulberry(7));
    const text = "THEQUICKBROWNFOXJUMPSOVERTHELAZYDOG".repeat(20);
    const ct = encrypt(key, text);
    expect(encrypt(key, ct)).toBe(text);
    for (let i = 0; i < text.length; i++) expect(ct[i]).not.toBe(text[i]);
  });
});
