// Count letter quadgrams in a folder of plain-text books and write
// public/quadgrams.bin: 26^4 bytes, one per quadgram, holding its log-probability
// rescaled to 0..255 (0 = never seen). The cracker sums these to score "how English".
//
//   node scripts/build-ngrams.mjs <folder-of-.txt>   (e.g. Project Gutenberg books)

import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const dir = process.argv[2];
if (!dir) throw new Error("usage: node scripts/build-ngrams.mjs <folder>");

const counts = new Float64Array(26 ** 4);
let total = 0;
for (const name of readdirSync(dir).filter((f) => f.endsWith(".txt"))) {
  let text = readFileSync(join(dir, name), "utf8");
  // Drop the Project Gutenberg licence boilerplate around the book itself.
  const start = text.search(/\*\*\* ?START OF/);
  const end = text.search(/\*\*\* ?END OF/);
  if (start >= 0 && end > start) text = text.slice(text.indexOf("\n", start), end);
  const letters = text.toUpperCase().replace(/[^A-Z]/g, "");
  let q = 0;
  for (let i = 0; i < letters.length; i++) {
    q = (q * 26 + letters.charCodeAt(i) - 65) % 26 ** 4;
    if (i >= 3) counts[q]++, total++;
  }
  console.log(`${name}: ${letters.length.toLocaleString()} letters`);
}

const floor = Math.log10(0.01 / total); // unseen quadgrams count as 1/100 of a sighting
const logp = counts.map((c) => (c ? Math.log10(c / total) : floor));
const max = logp.reduce((a, b) => Math.max(a, b));
const out = new Uint8Array(logp.length);
for (let i = 0; i < logp.length; i++) out[i] = Math.round(((logp[i] - floor) / (max - floor)) * 255);

writeFileSync("public/quadgrams.bin", out);
console.log(`${total.toLocaleString()} quadgrams → public/quadgrams.bin`);
