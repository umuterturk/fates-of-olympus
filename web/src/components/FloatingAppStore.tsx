import { clsx } from 'clsx';
import { useCallback, useEffect, useState } from 'react';

export function FloatingAppStore() {
  const [visible, setVisible] = useState(false);

  const onScroll = useCallback(() => {
    const hero = document.getElementById('hero');
    const threshold = hero ? hero.offsetHeight * 0.7 : window.innerHeight * 0.6;
    setVisible(window.scrollY > threshold);
  }, []);

  useEffect(() => {
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [onScroll]);

  return (
    <div
      className={clsx(
        'fixed inset-x-0 bottom-0 z-50 flex justify-center px-4',
        'pb-[max(0.75rem,env(safe-area-inset-bottom))] transition-all duration-300',
        visible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0 pointer-events-none'
      )}
      aria-hidden={!visible}
    >
      <a
        href="https://apps.apple.com"
        target="_blank"
        rel="noopener noreferrer"
        tabIndex={visible ? 0 : -1}
        className={clsx(
          'rounded-2xl bg-storm/95 p-2.5 shadow-2xl backdrop-blur-md',
          'border border-white/15 transition-transform active:scale-95'
        )}
      >
        <img
          src="/app-store-badge.svg"
          alt="Download on the App Store"
          width={135}
          height={40}
          className="h-[40px] w-auto"
        />
      </a>
    </div>
  );
}
