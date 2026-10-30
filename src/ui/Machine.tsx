import { ALPHABET } from "../enigma/wiring";

// The real Enigma lampboard is laid out like a German typewriter.
const ROWS = ["QWERTZUIO", "ASDFGHJK", "PYXCVBNML"];

/** Rotor windows and lampboard. `lit` is the lamp currently glowing, if any. */
export function Machine({ windows, lit }: { windows: number[]; lit: string | null }) {
  return (
    <div className="machine" aria-label="Enigma lampboard">
      <div className="windows" aria-label={`Rotor windows show ${windows.map((w) => ALPHABET[w]).join(" ")}`}>
        {windows.map((w, i) => (
          <div className="window" key={i}>
            <span className="wheel" key={w}>
              <span>{ALPHABET[(w + 25) % 26]}</span>
              <span>{ALPHABET[w]}</span>
              <span>{ALPHABET[(w + 1) % 26]}</span>
            </span>
          </div>
        ))}
      </div>
      <div className="lamps" aria-live="off">
        {ROWS.map((row) => (
          <div className="lamp-row" key={row}>
            {Array.from(row, (ch) => (
              <span className={ch === lit ? "lamp on" : "lamp"} key={ch}>
                {ch}
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
