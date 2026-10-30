/**
 * A strip of paper tape printing letters in groups of five, the way Enigma traffic
 * was written down. Letters that change between renders flicker as they land.
 */
export function Tape({ text, label, empty }: { text: string; label: string; empty?: string }) {
  const groups: string[] = [];
  for (let i = 0; i < text.length; i += 5) groups.push(text.slice(i, i + 5));
  return (
    <figure className="tape" aria-label={label}>
      <figcaption>{label}</figcaption>
      {text ? (
        <p className="tape-text">
          {groups.map((g, gi) => (
            <span className="group" key={gi}>
              {Array.from(g, (ch, i) => (
                // Keying on the letter remounts it when it changes, which replays the flicker.
                <span className="ch" key={`${i}${ch}`}>
                  {ch}
                </span>
              ))}
            </span>
          ))}
        </p>
      ) : (
        <p className="tape-empty">{empty}</p>
      )}
    </figure>
  );
}
