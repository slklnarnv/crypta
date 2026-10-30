// The ciphertext-only attack, in four stages.
//
// 1. Screen: try every rotor order, start position and right-hand ring with an
//    empty plugboard, and rank them by index of coincidence (IoC). Real text
//    has lumpy letter counts and random text doesn't; the right rotors leave
//    some lumpiness behind even when the plugboard is wrong.
// 2. Middle ring: it decides when the left rotor turns over. Pick it by IoC.
// 3. Plugboard: hill-climb the plugboard, swapping cables while the decrypt
//    gets more English-like (IoC first, then quadgrams).
// 4. Polish: fine-tune both rings by quadgrams, which notice a few garbled words.
//
// Everything here is plain functions on typed arrays so it can run in a Web
// Worker and in tests alike.

import type { Key } from "../enigma/machine";
import { BACKWARD, FORWARD, NOTCH, REFLECTOR } from "../enigma/wiring";

type Triple = [number, number, number];

/** A rotor setting with no plugboard yet. Left ring is always A: it only shifts the left window. */
export interface Setting {
  rotors: Triple;
  rings: Triple;
  positions: Triple;
}

export interface Candidate extends Setting {
  score: number;
}

/** The 60 ways to put 3 of the 5 rotors in the machine. */
export const ROTOR_ORDERS: Triple[] = [];
for (let l = 0; l < 5; l++)
  for (let m = 0; m < 5; m++)
    for (let r = 0; r < 5; r++) if (l !== m && m !== r && l !== r) ROTOR_ORDERS.push([l, m, r]);

// ---- the scrambler: rotors + reflector, as a lookup table --------------------------

const cores = new Map<string, Uint8Array>();

/**
 * core[((sL*26 + sM)*26 + sR)*26 + c]: rotors-and-reflector output for rotor shifts
 * sL, sM, sR. 457 kB per rotor order, so only the last few are kept.
 */
function coreTable(rotors: Triple): Uint8Array {
  const id = rotors.join();
  let t = cores.get(id);
  if (t) return t;
  if (cores.size >= 8) cores.delete(cores.keys().next().value!);
  cores.set(id, (t = new Uint8Array(26 ** 4)));
  const pass = (w: number[], c: number, s: number) => (w[(c + s) % 26] - s + 26) % 26;
  const [L, M, R] = rotors;
  for (let sL = 0; sL < 26; sL++)
    for (let sM = 0; sM < 26; sM++)
      for (let sR = 0; sR < 26; sR++)
        for (let c = 0; c < 26; c++) {
          let x = pass(FORWARD[R], c, sR);
          x = pass(FORWARD[M], x, sM);
          x = pass(FORWARD[L], x, sL);
          x = REFLECTOR[0][x];
          x = pass(BACKWARD[L], x, sL);
          x = pass(BACKWARD[M], x, sM);
          t[((sL * 26 + sM) * 26 + sR) * 26 + c] = pass(BACKWARD[R], x, sR);
        }
  return t;
}

/**
 * The scrambler offsets for every letter of a message: offsets[i] + c indexes the core
 * table for letter i. Mirrors `step` in machine.ts, written for speed.
 */
function offsets(s: Setting, n: number, out = new Int32Array(n)): Int32Array {
  const nm = NOTCH[s.rotors[1]];
  const nr = NOTCH[s.rotors[2]];
  let [l, m, r] = s.positions;
  const [rl, rm, rr] = s.rings;
  for (let i = 0; i < n; i++) {
    if (m === nm) {
      l = (l + 1) % 26;
      m = (m + 1) % 26;
    } else if (r === nr) m = (m + 1) % 26;
    r = (r + 1) % 26;
    out[i] = ((((l - rl + 26) % 26) * 26 + ((m - rm + 26) % 26)) * 26 + ((r - rr + 26) % 26)) * 26;
  }
  return out;
}

/** Per-letter scrambler permutations for one setting: perms[i*26 + c]. */
export function scramblers(s: Setting, n: number, core = coreTable(s.rotors)): Uint8Array {
  const off = offsets(s, n);
  const out = new Uint8Array(n * 26);
  for (let i = 0; i < n; i++) out.set(core.subarray(off[i], off[i] + 26), i * 26);
  return out;
}

// ---- scoring ------------------------------------------------------------------------

/** Index of coincidence, scaled so English ≈ 1.73 and random text ≈ 1.0. */
export function ioc(counts: Int32Array, n: number): number {
  let s = 0;
  for (let i = 0; i < 26; i++) s += counts[i] * (counts[i] - 1);
  return (s * 26) / (n * (n - 1));
}

