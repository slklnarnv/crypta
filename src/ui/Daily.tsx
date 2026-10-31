import { useEffect, useMemo, useRef, useState } from "react";
import { describeKey } from "../enigma/machine";
import { index, letter } from "../enigma/wiring";
import {
  CABLES,
  TRIES,
  dateOfDay,
  dayNumber,
  decrypt,
  knowledge,
  lettersRight,
  pairName,
  puzzleFor,
  score,
  shareText,
  withGaps,
  type Knowledge,
  type Mark,
  type Pair,
} from "../daily/puzzle";
import { loadGuesses, outcome, saveGuesses, stats } from "../daily/storage";
import { Machine } from "./Machine";
import { Tape } from "./Tape";

const toPairs = (draft: number[]): Pair[] =>
  Array.from({ length: Math.floor(draft.length / 2) }, (_, i) => [draft[2 * i], draft[2 * i + 1]]);

const greensOf = (guess: Pair[], secret: Pair[]) =>
  score(guess, secret).flatMap((m, i) => (m === "green" ? guess[i] : []));

const MARK_WORD: Record<Mark, string> = { green: "right", yellow: "half right", grey: "wrong" };
const KNOW_WORD: Record<Exclude<Knowledge, undefined>, string> = {
  paired: "in a cable you found",
  plugged: "in some cable",
  maybe: "maybe in a cable",
  free: "not in any cable",
};

