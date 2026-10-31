import { ALPHABET } from "../enigma/wiring";

// The real Enigma lampboard is laid out like a German typewriter.
const ROWS = ["QWERTZUIO", "ASDFGHJK", "PYXCVBNML"];

interface Props {
  windows: number[];
  lit: string | null;
  /** Makes the lamps pressable keys, for the daily puzzle. */
  onPress?: (ch: string) => void;
  lampClass?: (ch: string) => string;
  lampLabel?: (ch: string) => string;
}

/** Rotor windows and lampboard. `lit` is the lamp currently glowing, if any. */
export function Machine({ windows, lit, onPress, lampClass, lampLabel }: Props) {
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
            {Array.from(row, (ch) => {
              const cls = `lamp${ch === lit ? " on" : ""}${lampClass ? ` ${lampClass(ch)}` : ""}`;
              return onPress ? (
                <button type="button" className={cls} key={ch} data-lamp onClick={() => onPress(ch)} aria-label={lampLabel?.(ch)}>
                  {ch}
                </button>
              ) : (
                <span className={cls} key={ch}>
                  {ch}
                </span>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
