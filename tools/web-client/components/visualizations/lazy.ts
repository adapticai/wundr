import dynamic from 'next/dynamic'

// Lazy load all visualization components with appropriate loading states
export const LazyPerformanceMetrics = dynamic(
  () => import('./performance/PerformanceMetrics').then((mod) => mod.PerformanceMetrics),
  {
    loading: () => null,
    ssr: false // Disable SSR for Chart.js components
  }
)

export const LazyCodeQualityRadar = dynamic(
  () => import('./quality/CodeQualityRadar').then((mod) => mod.CodeQualityRadar),
  {
    loading: () => null,
    ssr: false
  }
)

export const LazyGitActivityHeatmap = dynamic(
  () => import('./repository/GitActivityHeatmap').then((mod) => mod.GitActivityHeatmap),
  {
    loading: () => null,
    ssr: false
  }
)

export const LazyDependencyNetwork = dynamic(
  () => import('./network/DependencyNetwork').then((mod) => mod.DependencyNetwork),
  {
    loading: () => null,
    ssr: false
  }
)

export const LazyMetricsTrend = dynamic(
  () => import('./time-series/MetricsTrend').then((mod) => mod.MetricsTrend),
  {
    loading: () => null,
    ssr: false
  }
)

// Note: The following visualizations exist in the monorepo root src folder
// They would need to be copied to this project or imported as external dependencies
// For now, we'll focus on the new visualizations created for dashboard-next