import { useCallback, useEffect, useRef, useState } from "react";
import type { Progress } from "../crack/cracker";

/**
 * The cracker can improve its guess many times in a few milliseconds. Play the
 * guesses back no faster than one every `ms` so each step is visible; updates
 * that don't change the text are merged so the numbers stay current.
 */
export function usePaced(ms: number) {
  const [shown, setShown] = useState<Progress | null>(null);
  const queue = useRef<Progress[]>([]);

  const push = useCallback(
    (p: Progress) => {
      if (ms === 0) setShown(p);
      else queue.current.push(p);
    },
    [ms],
  );
  const clear = useCallback(() => {
    queue.current = [];
    setShown(null);
  }, []);

  useEffect(() => {
    if (ms === 0) return;
    const timer = setInterval(() => {
      const q = queue.current;
      if (!q.length) return;
      let next = q.shift()!;
      while (q.length && q[0].best?.text === next.best?.text) next = q.shift()!;
      setShown(next);
    }, ms);
    return () => clearInterval(timer);
  }, [ms]);

  return { shown, push, clear };
}
