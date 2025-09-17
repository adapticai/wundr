'use client';

import React, { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { Bar } from 'react-chartjs-2';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { EntityData } from '@/app/api/analysis/entities/route';
import type { TooltipItem } from 'chart.js';

interface ComplexityMetricsProps {
  entities: EntityData[];
}

export function ComplexityMetrics({ entities }: ComplexityMetricsProps) {
  const { theme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted && (theme === 'dark' || resolvedTheme === 'dark');

  // Calculate complexity distribution
  const complexityBuckets = entities.reduce((acc, entity) => {
    const complexity = entity.complexity || 0;
    const bucket =
      complexity === 0
        ? 'Unknown'
        : complexity <= 5
        ? 'Low (1-5)'
        : complexity <= 10
        ? 'Medium (6-10)'
        : complexity <= 15
        ? 'High (11-15)'
        : complexity <= 25
        ? 'Very High (16-25)'
        : 'Extreme (25+)';

    acc[bucket] = (acc[bucket] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Calculate statistics
  const entitiesWithComplexity = entities.filter(
    e => e.complexity && e.complexity > 0
  );
  const avgComplexity =
    entitiesWithComplexity.length > 0
      ? entitiesWithComplexity.reduce(
          (sum, e) => sum + (e.complexity || 0),
          0
        ) / entitiesWithComplexity.length
      : 0;

  const maxComplexity = Math.max(...entities.map(e => e.complexity || 0));
  const highComplexityCount = entities.filter(
    e => (e.complexity || 0) > 15
  ).length;

  const bucketOrder = [
    'Unknown',
    'Low (1-5)',
    'Medium (6-10)',
    'High (11-15)',
    'Very High (16-25)',
    'Extreme (25+)',
  ];
  const labels = bucketOrder.filter(bucket => complexityBuckets[bucket] > 0);
  const data = labels.map(bucket => complexityBuckets[bucket]);

  const getColorForComplexity = (bucket: string) => {
    switch (bucket) {
      case 'Unknown':
        return isDark ? '#6B7280' : '#9CA3AF';
      case 'Low (1-5)':
        return isDark ? '#10B981' : '#059669';
      case 'Medium (6-10)':
        return isDark ? '#F59E0B' : '#D97706';
      case 'High (11-15)':
        return isDark ? '#F97316' : '#EA580C';
      case 'Very High (16-25)':
        return isDark ? '#EF4444' : '#DC2626';
      case 'Extreme (25+)':
        return isDark ? '#991B1B' : '#7F1D1D';
      default:
        return isDark ? '#5584A9' : '#3D6A91';
    }
  };

  const chartData = {
    labels,
    datasets: [
      {
        label: 'Number of Entities',
        data,
        backgroundColor: labels.map(getColorForComplexity),
        borderColor: labels.map(getColorForComplexity),
        borderWidth: 1,
        borderRadius: 4,
        borderSkipped: false,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    animation: mounted
      ? {
          duration: 750,
          easing: 'easeInOutQuart' as const,
        }
      : false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        callbacks: {
          title: function (context: TooltipItem<'bar'>[]) {
            return `Complexity: ${context[0].label}`;
          },
          label: function (context: TooltipItem<'bar'>) {
            const value = context.parsed.y;
            const total = entities.length;
            const percentage = ((value / total) * 100).toFixed(1);
            return `${value} entities (${percentage}%)`;
          },
        },
      },
    },
    scales: {
      x: {
        grid: {
          display: false,
        },
        ticks: {
          color: isDark ? '#E8EEF3' : '#0E1A24',
          font: {
            size: 11,
          },
        },
      },
      y: {
        beginAtZero: true,
        grid: {
          color: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
        },
        ticks: {
          color: isDark ? '#E8EEF3' : '#0E1A24',
          stepSize: 1,
        },
      },
    },
  } as const;

  if (!mounted) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Complexity Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <div className='h-[300px] bg-muted animate-pulse rounded' />
        </CardContent>
      </Card>
    );
  }

  if (entities.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Complexity Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <div className='h-[300px] flex items-center justify-center text-muted-foreground'>
            No entities to display
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Complexity Distribution</CardTitle>
        <p className='text-sm text-muted-foreground'>
          Cyclomatic complexity analysis of {entities.length} entities
        </p>
      </CardHeader>
      <CardContent>
        <div className='h-[300px] mb-4'>
          <Bar data={chartData} options={chartOptions} />
        </div>

        {/* Complexity Statistics */}
        <div className='grid grid-cols-2 md:grid-cols-4 gap-4 text-sm'>
          <div className='text-center'>
            <div className='text-lg font-semibold'>
              {avgComplexity.toFixed(1)}
            </div>
            <div className='text-muted-foreground'>Average</div>
          </div>
          <div className='text-center'>
            <div className='text-lg font-semibold'>{maxComplexity}</div>
            <div className='text-muted-foreground'>Maximum</div>
          </div>
          <div className='text-center'>
            <div className='text-lg font-semibold'>{highComplexityCount}</div>
            <div className='text-muted-foreground'>High (&gt; 15)</div>
          </div>
          <div className='text-center'>
            <div className='text-lg font-semibold'>
              {entitiesWithComplexity.length}
            </div>
            <div className='text-muted-foreground'>Measured</div>
          </div>
        </div>

        {/* Complexity Legend */}
        <div className='mt-4 flex flex-wrap gap-2'>
          {labels.map(label => (
            <Badge
              key={label}
              variant='secondary'
              className='flex items-center gap-1'
              style={{
                backgroundColor: `${getColorForComplexity(label)}20`,
                color: getColorForComplexity(label),
                borderColor: getColorForComplexity(label),
              }}
            >
              <div
                className='w-2 h-2 rounded-full'
                style={{ backgroundColor: getColorForComplexity(label) }}
              />
              {label}: {complexityBuckets[label]}
            </Badge>
          ))}
        </div>

        {highComplexityCount > 0 && (
          <div className='mt-4 p-3 bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800 rounded-lg'>
            <div className='text-sm font-medium text-orange-800 dark:text-orange-200'>
              ⚠️ High Complexity Warning
            </div>
            <div className='text-sm text-orange-700 dark:text-orange-300 mt-1'>
              {highComplexityCount} entities have complexity {'>'} 15. Consider
              refactoring to improve maintainability.
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
