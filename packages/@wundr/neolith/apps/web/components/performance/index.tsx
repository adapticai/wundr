'use client';

import { memo, lazy, Suspense, useRef, useEffect, useState } from 'react';

import {
  useLazyLoad,
  useConnectionAware,
  useVirtualizedData,
} from '@/hooks/use-performance';

import type { ComponentType, ReactNode } from 'react';

/**
 * Props for the Skeleton component
 */
export interface SkeletonProps {
  /** Optional CSS class name */
  className?: string;
  /** Width of the skeleton */
  width?: string | number;
  /** Height of the skeleton */
  height?: string | number;
}

/**
 * Props for the LoadingSpinner component
 */
export interface LoadingSpinnerProps {
  /** Size of the spinner */
  size?: 'sm' | 'md' | 'lg';
}

/**
 * Props for the LazyComponent component
 */
export interface LazyComponentProps {
  /** Children to render when visible */
  children: ReactNode;
  /** Fallback to show while not visible */
  fallback?: ReactNode;
  /** Root margin for intersection observer */
  rootMargin?: string;
  /** Visibility threshold (0-1) */
  threshold?: number;
}

/**
 * Props for the LazyImage component
 */
export interface LazyImageProps {
  /** Image source URL */
  src: string;
  /** Alt text for accessibility */
  alt: string;
  /** Image width */
  width?: number;
  /** Image height */
  height?: number;
  /** Optional CSS class name */
  className?: string;
  /** Placeholder type */
  placeholder?: 'blur' | 'empty';
  /** Base64 blur data URL */
  blurDataURL?: string;
  /** Whether to prioritize loading */
  priority?: boolean;
  /** Callback when image loads */
  onLoad?: () => void;
}

/**
 * Props for the ConnectionAware component
 */
export interface ConnectionAwareProps {
  /** Children to render on good connection */
  children: ReactNode;
  /** Fallback for data saver mode */
  fallback?: ReactNode;
  /** Content for slow connections */
  renderOnSlowConnection?: ReactNode;
}

/**
 * Props for the VirtualizedList component
 */
export interface VirtualizedListProps<T> {
  /** Items to render */
  items: T[];
  /** Height of each item in pixels */
  itemHeight: number;
  /** Height of the container in pixels */
  containerHeight: number;
  /** Render function for each item */
  renderItem: (item: T, index: number) => ReactNode;
  /** Number of items to render outside visible area */
  overscan?: number;
  /** Optional CSS class name */
  className?: string;
}

/**
 * Props for the SuspenseBoundary component
 */
export interface SuspenseBoundaryProps {
  /** Children to render */
  children: ReactNode;
  /** Fallback while loading */
  fallback?: ReactNode;
}

/**
 * Props for the ReducedMotion component
 */
export interface ReducedMotionProps {
  /** Children for full motion */
  children: ReactNode;
  /** Children for reduced motion */
  reducedChildren: ReactNode;
}

/**
 * Props for the DeferredContent component
 */
export interface DeferredContentProps {
  /** Children to render after delay */
  children: ReactNode;
  /** Delay in milliseconds */
  delay?: number;
  /** Fallback while waiting */
  fallback?: ReactNode;
}

/**
 * Props for the Progressive component
 */
export interface ProgressiveProps {
  /** SSR content */
  ssr: ReactNode;
  /** Client-rendered content */
  client: ReactNode;
  /** Enhanced content with JS */
  enhanced?: ReactNode;
}

/**
 * Props for the ResponsiveImage component
 */
export interface ResponsiveImageProps {
  /** Image source URL */
  src: string;
  /** Alt text for accessibility */
  alt: string;
  /** Sizes attribute for responsive images */
  sizes?: string;
  /** Array of widths for srcset */
  widths?: number[];
  /** Optional CSS class name */
  className?: string;
}

/**
 * Props for the CriticalCSS component
 */
export interface CriticalCSSProps {
  /** Critical CSS content */
  css: string;
}

/**
 * Lazy component with preload capability
 */
type LazyWithPreload<T extends ComponentType<Record<string, unknown>>> =
  React.LazyExoticComponent<T> & {
    preload: () => Promise<{ default: T }>;
  };

/**
 * Lazy component wrapper with loading fallback and preload capability
 * @param importFn - Dynamic import function for the component
 * @returns Lazy component with preload method
 */
export function lazyWithPreload<
  T extends ComponentType<Record<string, unknown>>,
>(importFn: () => Promise<{ default: T }>): LazyWithPreload<T> {
  const LazyComponent = lazy(importFn) as LazyWithPreload<T>;
  LazyComponent.preload = importFn;
  return LazyComponent;
}

/**
 * Loading skeleton placeholder for content
 */
