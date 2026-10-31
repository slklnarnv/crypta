import { encrypt, type Key } from "../enigma/machine";
import { clean, index, letter } from "../enigma/wiring";
import { mulberry } from "../lib/random";
import { MESSAGES } from "./messages";

export type Pair = [number, number];
export type Mark = "green" | "yellow" | "grey";

export const CABLES = 5;
export const TRIES = 6;

const DAY = 86_400_000;
/** Puzzle #1. Day numbers count whole days from here. */
const LAUNCH = Date.UTC(2026, 9, 31);

/** The player's own calendar day, so everyone in a timezone flips to the next puzzle at local midnight. */
export function dayNumber(date: Date): number {
  return Math.round((Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) - LAUNCH) / DAY);
}

export function dateOfDay(day: number): Date {
  const d = new Date(LAUNCH + day * DAY);
  return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

function shuffle<T>(xs: T[], rand: () => number): T[] {
  for (let i = xs.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [xs[i], xs[j]] = [xs[j], xs[i]];
  }
  return xs;
}

/** Every message once per cycle, in an order that is shuffled afresh each cycle. */
function messageFor(day: number) {
  const n = MESSAGES.length;
  const cycle = Math.floor(day / n);
  const order = shuffle(Array.from({ length: n }, (_, i) => i), mulberry(0x5eed + cycle));
  return MESSAGES[order[((day % n) + n) % n]];
}

export interface Puzzle {
  day: number;
  subject: string;
  /** The message as written, so the decrypt can be laid out with its word gaps. */
  text: string;
  plaintext: string;
  ciphertext: string;
  key: Key;
}

/**
 * Today's intercept. Rotors, rings and start are random; the five cables only join letters
 * that occur at least three times in the message, so every cable leaves visible traces in the
 * decrypt instead of hiding behind a Q or a Z.
 */
export function puzzleFor(day: number): Puzzle {
  const { subject, text } = messageFor(day);
  const plaintext = clean(text);
  const rand = mulberry(Math.imul(day + 1, 0x9e3779b1));
  const pick = (n: number) => Math.floor(rand() * n);
  const rotors = shuffle([0, 1, 2, 3, 4], rand).slice(0, 3) as Key["rotors"];
  const counts = new Array<number>(26).fill(0);
  for (const ch of plaintext) counts[index(ch)]++;
  const common = shuffle(
    counts.flatMap((c, i) => (c >= 3 ? [i] : [])),
    rand,
  );
  const plugs = Array.from({ length: CABLES }, (_, i) => [common[2 * i], common[2 * i + 1]] as Pair);
  const key: Key = {
    rotors,
    rings: [pick(26), pick(26), pick(26)],
    positions: [pick(26), pick(26), pick(26)],
    reflector: 0,
    plugs,
  };
  return { day, subject, text, plaintext, ciphertext: encrypt(key, plaintext), key };
}

/** Decrypt the intercept with the captured settings and the player's cables. */
export const decrypt = (puzzle: Puzzle, plugs: Pair[]) => encrypt({ ...puzzle.key, plugs }, puzzle.ciphertext);

const same = (a: Pair, b: Pair) => (a[0] === b[0] && a[1] === b[1]) || (a[0] === b[1] && a[1] === b[0]);

/** Green: that exact cable is right. Yellow: one of its letters belongs in some cable. Grey: neither does. */
export function score(guess: Pair[], secret: Pair[]): Mark[] {
  const plugged = new Set(secret.flat());
  return guess.map((g) =>
    secret.some((s) => same(g, s)) ? "green" : plugged.has(g[0]) || plugged.has(g[1]) ? "yellow" : "grey",
  );
}

/** What the player can know about each letter so far. */
export type Knowledge = "paired" | "plugged" | "maybe" | "free" | undefined;

export function knowledge(guesses: Pair[][], secret: Pair[]): Knowledge[] {
  const k: Knowledge[] = new Array(26).fill(undefined);
  const yellows: Pair[] = [];
  guesses.forEach((g) =>
    score(g, secret).forEach((m, i) => {
      if (m === "green") g[i].forEach((c) => (k[c] = "paired"));
      else if (m === "grey") g[i].forEach((c) => (k[c] = "free"));
      else yellows.push(g[i]);
    }),
  );
  for (const [a, b] of yellows) {
    // A yellow cable with one end known to be unplugged means the other end is plugged somewhere.
    for (const [x, y] of [[a, b], [b, a]]) {
      if (k[x] === "paired" || k[x] === "plugged") continue;
      k[x] = k[y] === "free" ? "plugged" : (k[x] ?? "maybe");
    }
  }
  return k;
}

/** How many letters of the decrypt read true. */
export const lettersRight = (puzzle: Puzzle, plugs: Pair[]) => {
  const d = decrypt(puzzle, plugs);
  let n = 0;
  for (let i = 0; i < d.length; i++) if (d[i] === puzzle.plaintext[i]) n++;
  return n;
};

/** Pour decrypted letters back into the message's own spacing and punctuation. */
export function withGaps(text: string, letters: string): string {
  let i = 0;
  return Array.from(text.toUpperCase(), (ch) => (/[A-Z]/.test(ch) ? letters[i++] ?? "" : ch)).join("");
}

export const pairName = ([a, b]: Pair) => letter(Math.min(a, b)) + letter(Math.max(a, b));

export const parsePairs = (s: string): Pair[] =>
  s
    .split(/\s+/)
    .filter((p) => /^[A-Z]{2}$/.test(p))
    .map((p) => [index(p[0]), index(p[1])]);

const EMOJI: Record<Mark, string> = { green: "🟩", yellow: "🟨", grey: "⬛" };

/** Spoiler-free result. Cable order means nothing, so each row is sorted greens first. */
export function shareText(puzzle: Puzzle, guesses: Pair[][], won: boolean): string {
  const rank: Record<Mark, number> = { green: 0, yellow: 1, grey: 2 };
  const rows = guesses.map((g) =>
    score(g, puzzle.key.plugs)
      .sort((a, b) => rank[a] - rank[b])
      .map((m) => EMOJI[m])
      .join(""),
  );
  return [`crypta daily #${puzzle.day + 1} ${won ? guesses.length : "X"}/${TRIES}`, ...rows].join("\n");
}
