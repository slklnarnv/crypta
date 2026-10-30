import type { Progress } from "../crack/cracker";
import { ROTOR_ORDERS } from "../crack/solver";
import { describeKey, encrypt, type Key } from "../enigma/machine";
import { ROTOR_NAMES } from "../enigma/wiring";
import { Tape } from "./Tape";

const fmt = (n: number) => n.toLocaleString("en-GB");

function headline(p: Progress) {
  switch (p.phase) {
    case "screening":
      return "Trying every rotor setting";
    case "climbing":
      return "Rewiring the plugboard";
    case "solved":
      return `Cracked in ${p.seconds.toFixed(1)} seconds`;
    case "failed":
      return "Not cracked";
  }
}

export function CrackView({ progress, ciphertext, actual }: { progress: Progress; ciphertext: string; actual: Key }) {
  const { phase, best } = progress;
  const solved = phase === "solved" && best;
  const full = solved ? encrypt(best.key, ciphertext) : (best?.text ?? "");
  const e = Math.round((best?.englishness ?? 0) * 100);

  return (
    <div className={`crack ${phase}`}>
      <p className="status" role="status">
        {headline(progress)}
      </p>

      <div className="orders" aria-hidden="true">
        {ROTOR_ORDERS.map((o, i) => (
          <span key={i} className={progress.orders[i] ? "order done" : "order"} title={o.map((r) => ROTOR_NAMES[r]).join(" ")} />
        ))}
      </div>
      <dl className="stats">
        <div>
          <dt>Rotor settings tried</dt>
          <dd>
            {fmt(progress.tested)} <small>of {fmt(progress.total)}</small>
          </dd>
        </div>
        <div>
          <dt>Plugboards searched</dt>
          <dd>{phase === "screening" ? "waiting" : fmt(progress.climbed)}</dd>
        </div>
        <div>
          <dt>Looks like English</dt>
          <dd>
            <span className="meter" style={{ "--e": `${e}%` } as React.CSSProperties} />
            {e}%
          </dd>
        </div>
      </dl>

      <Tape text={full} label={solved ? "Decrypted message" : "Best guess so far"} />

      {phase === "failed" && (
        <p className="hint">
          After {progress.seconds.toFixed(0)} seconds nothing read like English. Try a longer message or fewer plugboard
          cables, then crack again.
        </p>
      )}
      {solved && <KeyCompare actual={actual} found={best.key} />}
    </div>
  );
}

function KeyCompare({ actual, found }: { actual: Key; found: Key }) {
  const a = describeKey(actual);
  const f = describeKey(found);
  const rows: [string, string, string][] = [
    ["Rotors", a.rotors, f.rotors],
    ["Rings", a.rings, f.rings],
    ["Start", a.positions, f.positions],
    ["Plugboard", a.plugs || "none", f.plugs || "none"],
  ];
  return (
    <div className="compare">
      <table>
        <thead>
          <tr>
            <th />
            <th scope="col">Secret key</th>
            <th scope="col">Recovered</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([name, x, y]) => (
            <tr key={name} className={x === y ? "same" : "differs"}>
              <th scope="row">{name}</th>
              <td>{x}</td>
              <td>{y}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="footnote">
        Rings and start letters can differ and still decrypt the same text. The left ring only relabels its window,
        and the middle ring matters only when the left rotor turns, so the text alone can't tell them apart.
      </p>
    </div>
  );
}
