"""Generate Enigma I test vectors with the independent py-enigma package."""
import json
import random
import sys

from enigma.machine import EnigmaMachine

ROTORS = ["I", "II", "III", "IV", "V"]
A = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
rng = random.Random(1942)
out = []
for i in range(30):
    rotors = rng.sample(ROTORS, 3)
    rings = [rng.randrange(26) for _ in range(3)]
    pos = "".join(rng.choice(A) for _ in range(3))
    refl = rng.choice(["B", "C"])
    letters = rng.sample(A, 26)
    plugs = [letters[2 * k] + letters[2 * k + 1] for k in range(rng.randrange(11))]
    text = "".join(rng.choice(A) for _ in range(700))
    m = EnigmaMachine.from_key_sheet(rotors=" ".join(rotors), reflector=refl,
                                     ring_settings=rings, plugboard_settings=" ".join(plugs))
    m.set_display(pos)
    out.append({
        "rotors": rotors, "rings": "".join(A[r] for r in rings), "positions": pos,
        "reflector": refl, "plugs": plugs, "plaintext": text, "ciphertext": m.process_text(text),
    })
json.dump(out, open(sys.argv[1], "w"), indent=1)
