import { useState, useEffect } from 'react';

/**
 * Evita "flash" do skeleton: só considera loading visível após um delay.
 * showSkeleton = isLoading && delayPassed
 * @param isLoading - estado de carregamento
 * @param delayMs - atraso em ms antes de mostrar skeleton (ex: 200)
 */
export function useDelayedLoading(isLoading: boolean, delayMs: number): boolean {
  const [delayPassed, setDelayPassed] = useState(false);

  useEffect(() => {
    if (!isLoading) {
      setDelayPassed(false);
      return;
    }
    const t = setTimeout(() => setDelayPassed(true), delayMs);
    return () => clearTimeout(t);
  }, [isLoading, delayMs]);

  return isLoading && delayPassed;
}
