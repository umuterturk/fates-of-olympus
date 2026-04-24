import { useEffect, useRef, useState } from 'react';

/** Subtle translateY (px) based on how centered the block is in the viewport */
export function useParallaxY(maxShift = 14) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [shift, setShift] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const onScroll = () => {
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight || 1;
      const visible = Math.min(Math.max((vh - rect.top) / (vh + rect.height), 0), 1);
      setShift((visible - 0.5) * 2 * maxShift);
    };

    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [maxShift]);

  return { ref, shift };
}
