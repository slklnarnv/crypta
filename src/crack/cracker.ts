// Runs the attack across every CPU core and reports what it's doing.

import { Enigma, type Key } from "../enigma/machine";
import { ALPHABET } from "../enigma/wiring";
import { ROTOR_ORDERS, SETTINGS_PER_ORDER, SOLVED, englishness, type Candidate } from "./solver";
import type { FromWorker, Result, ToWorker } from "./worker";

export interface Best {
  key: Key;
  text: string; // decrypt of the analysed part of the message
  englishness: number; // 0 noise .. 1 English
}

export interface Progress {
  phase: "screening" | "climbing" | "solved" | "failed";
  tested: number; // rotor settings screened so far
  total: number;
  climbed: number; // screened settings whose plugboard has been searched
  pool: number; // how many screened settings are queued for climbing
  orders: boolean[]; // which of the 60 rotor orders have been screened
  best: Best | null;
  seconds: number;
}

const KEEP_PER_ORDER = 500;
const BATCH = 4;
const MAX_LETTERS = 400; // longer messages are cracked on their first 400 letters
const TIME_LIMIT = 120; // seconds

let quadsPromise: Promise<Uint8Array> | null = null;
const loadQuads = () =>
  (quadsPromise ??= fetch(`${import.meta.env.BASE_URL}quadgrams.bin`)
    .then((r) => r.arrayBuffer())
    .then((b) => new Uint8Array(b)));

const text = (a: Uint8Array) => Array.from(a, (i) => ALPHABET[i]).join("");

export function crack(ciphertext: string, onProgress: (p: Progress) => void): () => void {
  const ct = Uint8Array.from(ciphertext.slice(0, MAX_LETTERS), (c) => c.charCodeAt(0) - 65);
  const cores = Math.max(2, Math.min(navigator.hardwareConcurrency || 4, 16));
  const workers: Worker[] = [];
  const start = performance.now();
  const total = ROTOR_ORDERS.length * SETTINGS_PER_ORDER;
  const state: Progress = { phase: "screening", tested: 0, total, climbed: 0, pool: 0, orders: ROTOR_ORDERS.map(() => false), best: null, seconds: 0 };
  const pool: Candidate[] = [];
  let nextOrder = 0;
  let nextCandidate = 0;
  let screened = 0;
  let bestScreen = -Infinity;
  let done = false;

  const emit = () => {
    state.seconds = (performance.now() - start) / 1000;
    onProgress({ ...state, orders: [...state.orders] });
  };
  const stop = (phase: Progress["phase"]) => {
    if (done) return;
    done = true;
    workers.forEach((w) => w.terminate());
    state.phase = phase;
    emit();
  };
  // The first finished climb that reads as English may be a near miss from a
  // neighbouring setting, so the climbs already running get to finish and the
  // best one wins.
  let found: Best | null = null;
  let busy = 0; // climbing batches in flight

  /** Show `r` if it beats the best so far. Only a finished climb counts as found. */
  const offer = (r: Result, finished: boolean) => {
    const e = englishness(r.score);
    const b = { key: r.key, text: text(r.plaintext), englishness: e };
    if (finished && e >= SOLVED && (!found || e > found.englishness)) found = b;
    if (found) state.best = found;
    else if (!state.best || e > state.best.englishness) state.best = b;
  };

  const feed = (w: Worker) => {
    if (done) return;
    if (nextOrder < ROTOR_ORDERS.length) return send(w, { type: "screen", order: nextOrder++, keep: KEEP_PER_ORDER });
    if (screened < ROTOR_ORDERS.length) return; // wait until the whole field is ranked
    if (found || state.seconds > TIME_LIMIT || nextCandidate >= pool.length) {
      if (busy === 0) stop(found ? "solved" : "failed");
      return;
    }
    busy++;
    send(w, { type: "solve", settings: pool.slice(nextCandidate, (nextCandidate += BATCH)) });
  };
  const send = (w: Worker, m: ToWorker) => w.postMessage(m);
  const idle: Worker[] = [];

  loadQuads().then((quads) => {
    if (done) return;
    for (let i = 0; i < cores; i++) {
      const w = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
      workers.push(w);
      w.onmessage = ({ data }: MessageEvent<FromWorker>) => {
        if (done) return;
        if (data.type === "screened") {
          screened++;
          state.orders[data.order] = true;
          state.tested += SETTINGS_PER_ORDER;
          pool.push(...data.candidates);
          // Until the plugboard search starts, show the best plugboard-free guess.
          const top = data.candidates[0];
          if (top && top.score > bestScreen && state.phase === "screening") {
            bestScreen = top.score;
            const key: Key = { ...top, reflector: 0, plugs: [] };
            state.best = { key, text: new Enigma(key).run(text(ct)), englishness: 0 };
          }
          if (screened === ROTOR_ORDERS.length) {
            pool.sort((a, b) => b.score - a.score);
            state.phase = "climbing";
            state.pool = pool.length;
            idle.splice(0).forEach(feed);
          }
        } else if (data.type === "progress") offer(data.result, false);
        else {
          busy--;
          state.climbed += data.results.length;
          data.results.forEach((r) => offer(r, true));
        }
        emit();
        if (nextOrder >= ROTOR_ORDERS.length && screened < ROTOR_ORDERS.length && data.type === "screened") idle.push(w);
        else if (data.type !== "progress") feed(w);
      };
      send(w, { type: "init", ct, quads });
      feed(w);
    }
  });

  return () => stop("failed");
}
