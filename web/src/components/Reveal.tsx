import { clsx } from 'clsx';
import type { CSSProperties, ReactNode } from 'react';
import { useInView } from '@/hooks/useInView';

type RevealProps = {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
};

export function Reveal({ children, className, style }: RevealProps) {
  const { ref, inView } = useInView();

  return (
    <div
      ref={ref}
      data-visible={inView}
      className={clsx('reveal', className)}
      style={style}
    >
      {children}
    </div>
  );
}
