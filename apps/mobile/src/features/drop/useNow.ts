import { useEffect, useState } from 'react';

/** The current time, refreshed every `everyMs` (for countdowns and "this week" boundaries on a screen left open). */
export function useNow(everyMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), everyMs);
    return () => clearInterval(id);
  }, [everyMs]);
  return now;
}
