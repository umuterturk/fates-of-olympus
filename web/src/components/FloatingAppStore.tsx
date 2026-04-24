import { clsx } from 'clsx';

export function FloatingAppStore() {
  return (
    <div
      className={clsx(
        'fixed inset-x-0 bottom-0 z-50 flex justify-center px-4',
        'pb-[max(1rem,env(safe-area-inset-bottom))]'
      )}
    >
      <a
        href="https://apps.apple.com"
        target="_blank"
        rel="noopener noreferrer"
        className="transition-transform active:scale-95 drop-shadow-2xl"
        aria-label="Download on the App Store"
      >
        <img
          src="/app-store-badge.svg"
          alt="Download on the App Store"
          width={405}
          height={120}
          className="h-[min(28vw,112px)] w-auto sm:h-[120px]"
        />
      </a>
    </div>
  );
}
