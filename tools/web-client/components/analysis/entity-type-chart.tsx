'use client';

import React, { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { Doughnut } from 'react-chartjs-2';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { EntityData } from '@/app/api/analysis/entities/route';
import type { ChartContext } from '@/types/analysis';

interface EntityTypeChartProps {
  entities: EntityData[];
}

export function EntityTypeChart({ entities }: EntityTypeChartProps) {
  const { theme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted && (theme === 'dark' || resolvedTheme === 'dark');

  // Count entities by type
  const typeCounts = entities.reduce((acc, entity) => {
    acc[entity.type] = (acc[entity.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const labels = Object.keys(typeCounts);
  const data = Object.values(typeCounts);

  const chartColors = isDark ? [
    '#E8EEF3',     // Wundr 50
    '#C3D5E2',     // Wundr 100
    '#9EBACF',     // Wundr 200
    '#7A9FBC',     // Wundr 300
    '#5584A9',     // Wundr 400
    '#3D6A91',     // Wundr 500
    '#2D5078',     // Wundr 600
    '#1F3A5A',     // Wundr 700
  ] : [
    '#0E1A24',     // Wundr dark
    '#162940',     // Wundr 800
    '#1F3A5A',     // Wundr 700
    '#2D5078',     // Wundr 600
    '#3D6A91',     // Wundr 500
    '#5584A9',     // Wundr 400
    '#7A9FBC',     // Wundr 300
    '#9EBACF',     // Wundr 200
  ];

  const chartData = {
    labels: labels.map(label => label.charAt(0).toUpperCase() + label.slice(1)),
    datasets: [
      {
        data,
        backgroundColor: chartColors.slice(0, labels.length),
        borderWidth: 2,
        borderColor: isDark ? '#0E1A24' : '#FFFFFF',
        hoverBorderWidth: 3,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    animation: mounted ? {
      animateRotate: true,
      animateScale: false,
      duration: 750,
      easing: 'easeInOutQuart' as const,
    } : false,
    plugins: {
      legend: {
        position: 'right' as const,
        labels: {
          padding: 15,
          usePointStyle: true,
          font: {
            size: 12,
          },
          color: isDark ? '#E8EEF3' : '#0E1A24',
        },
      },
      tooltip: {
        callbacks: {
          label: function(context: ChartContext) {
            const label = context.label || '';
            const value = context.parsed;
            const total = context.dataset.data.reduce((a: number, b: number) => a + b, 0);
            const percentage = ((value / total) * 100).toFixed(1);
            return `${label}: ${value} (${percentage}%)`;
          },
        },
      },
    },
  };

  if (!mounted) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Entity Type Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] bg-muted animate-pulse rounded" />
        </CardContent>
      </Card>
    );
  }

  if (entities.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Entity Type Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] flex items-center justify-center text-muted-foreground">
            No entities to display
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Entity Type Distribution</CardTitle>
        <p className="text-sm text-muted-foreground">
          Breakdown of {entities.length} entities by type
        </p>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <Doughnut data={chartData} options={chartOptions} />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
          {labels.map((label, index) => (
            <div key={label} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: chartColors[index] }}
                />
                <span className="capitalize">{label}</span>
              </div>
              <span className="font-medium">{typeCounts[label]}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}