export function Skeleton({ className = '', width, height }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse bg-muted rounded ${className}`}
      style={{ width, height }}
      aria-hidden='true'
    />
  );
}

/**
 * Animated loading spinner indicator
 */
export function LoadingSpinner({ size = 'md' }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
  };

  return (
    <div
      className={`${sizeClasses[size]} animate-spin rounded-full border-2 border-muted border-t-primary`}
      role='status'
      aria-label='Loading'
    />
  );
}

/**
 * Lazy loaded component that renders when visible in viewport
 */
export function LazyComponent({
  children,
  fallback = <Skeleton height={100} />,
  rootMargin = '50px',
  threshold = 0.1,
}: LazyComponentProps) {
  const { ref, isVisible } = useLazyLoad<HTMLDivElement>(() => {}, {
    rootMargin,
    threshold,
  });

  return <div ref={ref}>{isVisible ? children : fallback}</div>;
}

/**
 * Lazy image with loading states and blur placeholder support
 */
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
}: LazyImageProps) {
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
    <div
      className={`relative overflow-hidden ${className}`}
      style={{ width, height }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {!loaded && !error && placeholder === 'blur' && blurDataURL && (
        <img
          src={blurDataURL}
          alt=''
          className='absolute inset-0 w-full h-full object-cover filter blur-lg scale-110'
          aria-hidden='true'
        />
      )}
      {!loaded && !error && !blurDataURL && (
        <Skeleton className='absolute inset-0' />
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        width={width}
        height={height}
        loading={priority ? 'eager' : 'lazy'}
        decoding='async'
        className={`transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
        onLoad={() => {
          setLoaded(true);
          onLoad?.();
        }}
        onError={() => setError(true)}
      />
      {error && (
        <div className='absolute inset-0 flex items-center justify-center bg-muted'>
          <span className='text-muted-foreground text-sm'>Failed to load</span>
        </div>
      )}
    </div>
  );
});

/**
 * Connection-aware component that adapts to network conditions
 */
export function ConnectionAware({
  children,
  fallback,
  renderOnSlowConnection,
}: ConnectionAwareProps) {
  const { isSlowConnection, reducedData } = useConnectionAware();

  if (reducedData && fallback) {
    return <>{fallback}</>;
  }

  if (isSlowConnection && renderOnSlowConnection) {
    return <>{renderOnSlowConnection}</>;
  }

  return <>{children}</>;
}

/**
 * Virtualized list component for rendering large lists efficiently
 */
export function VirtualizedList<T>({
  items,
  itemHeight,
  containerHeight,
  renderItem,
  overscan = 3,
  className = '',
}: VirtualizedListProps<T>) {
  const { visibleItems, totalHeight, handleScroll } = useVirtualizedData(
    items,
    {
      itemHeight,
      containerHeight,
      overscan,
    },
  );

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

/**
 * Suspense boundary with configurable fallback
 */
export function SuspenseBoundary({
  children,
  fallback = <LoadingSpinner />,
}: SuspenseBoundaryProps) {
  return <Suspense fallback={fallback}>{children}</Suspense>;
}

/**
 * Reduced motion wrapper that respects user preferences
 */
export function ReducedMotion({
  children,
  reducedChildren,
}: ReducedMotionProps) {
  const { reducedMotion } = useConnectionAware();
  return <>{reducedMotion ? reducedChildren : children}</>;
}

/**
 * Deferred content - loads after main content with optional delay
 */
export function DeferredContent({
  children,
  delay = 0,
  fallback = null,
}: DeferredContentProps) {
  const [show, setShow] = useState(delay === 0);

  useEffect(() => {
    if (delay > 0) {
      const timeout = setTimeout(() => setShow(true), delay);
      return () => clearTimeout(timeout);
    }
  }, [delay]);

  return show ? <>{children}</> : <>{fallback}</>;
}

/**
 * Progressive enhancement wrapper for SSR, client, and enhanced content
 */
export function Progressive({ ssr, client, enhanced }: ProgressiveProps) {
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

/**
 * Image with responsive srcset for multiple screen sizes
 */
export const ResponsiveImage = memo(function ResponsiveImage({
  src,
  alt,
  sizes = '100vw',
  widths = [320, 640, 960, 1280, 1920],
  className = '',
}: ResponsiveImageProps) {
  const srcSet = widths.map(w => `${src}?w=${w} ${w}w`).join(', ');

  // eslint-disable-next-line @next/next/no-img-element
  return (
    <img
      src={`${src}?w=${widths[widths.length - 1]}`}
      srcSet={srcSet}
      sizes={sizes}
      alt={alt}
      loading='lazy'
      decoding='async'
      className={className}
    />
  );
});

/**
 * Inline critical CSS for above-the-fold rendering
 */
export function CriticalCSS({ css }: CriticalCSSProps) {
  return (
    <style dangerouslySetInnerHTML={{ __html: css }} data-critical='true' />
  );
}
