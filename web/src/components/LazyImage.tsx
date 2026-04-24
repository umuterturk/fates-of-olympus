import { clsx } from 'clsx';
import type { ImgHTMLAttributes } from 'react';

type LazyImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, 'loading' | 'decoding'> & {
  src: string;
  alt: string;
  width: number;
  height: number;
  /** CSS background while loading */
  placeholderColor?: string;
  eager?: boolean;
};

export function LazyImage({
  className,
  placeholderColor = '#1a1a24',
  eager,
  width,
  height,
  alt,
  src,
  ...rest
}: LazyImageProps) {
  return (
    <span
      className={clsx('relative block overflow-hidden rounded-lg', className)}
      style={{
        aspectRatio: `${width} / ${height}`,
        backgroundColor: placeholderColor,
      }}
    >
      <img
        src={src}
        alt={alt}
        width={width}
        height={height}
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        fetchPriority={eager ? 'high' : 'low'}
        className="absolute inset-0 h-full w-full object-cover"
        {...rest}
      />
    </span>
  );
}
