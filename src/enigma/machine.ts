import { BACKWARD, FORWARD, NOTCH, REFLECTOR, ROTOR_NAMES, REFLECTOR_NAMES, clean, index, letter } from "./wiring";

type Triple = [number, number, number];

/** Everything an operator would set on the machine. Slots run left → right. */
export interface Key {
  rotors: Triple; // 0..4 → I..V
  rings: Triple; // Ringstellung, 0..25
  positions: Triple; // window letters at the start, 0..25
  reflector: number; // 0 → UKW-B, 1 → UKW-C
  plugs: [number, number][];
}

/** The plugboard as a lookup table: plug[a] === b  ⇔  plug[b] === a. */
export function plugTable(plugs: [number, number][]): number[] {
  const t = Array.from({ length: 26 }, (_, i) => i);
  for (const [a, b] of plugs) [t[a], t[b]] = [b, a];
  return t;
}

/** Advance the rotors one key press, including the famous double step. */
export function step(pos: Triple, rotors: Triple): void {
  if (pos[1] === NOTCH[rotors[1]]) {
    pos[0] = (pos[0] + 1) % 26;
    pos[1] = (pos[1] + 1) % 26;
  } else if (pos[2] === NOTCH[rotors[2]]) {
    pos[1] = (pos[1] + 1) % 26;
  }
  pos[2] = (pos[2] + 1) % 26;
}

const through = (wiring: number[], c: number, shift: number) => (wiring[(c + shift) % 26] - shift + 26) % 26;

/** Every letter the current passes through for one key press: the lamp is the last one. */
export interface Trace {
  positions: Triple; // window after stepping
  path: number[]; // key, plug, R, M, L, reflector, L, M, R, plug(=lamp)
}

export class Enigma {
  readonly key: Key;
  pos: Triple;
  private readonly plug: number[];

  constructor(key: Key) {
    this.key = key;
    this.pos = [...key.positions];
    this.plug = plugTable(key.plugs);
  }

  press(c: number): Trace {
    const { rotors, rings, reflector } = this.key;
    step(this.pos, rotors);
    const shift = [0, 1, 2].map((i) => (this.pos[i] - rings[i] + 26) % 26);
    const path = [c];
    c = this.plug[c];
    path.push(c);
    for (const i of [2, 1, 0]) path.push((c = through(FORWARD[rotors[i]], c, shift[i])));
    path.push((c = REFLECTOR[reflector][c]));
    for (const i of [0, 1, 2]) path.push((c = through(BACKWARD[rotors[i]], c, shift[i])));
    path.push(this.plug[c]);
    return { positions: [...this.pos], path };
  }

  /** Encrypting and decrypting are the same operation on Enigma. */
  run(text: string): string {
    return Array.from(clean(text), (ch) => letter(this.press(index(ch)).path.at(-1)!)).join("");
  }
}

export const encrypt = (key: Key, text: string) => new Enigma(key).run(text);

// ---- human-readable key helpers -------------------------------------------------

export function parseKey(rotors: string, rings: string, positions: string, plugs = "", reflector = "B"): Key {
  const tri = (s: string) => Array.from(s.toUpperCase(), index) as Triple;
  return {
    rotors: rotors.split(/\s+/).map((r) => ROTOR_NAMES.indexOf(r as never)) as Triple,
    rings: tri(rings),
    positions: tri(positions),
    reflector: REFLECTOR_NAMES.indexOf(reflector.toUpperCase() as never),
    plugs: plugs
      .toUpperCase()
      .split(/\s+/)
      .filter(Boolean)
      .map((p) => [index(p[0]), index(p[1])]),
  };
}

export function describeKey(key: Key) {
  return {
    reflector: REFLECTOR_NAMES[key.reflector],
    rotors: key.rotors.map((r) => ROTOR_NAMES[r]).join(" "),
    rings: key.rings.map(letter).join(""),
    positions: key.positions.map(letter).join(""),
    plugs: key.plugs
      .map(([a, b]) => (a < b ? letter(a) + letter(b) : letter(b) + letter(a)))
      .sort()
      .join(" "),
  };
}

/** A uniformly random daily key with `plugCount` cables (historically 10). */
export function randomKey(plugCount: number, rand: () => number = Math.random): Key {
  const pick = (n: number) => Math.floor(rand() * n);
  const shuffle = (xs: number[]) => {
    for (let i = xs.length - 1; i > 0; i--) {
      const j = pick(i + 1);
      [xs[i], xs[j]] = [xs[j], xs[i]];
    }
    return xs;
  };
  const rotors = shuffle([0, 1, 2, 3, 4]).slice(0, 3) as Triple;
  const letters = shuffle(Array.from({ length: 26 }, (_, i) => i));
  return {
    rotors,
    rings: [pick(26), pick(26), pick(26)],
    positions: [pick(26), pick(26), pick(26)],
    reflector: 0,
    plugs: Array.from({ length: plugCount }, (_, i) => [letters[2 * i], letters[2 * i + 1]] as [number, number]),
  };
}