/** Sum of quadgram scores (0..255 each, see scripts/build-ngrams.mjs), averaged per quadgram. */
export function quadScore(text: Uint8Array, quads: Uint8Array): number {
  let q = (text[0] * 26 + text[1]) * 26 + text[2];
  let s = 0;
  for (let i = 3; i < text.length; i++) {
    q = (q % 17576) * 26 + text[i];
    s += quads[q];
  }
  return s / (text.length - 3);
}

// ---- stage 1: screening ---------------------------------------------------------------

/** Keeps the best `size` items seen so far (a binary min-heap on score). */
class TopK {
  items: Candidate[] = [];
  constructor(readonly size: number) {}
  get floor() {
    return this.items.length < this.size ? -Infinity : this.items[0].score;
  }
  push(c: Candidate) {
    const h = this.items;
    if (h.length < this.size) {
      h.push(c);
      for (let i = h.length - 1, p; i > 0 && h[(p = (i - 1) >> 1)].score > h[i].score; i = p) [h[i], h[p]] = [h[p], h[i]];
    } else if (c.score > h[0].score) {
      h[0] = c;
      for (let i = 0; ; ) {
        const a = 2 * i + 1, b = a + 1;
        let m = i;
        if (a < h.length && h[a].score < h[m].score) m = a;
        if (b < h.length && h[b].score < h[m].score) m = b;
        if (m === i) break;
        [h[i], h[m]] = [h[m], h[i]];
        i = m;
      }
    }
  }
  sorted() {
    return [...this.items].sort((a, b) => b.score - a.score);
  }
}

/** Number of settings `screen` tries for one rotor order: 26³ positions × 26 right rings. */
export const SETTINGS_PER_ORDER = 26 ** 4;

/** Shortest stretch of text whose IoC is trusted. */
const MIN_STRETCH = 100;

/** How far a stretch of `len` letters with Σc(c−1) = `pairs` sits above random, in standard deviations. */
const zScore = (pairs: number, len: number) => ((26 * pairs) / len - (len - 1)) / (5 * Math.SQRT2);

/**
 * Stage 1 for one rotor order: IoC of the plugboard-free decrypt for every start
 * position and right ring. Returns the `keep` best.
 *
 * The middle ring is unknown, so we can't tell when the left rotor turns over.
 * Instead the left rotor is held still, which decrypts either everything before
 * the real turnover or (for the setting one notch on) everything after it
 * exactly. So the score is the best IoC over the message's opening and closing
 * stretches, measured in standard deviations above random so stretches of
 * different lengths compare fairly: (κ − 1)(n − 1) / √50.
 */
export function screen(ct: Uint8Array, rotors: Triple, keep: number): Candidate[] {
  const n = ct.length;
  const core = coreTable(rotors);
  const best = new TopK(keep);
  const counts = new Int32Array(26);
  const off = new Int32Array(n); // right-shift and ciphertext part of each letter's core-table index
  const ends = new Int32Array(n + 1); // where each run with a steady middle rotor ends
  const cutCounts = new Int32Array((n + 1) * 26); // letter counts at each run end, for closing stretches
  const cutAt = new Int32Array(n + 1);
  const nr = NOTCH[rotors[2]];
  for (let rr = 0; rr < 26; rr++)
    for (let pr = 0; pr < 26; pr++) {
      // The right rotor moves the same way whatever the left and middle rotors do,
      // so work out its part once. The middle rotor steps when the right window
      // sits on its notch, which splits the message into runs of up to 26 letters.
      const notchShift = (nr - rr + 26) % 26;
      let sr = (pr - rr + 26) % 26;
      let runs = 0;
      let firstStep = 0;
      for (let i = 0; i < n; i++) {
        if (sr === notchShift) {
          if (i === 0) firstStep = 1;
          else ends[runs++] = i;
        }
        sr = sr === 25 ? 0 : sr + 1;
        off[i] = sr * 26 + ct[i];
      }
      ends[runs++] = n;

      for (let pl = 0; pl < 26; pl++)
        for (let pm = 0; pm < 26; pm++) {
          counts.fill(0);
          let m = (pm + firstStep) % 26;
          let pairs = 0; // Σ c(c−1), kept up to date letter by letter
          let score = -Infinity;
          let cuts = 0;
          for (let k = 0, i = 0; k < runs; k++) {
            const row = (pl * 26 + m) * 676;
            for (const end = ends[k]; i < end; i++) pairs += 2 * counts[core[row + off[i]]]++;
            if (i >= MIN_STRETCH) score = Math.max(score, zScore(pairs, i));
            if (n - i >= MIN_STRETCH) {
              cutCounts.set(counts, 26 * cuts);
              cutAt[cuts++] = i;
            }
            m = m === 25 ? 0 : m + 1;
          }
          for (let k = 0; k < cuts; k++) {
            let p = 0;
            for (let c = 0; c < 26; c++) {
              const d = counts[c] - cutCounts[26 * k + c];
              p += d * (d - 1);
            }
            score = Math.max(score, zScore(p, n - cutAt[k]));
          }
          if (score > best.floor) best.push({ rotors, rings: [0, 0, rr], positions: [pl, pm, pr], score });
        }
    }
  return best.sorted();
}

