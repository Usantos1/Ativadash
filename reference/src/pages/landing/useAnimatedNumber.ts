import { useEffect, useState } from 'react';

/**
 * Animação de contador (0 → target) para efeito "dashboard ao vivo".
 */
export function useAnimatedNumber(
  target: number,
  durationMs = 1800,
  enabled = true,
  decimals = 0
): number {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!enabled) {
      setValue(target);
      return;
    }
    setValue(0);
    const start = performance.now();
    const step = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / durationMs, 1);
      // Ease out quad para terminar suave
      const eased = 1 - (1 - progress) * (1 - progress);
      const current = target * eased;
      setValue(decimals > 0 ? Number(current.toFixed(decimals)) : Math.round(current));
      if (progress < 1) requestAnimationFrame(step);
    };
    const id = requestAnimationFrame(step);
    return () => cancelAnimationFrame(id);
  }, [target, durationMs, enabled, decimals]);

  return value;
}
