import { useEffect, useMemo, useRef, useState } from "react";
import { crack } from "../crack/cracker";
import { Enigma, randomKey, type Key } from "../enigma/machine";
import { clean } from "../enigma/wiring";
import { SAMPLES } from "../samples";
import { CrackView } from "./CrackView";
import { Machine } from "./Machine";
import { Tape } from "./Tape";
import { usePaced } from "./usePaced";

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Letters needed for a quick crack at a given plugboard size (measured, see README). */
const lettersNeeded = (cables: number) => (cables <= 3 ? 200 : cables <= 6 ? 350 : 400);

export function App() {
  const [cables, setCables] = useState(5);
  const [key, setKey] = useState<Key>(() => randomKey(5));
  const [message, setMessage] = useState(SAMPLES[3].text);
  const [lit, setLit] = useState<string | null>(null);
  const { shown, push, clear } = usePaced(reducedMotion() ? 0 : 110);
  const cancel = useRef<(() => void) | null>(null);
  const typing = useRef<number | null>(null);

  const letters = clean(message);
  const { ciphertext, windows } = useMemo(() => {
    const m = new Enigma(key);
    return { ciphertext: m.run(letters), windows: m.pos };
  }, [key, letters]);

  // Any change to the message or key makes the running crack meaningless.
  const stopCrack = () => {
    cancel.current?.();
    cancel.current = null;
    clear();
  };
  useEffect(() => () => cancel.current?.(), []);

  // Light the lamp for the newest letter, like pressing a key on the real machine.
  const prevLength = useRef(letters.length);
  useEffect(() => {
    if (letters.length > prevLength.current) {
      setLit(ciphertext.at(-1)!);
      const t = setTimeout(() => setLit(null), 220);
      prevLength.current = letters.length;
      return () => clearTimeout(t);
    }
    prevLength.current = letters.length;
  }, [letters, ciphertext]);

  const edit = (text: string) => {
    if (typing.current) clearInterval(typing.current);
    stopCrack();
    setMessage(text);
  };

  /** Type a sample in quickly so the lamps and rotors visibly run. */
  const typeSample = (text: string) => {
    edit("");
    if (reducedMotion()) return setMessage(text);
    let i = 0;
    typing.current = window.setInterval(() => {
      i = Math.min(text.length, i + 4);
      setMessage(text.slice(0, i));
      if (i === text.length) clearInterval(typing.current!);
    }, 16);
  };

  const newKey = (n = cables) => {
    stopCrack();
    setCables(n);
    setKey(randomKey(n));
  };

  const startCrack = () => {
    stopCrack();
    cancel.current = crack(ciphertext, push);
  };

  const running = shown?.phase === "screening" || shown?.phase === "climbing";
  const need = lettersNeeded(cables);
  const short = letters.length < need;

  return (
    <>
      <header className="masthead">
        <span className="wordmark">crypta</span>
        <nav>
          <a href="#how">How it works</a>
          <a href="https://github.com/slklnarnv/crypta">Source</a>
        </nav>
      </header>

      <main>
        <section className="intro">
          <h1>Break Enigma in your browser</h1>
          <p className="lede">
            Write a message and a simulated Enigma I scrambles it with a secret key. Then your own computer works out
            the key from nothing but the scrambled letters, using every processor core it has.
          </p>
        </section>

        <section className="step" aria-labelledby="write">
          <h2 id="write">
            <span className="n">1</span> Write a message
          </h2>
          <Machine windows={windows} lit={lit} />

          <div className="pad">
            <label htmlFor="message" className="visually-hidden">
              Your message
            </label>
            <textarea
              id="message"
              value={message}
              onChange={(e) => edit(e.target.value)}
              placeholder="Type here and watch the lamps. Only the letters A to Z are encrypted."
              rows={6}
              spellCheck={false}
            />
            <div className="pad-foot">
              <span className={short ? "count short" : "count"}>
                {letters.length} letters
                {short ? `: add about ${need - letters.length} more to crack ${cables} cables quickly` : ""}
              </span>
              <span className="samples">
                Try:
                {SAMPLES.map((s) => (
                  <button key={s.name} type="button" className="chip" onClick={() => typeSample(s.text)}>
                    {s.name}
                  </button>
                ))}
              </span>
            </div>
          </div>

          <div className="keybox">
            <label htmlFor="cables">
              Plugboard cables <output>{cables}</output>
            </label>
            <input
              id="cables"
              type="range"
              min={0}
              max={10}
              value={cables}
              onChange={(e) => newKey(Number(e.target.value))}
            />
            <p className="keynote">
              {cables <= 6
                ? "Each cable swaps two letters. Up to six usually cracks in seconds."
                : cables <= 8
                  ? "Seven or eight cables crack about half the time."
                  : "Ten was standard in the war. With nothing but the letters, this attack almost never wins."}
            </p>
            <button type="button" className="ghost" onClick={() => newKey()}>
              New secret key
            </button>
          </div>

          <Tape text={ciphertext} label="What the radio operator sends" empty="Scrambled letters appear here as you type." />
        </section>

        <section className="step" aria-labelledby="crack">
          <h2 id="crack">
            <span className="n">2</span> Crack it
          </h2>
          <p className="steplede">
            The cracker sees only the scrambled letters above. It doesn't know the rotors, their starting letters, the
            rings or the plugboard.
          </p>
          <div className="actions">
            {running ? (
              <button type="button" className="primary" onClick={stopCrack}>
                Stop
              </button>
            ) : (
              <button type="button" className="primary" onClick={startCrack} disabled={letters.length < 60}>
                {shown ? "Crack again" : "Crack the key"}
              </button>
            )}
            {letters.length < 60 && <span className="hint">Write at least 60 letters first.</span>}
          </div>
          {shown && <CrackView progress={shown} ciphertext={ciphertext} actual={key} />}
        </section>

        <How />
      </main>

      <footer className="foot">
        <p>
          Made by Arnav. Rotor wiring from the{" "}
          <a href="https://www.cryptomuseum.com/crypto/enigma/wiring.htm">Crypto Museum</a>, English statistics from
          Project Gutenberg books.
        </p>
      </footer>
    </>
  );
}

function How() {
  return (
    <section className="how" id="how" aria-labelledby="how-title">
      <h2 id="how-title">How it works</h2>
      <p>
        An Enigma key has about 10<sup>23</sup> possibilities, far too many to try one by one. The trick is that the
        key splits into parts that can be found one at a time.
      </p>
      <ol>
        <li>
          <h3>Rotors first</h3>
          <p>
            For each of the 60 rotor orders, every start position and every right-hand ring (27 million settings in
            all), decrypt the message with no plugboard and count the letters. English has lumpy counts: lots of E and
            T, hardly any Q. Random letters don't. The settings that leave the lumpiest counts go through to the next
            round.
          </p>
        </li>
        <li>
          <h3>Then the plugboard</h3>
          <p>
            For the best few thousand settings, swap plugboard cables one pair at a time and keep any change that makes
            the text look more like English. "Like English" is scored by how common each run of four letters is in a
            few million words of real books.
          </p>
        </li>
        <li>
          <h3>Then stop</h3>
          <p>
            The first time the text reads as English with high confidence, that's the key. The work is shared across
            your processor cores with Web Workers, so a laptop usually finishes in seconds.
          </p>
        </li>
      </ol>
      <p>
        With all ten wartime cables and no other clues, this attack needs much longer messages. Bletchley Park didn't
        rely on text alone either: they guessed words that were likely to appear, such as WETTERBERICHT (weather
        report), and Turing's Bombe machines tested those guesses.
      </p>
    </section>
  );
}