// ---- stage 2 and 4: rings -------------------------------------------------------------
//
// A ring and its window can turn together without changing the rotor's wiring
// offset; all that moves is *when* that rotor kicks its left neighbour. These
// helpers list such variants of a setting and pick the best one.

/**
 * Middle ring variants: all 26 turnover points for the left rotor, each also
 * starting the left and middle rotors `back` notches earlier (the screen may have
 * matched the text after the turnover).
 */
function middleRingVariants(s: Setting, backs: number[]): Setting[] {
  const [pl, pm, pr] = s.positions;
  const shift = pm - s.rings[1];
  return backs.flatMap((back) =>
    Array.from({ length: 26 }, (_, rm): Setting => ({
      rotors: s.rotors,
      rings: [0, rm, s.rings[2]],
      positions: [(pl - back + 26) % 26, (((shift - back + rm) % 26) + 26) % 26, pr],
    })),
  );
}

/** Right ring variants: all 26 points where the middle rotor steps, with the middle one notch either way. */
function rightRingVariants(s: Setting): Setting[] {
  const [pl, pm, pr] = s.positions;
  return [-1, 0, 1].flatMap((dm) =>
    Array.from({ length: 26 }, (_, d): Setting => ({
      rotors: s.rotors,
      rings: [0, s.rings[1], (s.rings[2] + d) % 26],
      positions: [pl, (pm + dm + 26) % 26, (pr + d) % 26],
    })),
  );
}

function bestOf(
  ct: Uint8Array,
  variants: Setting[],
  plug: Uint8Array,
  core: Uint8Array,
  objective: Objective,
  quads: Uint8Array,
): Setting {
  const n = ct.length;
  const counts = new Int32Array(26);
  const text = new Uint8Array(n);
  const off = new Int32Array(n);
  let best = variants[0];
  let bestScore = -Infinity;
  for (const t of variants) {
    offsets(t, n, off);
    let score: number;
    if (objective === "quad") {
      for (let i = 0; i < n; i++) text[i] = plug[core[off[i] + plug[ct[i]]]];
      score = quadScore(text, quads);
    } else {
      counts.fill(0);
      for (let i = 0; i < n; i++) counts[core[off[i] + plug[ct[i]]]]++;
      score = ioc(counts, n);
    }
    if (score > bestScore) [best, bestScore] = [t, score];
  }
  return best;
}

// ---- stage 2: plugboard hill climbing ---------------------------------------------

export type Objective = "ioc" | "quad";

export interface Climbed {
  setting: Setting;
  plug: Uint8Array; // involution, plug[a] = b
  score: number; // quadgram score per letter
  plaintext: Uint8Array;
}

function decryptWith(perms: Uint8Array, ct: Uint8Array, plug: Uint8Array, out: Uint8Array) {
  for (let i = 0; i < ct.length; i++) out[i] = plug[perms[i * 26 + plug[ct[i]]]];
  return out;
}

/**
 * Greedy plugboard search: repeatedly try connecting every pair of letters a, b
 * (undoing whatever they were plugged to; if both had partners, also trying those
 * partners plugged to each other) and keep any change that scores better.
 */
