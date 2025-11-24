'use client';

import { memo, lazy, Suspense, useRef, useEffect, useState } from 'react';

import { useLazyLoad, useConnectionAware, useVirtualizedData } from '@/hooks/use-performance';

import type { ComponentType, ReactNode} from 'react';

/** Lazy component wrapper with loading fallback */
export function lazyWithPreload<T extends ComponentType<unknown>>(
  importFn: () => Promise<{ default: T }>,
): T & { preload: () => Promise<{ default: T }> } {
  const LazyComponent = lazy(importFn) as T & { preload: () => Promise<{ default: T }> };
  LazyComponent.preload = importFn;
  return LazyComponent;
}

/** Loading skeleton */
export function Skeleton({
  className = '',
  width,
  height,
}: {
  className?: string;
  width?: string | number;
  height?: string | number;
}) {
  return (
    <div
      className={`animate-pulse bg-muted rounded ${className}`}
      style={{ width, height }}
      aria-hidden="true"
    />
  );
}

/** Loading spinner */
export function LoadingSpinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
  };

  return (
    <div
      className={`${sizeClasses[size]} animate-spin rounded-full border-2 border-muted border-t-primary`}
      role="status"
      aria-label="Loading"
    />
  );
}

/** Lazy loaded component */
export function LazyComponent<T extends HTMLElement = HTMLDivElement>({
  children,
  fallback = <Skeleton height={100} />,
  rootMargin = '50px',
  threshold = 0.1,
}: {
  children: ReactNode;
  fallback?: ReactNode;
  rootMargin?: string;
  threshold?: number;
}) {
  const { ref, isVisible } = useLazyLoad<T>(() => {}, { rootMargin, threshold });

  return (
    <div ref={ref as React.RefObject<HTMLDivElement>}>
      {isVisible ? children : fallback}
    </div>
  );
}

/** Lazy image with loading states */
export const LazyImage = memo(function LazyImage({
  src,
  alt,
  width,
  height,
  className = '',
  placeholder = 'blur',
  blurDataURL,
  priority = false,
  onLoad,
}: {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
  placeholder?: 'blur' | 'empty';
  blurDataURL?: string;
  priority?: boolean;
  onLoad?: () => void;
}) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (priority && imgRef.current) {
      const img = new Image();
      img.src = src;
    }
  }, [priority, src]);

  return (
    <div className={`relative overflow-hidden ${className}`} style={{ width, height }}>
      {!loaded && !error && placeholder === 'blur' && blurDataURL && (
        <img
          src={blurDataURL}
          alt=""
          className="absolute inset-0 w-full h-full object-cover filter blur-lg scale-110"
          aria-hidden="true"
        />
      )}
      {!loaded && !error && !blurDataURL && (
        <Skeleton className="absolute inset-0" />
      )}
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        width={width}
        height={height}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        className={`transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
        onLoad={() => {
          setLoaded(true);
          onLoad?.();
        }}
        onError={() => setError(true)}
      />
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted">
          <span className="text-muted-foreground text-sm">Failed to load</span>
        </div>
      )}
    </div>
  );
});

/** Connection-aware component */
export function ConnectionAware({
  children,
  fallback,
  renderOnSlowConnection,
}: {
  children: ReactNode;
  fallback?: ReactNode;
  renderOnSlowConnection?: ReactNode;
}) {
  const { isSlowConnection, reducedData } = useConnectionAware();

  if (reducedData && fallback) {
    return <>{fallback}</>;
  }

  if (isSlowConnection && renderOnSlowConnection) {
    return <>{renderOnSlowConnection}</>;
  }

  return <>{children}</>;
}

/** Virtualized list component */
export function VirtualizedList<T>({
  items,
  itemHeight,
  containerHeight,
  renderItem,
  overscan = 3,
  className = '',
}: {
  items: T[];
  itemHeight: number;
  containerHeight: number;
  renderItem: (item: T, index: number) => ReactNode;
  overscan?: number;
  className?: string;
}) {
  const { visibleItems, totalHeight, handleScroll } = useVirtualizedData(items, {
    itemHeight,
    containerHeight,
    overscan,
  });

  return (
    <div
      className={`overflow-auto ${className}`}
      style={{ height: containerHeight }}
      onScroll={handleScroll}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        {visibleItems.map(({ item, index, style }) => (
          <div key={index} style={style}>
            {renderItem(item, index)}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Suspense boundary with error handling */
export function SuspenseBoundary({
  children,
  fallback = <LoadingSpinner />,
}: {
  children: ReactNode;
  fallback?: ReactNode;
}) {
  return (
    <Suspense fallback={fallback}>
      {children}
    </Suspense>
  );
}

/** Reduced motion wrapper */
export function ReducedMotion({
  children,
  reducedChildren,
}: {
  children: ReactNode;
  reducedChildren: ReactNode;
}) {
  const { reducedMotion } = useConnectionAware();
  return <>{reducedMotion ? reducedChildren : children}</>;
}

/** Deferred content - loads after main content */
export function DeferredContent({
  children,
  delay = 0,
  fallback = null,
}: {
  children: ReactNode;
  delay?: number;
  fallback?: ReactNode;
}) {
  const [show, setShow] = useState(delay === 0);

  useEffect(() => {
    if (delay > 0) {
      const timeout = setTimeout(() => setShow(true), delay);
      return () => clearTimeout(timeout);
    }
  }, [delay]);

  return show ? <>{children}</> : <>{fallback}</>;
}

/** Progressive enhancement wrapper */
export function Progressive({
  ssr,
  client,
  enhanced,
}: {
  ssr: ReactNode;
  client: ReactNode;
  enhanced?: ReactNode;
}) {
  const [mounted, setMounted] = useState(false);
  const [jsEnabled, setJsEnabled] = useState(false);

  useEffect(() => {
    setMounted(true);
    setJsEnabled(true);
  }, []);

  if (!mounted) {
return <>{ssr}</>;
}
  if (!jsEnabled) {
return <>{client}</>;
}
  return <>{enhanced || client}</>;
}

/** Image with responsive srcset */
export const ResponsiveImage = memo(function ResponsiveImage({
  src,
  alt,
  sizes = '100vw',
  widths = [320, 640, 960, 1280, 1920],
  className = '',
}: {
  src: string;
  alt: string;
  sizes?: string;
  widths?: number[];
  className?: string;
}) {
  const srcSet = widths.map(w => `${src}?w=${w} ${w}w`).join(', ');

  return (
    <img
      src={`${src}?w=${widths[widths.length - 1]}`}
      srcSet={srcSet}
      sizes={sizes}
      alt={alt}
      loading="lazy"
      decoding="async"
      className={className}
    />
  );
});

/** Critical CSS inline */
export function CriticalCSS({ css }: { css: string }) {
  return (
    <style
      dangerouslySetInnerHTML={{ __html: css }}
      data-critical="true"
    />
  );
}
