"use client"

import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'

interface ChartTheme {
  colors: {
    primary: string
    secondary: string
    accent: string
    background: string
    text: string
    grid: string
    success: string
    warning: string
    error: string
  }
  tooltip: {
    backgroundColor: string
    titleColor: string
    bodyColor: string
    borderColor: string
    borderWidth: number
  }
  grid: {
    color: string
    lineWidth: number
  }
  ticks: {
    color: string
    font: {
      size: number
    }
  }
}

export function useChartTheme(): ChartTheme {
  const { theme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const isDark = mounted && (theme === 'dark' || resolvedTheme === 'dark')

  return {
    colors: {
      primary: isDark ? '#5584A9' : '#3D6A91',
      secondary: isDark ? '#7A9FBC' : '#5584A9', 
      accent: isDark ? '#9EBACF' : '#7A9FBC',
      background: isDark ? '#0E1A24' : '#FFFFFF',
      text: isDark ? '#E8EEF3' : '#0E1A24',
      grid: isDark ? '#2D5078' : '#C3D5E2',
      success: isDark ? '#10B981' : '#059669',
      warning: isDark ? '#F59E0B' : '#D97706',
      error: isDark ? '#EF4444' : '#DC2626'
    },
    tooltip: {
      backgroundColor: isDark ? '#1F3A5A' : '#FFFFFF',
      titleColor: isDark ? '#E8EEF3' : '#0E1A24',
      bodyColor: isDark ? '#C3D5E2' : '#2D5078',
      borderColor: isDark ? '#3D6A91' : '#C3D5E2',
      borderWidth: 1
    },
    grid: {
      color: isDark ? '#2D5078' : '#E5E7EB',
      lineWidth: 1
    },
    ticks: {
      color: isDark ? '#9EBACF' : '#6B7280',
      font: {
        size: 12
      }
    }
  }
}