export function climbPlugboard(
  ct: Uint8Array,
  perms: Uint8Array,
  plug: Uint8Array,
  objective: Objective,
  quads: Uint8Array,
  onImprove?: (plug: Uint8Array, score: number) => void,
): number {
  const n = ct.length;
  const counts = new Int32Array(26);
  const text = new Uint8Array(n);
  const score = (p: Uint8Array) => {
    if (objective === "quad") return quadScore(decryptWith(perms, ct, p, text), quads);
    counts.fill(0);
    for (let i = 0; i < n; i++) counts[perms[i * 26 + p[ct[i]]]]++; // output plugs don't change IoC
    return ioc(counts, n);
  };
  let best = score(plug);
  const trial = new Uint8Array(26);
  const keep = (s: number) => {
    if (s <= best) return false;
    best = s;
    plug.set(trial);
    onImprove?.(plug, s);
    return true;
  };
  for (let improved = true; improved; ) {
    improved = false;
    for (let a = 0; a < 26; a++)
      for (let b = a + 1; b < 26; b++) {
        trial.set(plug);
        const [x, y] = [trial[a], trial[b]];
        if (x === b) {
          trial[a] = a;
          trial[b] = b;
          improved = keep(score(trial)) || improved;
          continue;
        }
        trial[x] = x;
        trial[y] = y;
        trial[a] = b;
        trial[b] = a;
        const swapped = keep(score(trial));
        if (!swapped && x !== a && y !== b) {
          trial[x] = y;
          trial[y] = x;
          improved = keep(score(trial)) || improved;
        }
        improved = swapped || improved;
      }
  }
  return best;
}

/**
 * Stages 2 and 3 for one screened setting: middle ring, plugboard by IoC, middle
 * ring again, then (if promising) plugboard by quadgrams and a last ring check.
 */
export function solveSetting(
  ct: Uint8Array,
  screened: Setting,
  quads: Uint8Array,
  onImprove?: (c: Climbed) => void,
): Climbed {
  const n = ct.length;
  const core = coreTable(screened.rotors);
  const plug = Uint8Array.from({ length: 26 }, (_, i) => i);
  let setting = bestOf(ct, middleRingVariants(screened, [0, 1]), plug, core, "ioc", quads);
  let perms = scramblers(setting, n, core);
  const text = new Uint8Array(n);
  const report = (p: Uint8Array, s: number) =>
    onImprove?.({ setting, plug: p.slice(), score: s, plaintext: decryptWith(perms, ct, p, text).slice() });
  /** Switch to the best of `variants`; true if that changed the setting. */
  const move = (variants: Setting[], objective: Objective) => {
    const t = bestOf(ct, variants, plug, core, objective, quads);
    if (t.positions.join() === setting.positions.join() && t.rings.join() === setting.rings.join()) return false;
    setting = t;
    perms = scramblers(setting, n, core);
    return true;
  };

  const steps: Uint8Array[] = []; // plugboards along the IoC climb, replayed if this setting is promising
  const record = (p: Uint8Array) => steps.push(p.slice());
  let lumpiness = climbPlugboard(ct, perms, plug, "ioc", quads, record);
  // With some cables in place the text is cleaner, so the ring is easier to judge.
  if (move(middleRingVariants(setting, [0]), "ioc")) lumpiness = climbPlugboard(ct, perms, plug, "ioc", quads, record);

  // The quadgram climb is the slow part, so only promising settings get one.
  if (lumpiness < PROMISING_IOC)
    return { setting, plug, score: quadScore(decryptWith(perms, ct, plug, text), quads), plaintext: text.slice() };
  if (onImprove) for (const p of steps) report(p, quadScore(decryptWith(perms, ct, p, text), quads));
  let score = climbPlugboard(ct, perms, plug, "quad", quads, report);

  // Stage 4: a turnover in the wrong place garbles only a stretch of text, which
  // barely moves the IoC but stands out to quadgrams. Polish both rings.
  for (let round = 0; round < 3; round++) {
    const moved = move(rightRingVariants(setting), "quad") || move(middleRingVariants(setting, [-1, 0, 1]), "quad");
    if (!moved) break;
    score = climbPlugboard(ct, perms, plug, "quad", quads, report);
  }
  return { setting, plug, score, plaintext: decryptWith(perms, ct, plug, text).slice() };
}

/**
 * After the IoC climb the right setting scores about 1.65 or more in our tests, while
 * 95% of wrong ones stay below about 1.35 (see tests/bench.test.ts).
 */
const PROMISING_IOC = 1.45;

export function toKey(c: Climbed): Key {
  const plugs: [number, number][] = [];
  c.plug.forEach((b, a) => b > a && plugs.push([a, b]));
  return { ...c.setting, reflector: 0, plugs };
}

// ---- confidence ---------------------------------------------------------------------

// Quadgram score per letter measured on English prose and on uniform random letters.
export const ENGLISH_QUAD = 192;
export const RANDOM_QUAD = 24;

/** 0 = noise, 1 = typical English. */
export const englishness = (quad: number) =>
  Math.max(0, Math.min(1, (quad - RANDOM_QUAD) / (ENGLISH_QUAD - RANDOM_QUAD)));

/** Above this the decrypt is readable English, not a lucky local optimum. */
export const SOLVED = 0.82;
