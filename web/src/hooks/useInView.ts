import { useEffect, useRef, useState } from 'react';

export function useInView(options?: IntersectionObserverInit) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry?.isIntersecting) {
          setInView(true);
        }
      },
      { rootMargin: '60px', threshold: 0.06, ...options }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [options?.root, options?.rootMargin, options?.threshold]);

  return { ref, inView };
}
