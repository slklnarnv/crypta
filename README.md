# crypta

**Break Enigma in your browser.** Type a message, and a simulated Enigma I
scrambles it with a random secret key. Then press *Crack* and watch your own
computer recover the key from nothing but the scrambled letters, across every
processor core, in a few seconds.

There's no server and no install. It's a static page, and all the work happens in the tab.

## What happens when you press Crack

An Enigma key has about 10²³ possibilities, so trying them one by one is
hopeless. The attack splits the key into parts and finds them one at a time:

1. **Rotors.** For each of the 60 rotor orders, every start position and
   every right-hand ring (27 million settings), decrypt with no plugboard and
   measure the *index of coincidence*: how lumpy the letter counts are. English
   is lumpy (lots of E, hardly any Q) and random text isn't, and the right
   rotors leave some lumpiness behind even with the plugboard missing.
2. **Middle ring.** It only decides when the left rotor turns over, so it's
   picked afterwards by the same measure.
3. **Plugboard.** For the best settings, swap cables one pair at a time and keep
   any swap that makes the text more English. "English" means letter
   lumpiness first, then how common each run of four letters is in 10 million
   letters of Project Gutenberg books.

The screen holds the left rotor still and scores both the start and the end of
the message, so a left-rotor turnover in the middle of the text can't hide
the right setting. The work is split across Web Workers, one per core.

## How well it works

Measured with `tests/bench.test.ts` on 350–400 letter messages:

| Plugboard cables | Result |
| --- | --- |
| 0–6 | The right setting ranks in the top 15 of its rotor order in 16 of 16 test keys; a typical laptop cracks it in 5–10 s |
| 8 | Recovered about half the time |
| 10 (wartime standard) | Not recovered; this attack needs far longer messages |

That last row is history, not a bug. Bletchley Park didn't break Enigma from
the letters alone: they guessed words likely to be in a message (a *crib*,
such as WETTERBERICHT, "weather report") and Turing's Bombe tested those guesses.

## Run it

Node 20+.

```bash
npm install
npm run dev        # http://localhost:5173
npm test -- --run  # machine + cracker tests
npm run build      # static site in dist/
```

The machine is checked letter-for-letter against the independent
[py-enigma](https://py-enigma.readthedocs.io/) library on 30 random keys
(`tests/vectors.json`, made by `scripts/make-vectors.py`).
`public/quadgrams.bin` comes from `npm run ngrams -- <folder of .txt books>`.

## Where things are

| | |
| --- | --- |
| `src/enigma/` | the machine: wiring, stepping (with the double step), plugboard |
| `src/crack/solver.ts` | the attack, as plain functions on typed arrays |
| `src/crack/worker.ts`, `cracker.ts` | spreading it across cores and reporting progress |
| `src/ui/` | the page: lampboard, paper tape, crack view |
| `tests/` | correctness tests, plus opt-in benchmarks (`BENCH=1`) |

## Credits

Rotor wiring from the [Crypto Museum](https://www.cryptomuseum.com/crypto/enigma/wiring.htm).
English statistics from [Project Gutenberg](https://www.gutenberg.org/).
Inspired by the Enigma videos from [Numberphile](https://www.youtube.com/watch?v=G2_Q9FoD-oQ)
and [Veritasium](https://www.youtube.com/watch?v=JsBZOcqZerk).

MIT licence.
