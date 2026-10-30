// Slow measurements, skipped by default. Run with:
//   BENCH=1 npx vitest run tests/bench.test.ts --disableConsoleIntercept
// Options: PLUGS (default 6), TRIALS (default 10), SEED, CORPUS (a .txt for calibration).
import { readFileSync } from "node:fs";
import { describe, it } from "vitest";
import { encrypt, randomKey } from "../src/enigma/machine";
import { clean } from "../src/enigma/wiring";
import { climbPlugboard, englishness, quadScore, scramblers, screen, solveSetting } from "../src/crack/solver";
import { mulberry } from "../src/lib/random";
import { SAMPLES } from "../src/samples";

const quads = new Uint8Array(readFileSync("public/quadgrams.bin"));
const ints = (s: string) => Uint8Array.from(s, (c) => c.charCodeAt(0) - 65);

describe.skipIf(!process.env.BENCH)("bench", () => {
  it.skipIf(!process.env.CORPUS)("calibrates quadgram scores (ENGLISH_QUAD / RANDOM_QUAD)", () => {
    const corpus = clean(readFileSync(process.env.CORPUS!, "utf8"));
    const rand = mulberry(1);
    const mean = (xs: number[]) => xs.reduce((a, b) => a + b) / xs.length;
    const sample = (f: () => string) => mean(Array.from({ length: 200 }, () => quadScore(ints(f()), quads)));
    const en = sample(() => {
      const i = Math.floor(rand() * (corpus.length - 300));
      return corpus.slice(i, i + 300);
    });
    const rnd = sample(() => Array.from({ length: 300 }, () => String.fromCharCode(65 + Math.floor(rand() * 26))).join(""));
    console.log(`English ${en.toFixed(1)}, random ${rnd.toFixed(1)}`);
  });

  it("ranks the true setting within its rotor order, then climbs it", () => {
    const rand = mulberry(Number(process.env.SEED ?? 5));
    const plugs = Number(process.env.PLUGS ?? 6);
    for (let t = 0; t < Number(process.env.TRIALS ?? 10); t++) {
      const key = randomKey(plugs, rand);
      const ct = ints(encrypt(key, clean(SAMPLES[t % SAMPLES.length].text)).slice(0, 400));
      // The screen holds the left rotor still, so it matches the true start, or the
      // setting one notch on if the text after the left rotor's turnover scored better.
      const [pl, pm, pr] = key.positions;
      const l = (pl - key.rings[0] + 26) % 26;
      const m = (pm - key.rings[1] + 26) % 26;
      const wants = [[l, m, pr, key.rings[2]].join(), [(l + 1) % 26, (m + 1) % 26, pr, key.rings[2]].join()];
      const t0 = performance.now();
      const top = screen(ct, key.rotors, 2000);
      const ms = performance.now() - t0;
      const rank = top.findIndex((c) => wants.includes([...c.positions, c.rings[2]].join()));
      const e = rank >= 0 ? englishness(solveSetting(ct, top[rank], quads).score).toFixed(2) : "-";
      console.log(`${plugs} cables, trial ${t}: screen ${ms.toFixed(0)} ms, rank ${rank}, englishness ${e}`);
    }
  }, 900_000);

  it("IoC after the plugboard climb: right vs wrong settings (sets PROMISING_IOC)", () => {
    const rand = mulberry(9);
    const right: number[] = [];
    const wrong: number[] = [];
    const identity = () => Uint8Array.from({ length: 26 }, (_, i) => i);
    for (let t = 0; t < 8; t++) {
      const key = randomKey(Number(process.env.PLUGS ?? 6), rand);
      const ct = ints(encrypt(key, clean(SAMPLES[t % SAMPLES.length].text)).slice(0, 400));
      const climb = (s: Parameters<typeof scramblers>[0]) => climbPlugboard(ct, scramblers(s, ct.length), identity(), "ioc", quads);
      right.push(climb(key));
      for (const c of screen(ct, key.rotors, 60).slice(10)) wrong.push(climb(c));
    }
    wrong.sort((a, b) => a - b);
    const q = (p: number) => wrong[Math.floor(wrong.length * p)].toFixed(2);
    console.log(`right: min ${Math.min(...right).toFixed(2)} | wrong: median ${q(0.5)}, p95 ${q(0.95)}, max ${wrong.at(-1)!.toFixed(2)}`);
  }, 900_000);
});