export function Daily() {
  const [day] = useState(() => dayNumber(new Date()));
  const puzzle = useMemo(() => puzzleFor(day), [day]);
  const secret = puzzle.key.plugs;
  const [guesses, setGuesses] = useState<Pair[][]>(() => loadGuesses(day));
  const [draft, setDraft] = useState<number[]>(() => {
    const last = loadGuesses(day).at(-1);
    return last ? greensOf(last, secret) : [];
  });
  const [view, setView] = useState(guesses.length - 1); // -1: no cables in
  const [note, setNote] = useState("");

  const done = outcome(day, guesses);
  const known = useMemo(() => knowledge(guesses, secret), [guesses, secret]);
  const viewed = view < 0 ? [] : guesses[view];
  const text = decrypt(puzzle, viewed);
  const right = lettersRight(puzzle, viewed);
  const settings = describeKey(puzzle.key);

  const press = (ch: string) => {
    if (done) return;
    const c = index(ch);
    const at = draft.indexOf(c);
    setNote("");
    if (at >= 0) {
      // Pressing a lit lamp pulls its cable out (or the loose end, if it isn't joined yet).
      const start = at - (at % 2);
      setDraft([...draft.slice(0, start), ...draft.slice(start + 2)]);
    } else if (draft.length === 2 * CABLES) {
      setNote("All five cables are in. Press a lit letter to pull its cable out.");
    } else {
      setDraft([...draft, c]);
    }
  };

  const back = () => {
    setNote("");
    setDraft(draft.slice(0, -1));
  };

  const submit = () => {
    if (done) return;
    if (draft.length < 2 * CABLES) {
      return setNote(`Plug in all five cables first. ${Math.floor(draft.length / 2)} of 5 so far.`);
    }
    const guess = toPairs(draft);
    const next = [...guesses, guess];
    setGuesses(next);
    saveGuesses(day, next);
    setView(next.length - 1);
    setDraft(greensOf(guess, secret));
    setNote("");
  };

  // Typing on a real keyboard works too: letters plug, Backspace unplugs, Enter sends.
  const handlers = useRef({ press, back, submit });
  handlers.current = { press, back, submit };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target as HTMLElement;
      if (target.closest("input, textarea")) return;
      if (/^[a-z]$/i.test(e.key)) handlers.current.press(e.key.toUpperCase());
      else if (e.key === "Backspace") handlers.current.back();
      else if (e.key === "Enter" && (!target.closest("button") || target.closest("[data-lamp]"))) {
        e.preventDefault();
        handlers.current.submit();
      } else return;
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const draftSet = new Set(draft);
  const lampClass = (ch: string) => {
    const k = known[index(ch)];
    return `key${draftSet.has(index(ch)) ? " on" : ""}${k ? ` k-${k}` : ""}`;
  };
  const lampLabel = (ch: string) => {
    const k = known[index(ch)];
    return `${ch}${draftSet.has(index(ch)) ? ", plugged in" : ""}${k ? `, ${KNOW_WORD[k]}` : ""}`;
  };

  const date = dateOfDay(day).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });

  return (
    <>
      <header className="masthead">
        <span className="wordmark">crypta</span>
        <nav>
          <a href="#rules">How to play</a>
          <a href="./">Break Enigma</a>
        </nav>
      </header>

      <main className="daily">
        <section className="intro">
          <h1>Daily intercept</h1>
          <p className="dateline">
            No. {day + 1} · {date}
          </p>
          <p className="lede">
            We captured today's rotor settings, but not the plugboard. Find the five cables in six tries and the message
            reads itself.
          </p>
        </section>

        <dl className="captured" aria-label="Captured settings">
          <div>
            <dt>Subject</dt>
            <dd>{puzzle.subject}</dd>
          </div>
          <div>
            <dt>Rotors</dt>
            <dd>{settings.rotors}</dd>
          </div>
          <div>
            <dt>Rings</dt>
            <dd>{settings.rings}</dd>
          </div>
          <div>
            <dt>Start</dt>
            <dd>{settings.positions}</dd>
          </div>
          <div>
            <dt>Cables</dt>
            <dd>5 missing</dd>
          </div>
        </dl>

        <Tape text={puzzle.ciphertext} label="The intercept" />

        <div className={`decrypt${done?.won && view === guesses.length - 1 ? " solved" : ""}`}>
          <Tape
            words
            text={withGaps(puzzle.text, text)}
            label={view < 0 ? "Read with no cables in" : `Read with try ${view + 1}`}
          />
          <p className="right">
            <span className="meter" style={{ "--e": `${(100 * right) / text.length}%` } as React.CSSProperties} />
            {right} of {text.length} letters read true
          </p>
        </div>

        {done && <Result day={day} guesses={guesses} won={done.won} secret={secret} />}

        <ol className="board" aria-label="Your tries">
          {Array.from({ length: TRIES }, (_, r) => {
            const guess = guesses[r];
            if (guess) {
              const marks = score(guess, secret);
              return (
                <li key={r} className={view === r ? "row viewing" : "row"}>
                  <button
                    type="button"
                    className="row-btn"
                    onClick={() => setView(view === r ? -1 : r)}
                    aria-pressed={view === r}
                    aria-label={`Try ${r + 1}: ${guess.map((p, i) => `${pairName(p)} ${MARK_WORD[marks[i]]}`).join(", ")}. Show its decrypt.`}
                  >
                    {guess.map((p, i) => (
                      <Cable key={i} pair={p} mark={marks[i]} />
                    ))}
                  </button>
                </li>
              );
            }
            const active = r === guesses.length && !done;
            const pairs = active ? toPairs(draft) : [];
            const loose = active && draft.length % 2 ? draft.at(-1)! : null;
            return (
              <li key={r} className={active ? "row active" : "row"} aria-label={active ? `Plugged in now: ${draft.map(letter).join(" ") || "nothing"}` : undefined}>
                <span className="row-btn">
                  {Array.from({ length: CABLES }, (_, i) => (
                    <Cable key={i} pair={pairs[i]} loose={i === pairs.length ? loose : null} />
                  ))}
                </span>
              </li>
            );
          })}
        </ol>

        <p className="note" role="status">
          {note}
        </p>

        {!done && (
          <div className="console">
            <Machine
              windows={puzzle.key.positions}
              lit={null}
              onPress={press}
              lampClass={lampClass}
              lampLabel={lampLabel}
            />
            <div className="console-actions">
              <button type="button" className="ghost" onClick={back} disabled={!draft.length}>
                Unplug last
              </button>
              <button type="button" className="primary" onClick={submit}>
                Try these cables
              </button>
            </div>
            <ul className="legend" aria-label="Lamp key">
              <li>
                <span className="lamp key on" aria-hidden="true" /> plugged in now
              </li>
              <li>
                <span className="lamp key k-paired" aria-hidden="true" /> cable found
              </li>
              <li>
                <span className="lamp key k-maybe" aria-hidden="true" /> maybe in a cable
              </li>
              <li>
                <span className="lamp key k-free" aria-hidden="true" /> in no cable
              </li>
            </ul>
          </div>
        )}

        <Rules />
      </main>

      <footer className="foot">
        <p>
          A new intercept every day at midnight. Made by Arnav, with the same simulated Enigma I as the{" "}
          <a href="./">cracker</a>.
        </p>
      </footer>
    </>
  );
}

