// One of several identical workers. The main thread hands out rotor orders to
// screen, then batches of screened settings to climb (see cracker.ts).

import { ROTOR_ORDERS, screen, solveSetting, toKey, type Candidate, type Climbed } from "./solver";

export type ToWorker =
  | { type: "init"; ct: Uint8Array; quads: Uint8Array }
  | { type: "screen"; order: number; keep: number }
  | { type: "solve"; settings: Candidate[] };

export type FromWorker =
  | { type: "screened"; order: number; candidates: Candidate[] }
  | { type: "progress"; result: Result }
  | { type: "solved"; results: Result[] };

export interface Result {
  key: ReturnType<typeof toKey>;
  score: number;
  plaintext: Uint8Array;
}

let ct: Uint8Array = new Uint8Array();
let quads: Uint8Array = new Uint8Array();
const post = (m: FromWorker) => postMessage(m);
const result = (c: Climbed): Result => ({ key: toKey(c), score: c.score, plaintext: c.plaintext });

onmessage = ({ data }: MessageEvent<ToWorker>) => {
  if (data.type === "init") ({ ct, quads } = data);
  else if (data.type === "screen") post({ type: "screened", order: data.order, candidates: screen(ct, ROTOR_ORDERS[data.order], data.keep) });
  else {
    // Stream every step of a promising climb so the page can show letters falling into place.
    const results = data.settings.map((s) =>
      result(solveSetting(ct, s, quads, (c) => post({ type: "progress", result: result(c) }))),
    );
    post({ type: "solved", results });
  }
};
