'use client';

import { useEffect, useRef } from 'react';

import { cn } from '@/lib/utils';

export interface VoiceVisualizerProps {
  audioLevel: number;
  isActive?: boolean;
  className?: string;
  barCount?: number;
  color?: string;
  variant?: 'bars' | 'wave' | 'circle';
}

export function VoiceVisualizer({
  audioLevel,
  isActive = true,
  className,
  barCount = 40,
  color = 'hsl(var(--primary))',
  variant = 'bars',
}: VoiceVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const barsRef = useRef<number[]>(new Array(barCount).fill(0));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    const updateSize = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * window.devicePixelRatio;
      canvas.height = rect.height * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };

    updateSize();
    window.addEventListener('resize', updateSize);

    // Animation loop
    const animate = () => {
      const rect = canvas.getBoundingClientRect();
      ctx.clearRect(0, 0, rect.width, rect.height);

      if (variant === 'bars') {
        drawBars(ctx, rect.width, rect.height, audioLevel, isActive);
      } else if (variant === 'wave') {
        drawWave(ctx, rect.width, rect.height, audioLevel, isActive);
      } else if (variant === 'circle') {
        drawCircle(ctx, rect.width, rect.height, audioLevel, isActive);
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', updateSize);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [audioLevel, isActive, variant, barCount, color]);

  // Draw bars visualization
  const drawBars = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    level: number,
    active: boolean
  ) => {
    const bars = barsRef.current;
    const barWidth = width / bars.length;
    const maxHeight = height * 0.8;

    // Update bars with smooth interpolation
    for (let i = 0; i < bars.length; i++) {
      const targetHeight = active
        ? (Math.random() * 0.4 + level * 0.6) * maxHeight
        : 0;

      bars[i] += (targetHeight - bars[i]) * 0.2;
    }

    // Draw bars
    ctx.fillStyle = color;
    bars.forEach((barHeight, i) => {
      const x = i * barWidth;
      const y = height - barHeight;
      const roundedBarWidth = Math.max(barWidth - 2, 1);

      // Draw rounded rectangle
      ctx.beginPath();
      ctx.roundRect(x, y, roundedBarWidth, barHeight, 2);
      ctx.fill();
    });
  };

  // Draw wave visualization
  const drawWave = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    level: number,
    active: boolean
  ) => {
    const centerY = height / 2;
    const amplitude = active ? level * (height * 0.4) : 0;
    const frequency = 0.02;
    const time = Date.now() * 0.002;

    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();

    for (let x = 0; x < width; x += 2) {
      const y =
        centerY +
        Math.sin(x * frequency + time) * amplitude +
        Math.sin(x * frequency * 2 + time * 1.5) * (amplitude * 0.5);

      if (x === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }

    ctx.stroke();

    // Draw mirror wave
    ctx.beginPath();
    for (let x = 0; x < width; x += 2) {
      const y =
        centerY -
        Math.sin(x * frequency + time) * amplitude -
        Math.sin(x * frequency * 2 + time * 1.5) * (amplitude * 0.5);

      if (x === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }

    ctx.stroke();
  };

  // Draw circle visualization
  const drawCircle = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    level: number,
    active: boolean
  ) => {
    const centerX = width / 2;
    const centerY = height / 2;
    const baseRadius = Math.min(width, height) * 0.2;
    const maxRadius = Math.min(width, height) * 0.4;
    const radius = active
      ? baseRadius + level * (maxRadius - baseRadius)
      : baseRadius;

    // Draw pulsing circles
    const circles = 3;
    for (let i = 0; i < circles; i++) {
      const alpha = active ? (1 - i / circles) * level : 0.1;
      const circleRadius = radius + i * 10;

      ctx.strokeStyle = color
        .replace(')', `, ${alpha})`)
        .replace('hsl(', 'hsla(');
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(centerX, centerY, circleRadius, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Draw center dot
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(centerX, centerY, 4, 0, Math.PI * 2);
    ctx.fill();
  };

  return (
    <canvas
      ref={canvasRef}
      className={cn(
        'w-full rounded-md bg-muted/30',
        !isActive && 'opacity-50',
        className
      )}
    />
  );
}
