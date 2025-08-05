import { useTheme } from 'next-themes';
import { useMemo } from 'react';

export interface ChartColors {
  primary: string;
  secondary: string;
  success: string;
  warning: string;
  error: string;
  info: string;
  background: string;
  surface: string;
  text: string;
  textSecondary: string;
  border: string;
  grid: string;
}

export const useChartTheme = () => {
  const { theme, resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const colors: ChartColors = useMemo(() => {
    if (isDark) {
      return {
        primary: '#3b82f6',
        secondary: '#8b5cf6',
        success: '#10b981',
        warning: '#f59e0b',
        error: '#ef4444',
        info: '#06b6d4',
        background: '#0f172a',
        surface: '#1e293b',
        text: '#f8fafc',
        textSecondary: '#cbd5e1',
        border: '#334155',
        grid: '#475569'
      };
    }

    return {
      primary: '#2563eb',
      secondary: '#7c3aed',
      success: '#059669',
      warning: '#d97706',
      error: '#dc2626',
      info: '#0891b2',
      background: '#ffffff',
      surface: '#f8fafc',
      text: '#0f172a',
      textSecondary: '#475569',
      border: '#e2e8f0',
      grid: '#cbd5e1'
    };
  }, [isDark]);

  const chartDefaults = useMemo(() => ({
    plugins: {
      legend: {
        labels: {
          color: colors.text,
          font: {
            family: 'Inter, system-ui, sans-serif'
          }
        }
      },
      tooltip: {
        backgroundColor: colors.surface,
        titleColor: colors.text,
        bodyColor: colors.textSecondary,
        borderColor: colors.border,
        borderWidth: 1
      }
    },
    scales: {
      x: {
        ticks: {
          color: colors.textSecondary
        },
        grid: {
          color: colors.grid
        },
        border: {
          color: colors.border
        }
      },
      y: {
        ticks: {
          color: colors.textSecondary
        },
        grid: {
          color: colors.grid
        },
        border: {
          color: colors.border
        }
      }
    },
    responsive: true,
    maintainAspectRatio: false
  }), [colors]);

  const getColorPalette = (count: number): string[] => {
    const baseColors = [
      colors.primary,
      colors.secondary,
      colors.success,
      colors.warning,
      colors.error,
      colors.info
    ];

    if (count <= baseColors.length) {
      return baseColors.slice(0, count);
    }

    // Generate additional colors by varying opacity
    const extendedColors = [...baseColors];
    while (extendedColors.length < count) {
      baseColors.forEach(color => {
        if (extendedColors.length < count) {
          extendedColors.push(color + '80'); // Add transparency
        }
      });
    }

    return extendedColors.slice(0, count);
  };

  return {
    colors,
    chartDefaults,
    getColorPalette,
    isDark
  };
};