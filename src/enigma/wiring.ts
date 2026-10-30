// Historical wiring of the Enigma I (Wehrmacht / Luftwaffe).
// Source: cryptomuseum.com/crypto/enigma/wiring.htm. Letters are 0..25 (A..Z).

export const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export const ROTOR_NAMES = ["I", "II", "III", "IV", "V"] as const;
const ROTOR_WIRINGS = [
  "EKMFLGDQVZNTOWYHXUSPAIBRCJ",
  "AJDKSIRUXBLHWTMCQGZNPYFVOE",
  "BDFHJLCPRTXVZNYEIWGAKMUSQO",
  "ESOVPZJAYQUIRHXLNFTGKDCMWB",
  "VZBRGITYUPSDNHLXAWMJQOFECK",
];
// When a rotor steps *off* this window letter, it kicks its left neighbour.
const NOTCHES = "QEVJZ";

export const REFLECTOR_NAMES = ["B", "C"] as const;
const REFLECTOR_WIRINGS = ["YRUHQSLDPXNGOKMIEBFZCWVJAT", "FVPJIAOYEDRZXWGCTKUQSBNMHL"];

const toInts = (s: string) => Array.from(s, (ch) => ch.charCodeAt(0) - 65);
const invert = (p: number[]) => {
  const inv = new Array<number>(26);
  p.forEach((v, i) => (inv[v] = i));
  return inv;
};

export const FORWARD = ROTOR_WIRINGS.map(toInts);
export const BACKWARD = FORWARD.map(invert);
export const NOTCH = toInts(NOTCHES);
export const REFLECTOR = REFLECTOR_WIRINGS.map(toInts);

export const letter = (i: number) => ALPHABET[i];
export const index = (ch: string) => ch.toUpperCase().charCodeAt(0) - 65;

/** Keep only A-Z, upper-cased. */
export const clean = (text: string) => text.toUpperCase().replace(/[^A-Z]/g, "");
