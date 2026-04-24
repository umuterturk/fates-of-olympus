import { LanguageSelector } from '@/components/LanguageSelector';

export function Header() {
  return (
    <header className="absolute inset-x-0 top-0 z-30">
      <div className="flex items-center justify-end px-4 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <LanguageSelector />
      </div>
    </header>
  );
}