function Cable({ pair, mark, loose }: { pair?: Pair; mark?: Mark; loose?: number | null }) {
  const [a, b] = pair ? pair.map(letter) : [loose != null ? letter(loose) : "", ""];
  return (
    <span className={`cable${mark ? ` m-${mark}` : ""}${pair ? " full" : ""}`} aria-hidden="true">
      <span className="end">{a}</span>
      <span className="wire" />
      <span className="end">{b}</span>
    </span>
  );
}

function Result({ day, guesses, won, secret }: { day: number; guesses: Pair[][]; won: boolean; secret: Pair[] }) {
  const s = stats(day);
  const puzzle = puzzleFor(day);
  const share = shareText(puzzle, guesses, won);
  const [copied, setCopied] = useState("");
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(share);
      setCopied("Copied. Paste it anywhere.");
    } catch {
      setCopied("Couldn't reach the clipboard. Copy the squares above by hand.");
    }
  };
  const most = Math.max(1, ...s.spread);

  return (
    <section className="result" aria-labelledby="result-title">
      <h2 id="result-title">{won ? `Cracked in ${guesses.length}` : "The key got away"}</h2>
      {!won && (
        <>
          <p>
            Today's cables were <strong className="answer">{secret.map(pairName).sort().join(" ")}</strong>.
          </p>
          <Tape words text={withGaps(puzzle.text, puzzle.plaintext)} label="What it said" />
        </>
      )}
      <pre className="share">{share}</pre>
      <div className="actions">
        <button type="button" className="primary" onClick={copy}>
          Copy result
        </button>
        <span className="hint" role="status">
          {copied || <Countdown />}
        </span>
      </div>
      <dl className="tally">
        <div>
          <dt>Played</dt>
          <dd>{s.played}</dd>
        </div>
        <div>
          <dt>Won</dt>
          <dd>{s.played ? Math.round((100 * s.wins) / s.played) : 0}%</dd>
        </div>
        <div>
          <dt>Streak</dt>
          <dd>{s.streak}</dd>
        </div>
        <div>
          <dt>Best streak</dt>
          <dd>{s.best}</dd>
        </div>
      </dl>
      <ol className="spread" aria-label="Wins by number of tries">
        {s.spread.map((n, i) => (
          <li key={i} className={won && guesses.length === i + 1 ? "today" : undefined}>
            <span>{i + 1}</span>
            <span className="bar" style={{ "--w": `${(100 * n) / most}%` } as React.CSSProperties}>
              {n}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Countdown() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const secs = Math.max(0, Math.floor((midnight.getTime() - now.getTime()) / 1000));
  const hms = [secs / 3600, (secs / 60) % 60, secs % 60].map((n) => String(Math.floor(n)).padStart(2, "0")).join(":");
  return <>Next intercept in {hms}</>;
}

function Rules() {
  return (
    <section className="how" id="rules" aria-labelledby="rules-title">
      <h2 id="rules-title">How to play</h2>
      <p>
        Spies captured the rotors, rings and start letters for today's message. The plugboard is missing: five cables,
        each swapping two letters on the way into the machine and again on the way out.
      </p>
      <ol>
        <li>
          <h3>Read the garble</h3>
          <p>
            With no cables in, letters that no cable touches already come out right. A word like OKE where THE belongs
            hints that O and T share a cable, and so do K and H. The subject line is a free clue.
          </p>
        </li>
        <li>
          <h3>Plug in five cables</h3>
          <p>
            Press two letters to join them with a cable. Press a lit letter to pull its cable out. On a keyboard, type
            letters, Backspace to unplug and Enter to try.
          </p>
        </li>
        <li>
          <h3>Read the marks</h3>
          <p>
            <span className="cable m-green full inline">
              <span className="end">O</span>
              <span className="wire" />
              <span className="end">T</span>
            </span>{" "}
            means that cable is right.{" "}
            <span className="cable m-yellow full inline">
              <span className="end">A</span>
              <span className="wire" />
              <span className="end">K</span>
            </span>{" "}
            means one of its letters belongs in some cable.{" "}
            <span className="cable m-grey full inline">
              <span className="end">Q</span>
              <span className="wire" />
              <span className="end">Z</span>
            </span>{" "}
            means neither does. The message is read again through your cables, so the words firm up as you get closer.
            Tap an earlier try to read it again.
          </p>
        </li>
      </ol>
    </section>
  );
}
