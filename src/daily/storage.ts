import { CABLES, TRIES, pairName, parsePairs, puzzleFor, score, type Pair } from "./puzzle";

// Everything lives under one localStorage key: the boards played on each day, as "AB CD EF GH IJ".
// Stats are worked out from those, so they can never drift out of step with the games.
const KEY = "crypta.daily.v1";

type Saved = Record<string, string[]>;

function load(): Saved {
  try {
    const raw = localStorage.getItem(KEY);
    const saved = raw ? JSON.parse(raw) : {};
    return saved && typeof saved === "object" ? saved : {};
  } catch {
    return {};
  }
}

function rowsOf(saved: Saved, day: number): Pair[][] {
  const rows = saved[day];
  return Array.isArray(rows) ? rows.map(parsePairs).filter((g) => g.length === CABLES).slice(0, TRIES) : [];
}

export const loadGuesses = (day: number) => rowsOf(load(), day);

export function saveGuesses(day: number, guesses: Pair[][]): void {
  try {
    const saved = load();
    saved[day] = guesses.map((g) => g.map(pairName).join(" "));
    localStorage.setItem(KEY, JSON.stringify(saved));
  } catch {
    // Private windows and full storage just mean no streak; the game still plays.
  }
}

export interface Outcome {
  won: boolean;
  tries: number;
}

export function outcome(day: number, guesses: Pair[][]): Outcome | null {
  const secret = puzzleFor(day).key.plugs;
  const won = guesses.some((g) => score(g, secret).every((m) => m === "green"));
  return won || guesses.length >= TRIES ? { won, tries: guesses.length } : null;
}

export interface Stats {
  played: number;
  wins: number;
  streak: number;
  best: number;
  /** Wins by number of tries, index 0 = solved on the first try. */
  spread: number[];
}

export function stats(today: number): Stats {
  const saved = load();
  const results = new Map<number, Outcome>();
  for (const day of Object.keys(saved).map(Number)) {
    const o = Number.isInteger(day) && day <= today ? outcome(day, rowsOf(saved, day)) : null;
    if (o) results.set(day, o);
  }
  const s: Stats = { played: results.size, wins: 0, streak: 0, best: 0, spread: new Array(TRIES).fill(0) };
  for (const o of results.values()) if (o.won) (s.wins++, s.spread[o.tries - 1]++);

  // A streak is an unbroken run of won days. Today still counts as open until it is finished.
  const days = [...results.keys()].sort((a, b) => a - b);
  let run = 0;
  let prev = NaN;
  for (const d of days) {
    run = results.get(d)!.won ? (d === prev + 1 ? run + 1 : 1) : 0;
    s.best = Math.max(s.best, run);
    prev = d;
  }
  const last = days.at(-1);
  s.streak = last !== undefined && last >= today - 1 && results.get(last)!.won ? run : 0;
  return s;
}
