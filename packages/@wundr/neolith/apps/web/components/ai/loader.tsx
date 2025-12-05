'use client';

import * as React from 'react';

import { cn } from '@/lib/utils';

interface LoaderProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: number;
  variant?: 'spinner' | 'dots' | 'pulse';
}

export function Loader({
  size = 16,
  variant = 'spinner',
  className,
  ...props
}: LoaderProps) {
  return (
    <div
      role='status'
      aria-label='Loading'
      className={cn('inline-flex items-center justify-center', className)}
      {...props}
    >
      {variant === 'spinner' && <SpinnerLoader size={size} />}
      {variant === 'dots' && <DotsLoader size={size} />}
      {variant === 'pulse' && <PulseLoader size={size} />}
      <span className='sr-only'>Loading...</span>
    </div>
  );
}

function SpinnerLoader({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
      className='animate-spin'
    >
      <path d='M21 12a9 9 0 1 1-6.219-8.56' />
    </svg>
  );
}

function DotsLoader({ size }: { size: number }) {
  const dotSize = size / 4;

  return (
    <div className='flex items-center gap-1'>
      {[0, 1, 2].map(i => (
        <div
          key={i}
          className='rounded-full bg-current animate-bounce'
          style={{
            width: dotSize,
            height: dotSize,
            animationDelay: `${i * 0.15}s`,
          }}
        />
      ))}
    </div>
  );
}

function PulseLoader({ size }: { size: number }) {
  return (
    <div
      className='rounded-full bg-current animate-pulse'
      style={{ width: size, height: size }}
    />
  );
}

// Typing indicator for chat
export function TypingIndicator({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('flex items-center gap-1 text-muted-foreground', className)}
      role='status'
      aria-label='AI is typing'
      {...props}
    >
      <Loader variant='dots' size={16} />
      <span className='text-sm'>Thinking...</span>
    </div>
  );
}

// Streaming indicator
export function StreamingIndicator({
  className,
  label = 'Generating...',
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { label?: string }) {
  return (
    <div
      className={cn('flex items-center gap-2 text-muted-foreground', className)}
      role='status'
      {...props}
    >
      <Loader variant='spinner' size={14} />
      <span className='text-sm'>{label}</span>
    </div>
  );
}

// Full-page loading state
export function FullPageLoader({
  message = 'Loading...',
  className,
}: {
  message?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-4 py-12',
        className,
      )}
    >
      <Loader size={32} variant='spinner' />
      <p className='text-sm text-muted-foreground'>{message}</p>
    </div>
  );
}

// AI-specific loading states
export function AIThinkingLoader() {
  return (
    <div className='flex items-center gap-3 p-4 rounded-lg bg-muted/50'>
      <div className='relative'>
        <Loader size={20} variant='spinner' className='text-primary' />
      </div>
      <div className='flex flex-col'>
        <span className='text-sm font-medium'>AI is thinking...</span>
        <span className='text-xs text-muted-foreground'>
          Analyzing your request
        </span>
      </div>
    </div>
  );
}
