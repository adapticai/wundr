# Dashboard Visualization Components

This guide covers the new visualization components added to the Wundr Dashboard, providing comprehensive analytics and insights for your codebase.

## 📊 Available Visualizations

### 1. Performance Metrics Dashboard

Real-time performance monitoring with trend analysis.

```tsx
import { PerformanceMetrics } from '@/components/visualizations'

// Basic usage
<PerformanceMetrics data={performanceData} />

// With real-time updates
<PerformanceMetrics data={performanceData} realtime={true} />
```

**Features:**
- Build time trends
- Bundle size history
- Memory usage monitoring
- CPU utilization tracking
- Load time analysis
- Resource utilization radar chart

**Props:**
- `data`: Array of performance data points
- `realtime`: Enable live updates (optional)

### 2. Code Quality Radar

Multi-dimensional code quality visualization.

```tsx
import { CodeQualityRadar } from '@/components/visualizations'

<CodeQualityRadar 
  metrics={qualityMetrics}
  thresholds={customThresholds}
  showBenchmark={true}
/>
```

**Metrics Tracked:**
- Maintainability
- Reliability
- Security
- Test Coverage
- Code Duplication
- Complexity
- Technical Debt
- Documentation

### 3. Git Activity Heatmap

Repository activity visualization with contribution patterns.

```tsx
import { GitActivityHeatmap } from '@/components/visualizations'

<GitActivityHeatmap 
  activities={gitActivities}
  days={365} // Show last year
/>
```

**Features:**
- Contribution heatmap
- Commit statistics
- Activity streaks
- File change frequency

### 4. Dependency Network

Interactive force-directed graph for visualizing dependencies.

```tsx
import { DependencyNetwork } from '@/components/visualizations'

<DependencyNetwork 
  nodes={networkNodes}
  links={networkLinks}
  interactive={true}
  showLegend={true}
/>
```

**Features:**
- Interactive navigation
- Zoom and pan controls
- Node selection
- Circular dependency detection
- Export to PNG

### 5. Metrics Trend

Time-series analysis with anomaly detection.

```tsx
import { MetricsTrend } from '@/components/visualizations'

<MetricsTrend 
  series={metricsSeries}
  enableComparison={true}
  showAnomalies={true}
/>
```

**Features:**
- Multiple metric comparison
- Percentage vs absolute views
- Anomaly detection
- CSV export
- Customizable time ranges

## 🔌 Data Integration

### Using Data Hooks

The dashboard provides custom hooks for data fetching:

```tsx
import { 
  usePerformanceData,
  useQualityMetrics,
  useGitActivity 
} from '@/hooks'

function MyDashboard() {
  // Fetch performance data with real-time updates
  const { data: perfData, loading: perfLoading } = usePerformanceData({
    realtime: true,
    timeRange: '24h',
    refreshInterval: 5000
  })

  // Fetch code quality metrics
  const { data: qualityData } = useQualityMetrics({
    repository: 'main',
    includeHistory: true
  })

  // Fetch git activity
  const { data: gitData } = useGitActivity({
    days: 30,
    repository: 'main'
  })

  return (
    <>
      <PerformanceMetrics data={perfData} realtime={true} />
      <CodeQualityRadar metrics={qualityData} />
      <GitActivityHeatmap activities={gitData} />
    </>
  )
}
```

### WebSocket Real-time Updates

Enable real-time data streaming:

```tsx
import { useWebSocket } from '@/hooks'

function RealtimeDashboard() {
  const { 
    connected, 
    subscribe, 
    unsubscribe 
  } = useWebSocket('ws://localhost:8080')

  useEffect(() => {
    subscribe('performance', (data) => {
      // Handle performance updates
    })

    return () => unsubscribe('performance')
  }, [])
}
```

## 🎨 Theming

All visualizations support automatic theme switching:

```tsx
import { useChartTheme } from '@/hooks/chart/useChartTheme'

// Charts automatically adapt to light/dark mode
const chartTheme = useChartTheme()
```

## 📱 Responsive Design

All components are fully responsive:

- **Desktop**: Full features with interactive controls
- **Tablet**: Optimized layouts with touch support
- **Mobile**: Simplified views with essential data

## 🚀 Performance Optimization

### Code Splitting

Components support dynamic imports:

```tsx
import dynamic from 'next/dynamic'

const PerformanceMetrics = dynamic(
  () => import('@/components/visualizations').then(mod => mod.PerformanceMetrics),
  { 
    loading: () => <VisualizationSkeleton />,
    ssr: false 
  }
)
```

### Data Caching

Built-in caching with configurable TTL:

```tsx
const { data, refetch } = usePerformanceData({
  cacheTime: 300000, // 5 minutes
  staleTime: 60000   // 1 minute
})
```

## 🛠️ Configuration

### API Endpoints

Configure data sources in environment variables:

```env
# API Configuration
NEXT_PUBLIC_API_URL=https://api.example.com
NEXT_PUBLIC_WS_URL=ws://localhost:8080

# Feature Flags
NEXT_PUBLIC_ENABLE_REALTIME=true
NEXT_PUBLIC_ENABLE_EXPORT=true
```

### Custom Metrics

Define custom metrics for tracking:

```tsx
const customMetrics = {
  maintainability: {
    weight: 0.3,
    threshold: 80,
    calculate: (data) => {
      // Custom calculation
    }
  }
}

<CodeQualityRadar 
  metrics={data}
  customMetrics={customMetrics}
/>
```

## 📊 Example Dashboard

Complete dashboard implementation:

```tsx
import { 
  PerformanceMetrics,
  CodeQualityRadar,
  GitActivityHeatmap,
  DependencyNetwork,
  MetricsTrend
} from '@/components/visualizations'

export function CompleteDashboard() {
  const { data: perfData } = usePerformanceData({ realtime: true })
  const { data: qualityData } = useQualityMetrics()
  const { data: gitData } = useGitActivity({ days: 365 })
  const { data: depsData } = useDependencies()
  const { data: trendsData } = useMetricsTrends()

  return (
    <div className="grid gap-6">
      <PerformanceMetrics data={perfData} realtime={true} />
      
      <div className="grid md:grid-cols-2 gap-6">
        <CodeQualityRadar metrics={qualityData} />
        <GitActivityHeatmap activities={gitData} />
      </div>
      
      <DependencyNetwork 
        nodes={depsData.nodes} 
        links={depsData.links} 
      />
      
      <MetricsTrend 
        series={trendsData}
        enableComparison={true}
      />
    </div>
  )
}
```

## 🐛 Troubleshooting

### Common Issues

1. **Charts not rendering**: Ensure Chart.js is properly installed
2. **WebSocket connection fails**: Check WebSocket server is running
3. **Data not updating**: Verify API endpoints and authentication
4. **Performance issues**: Enable code splitting and reduce data points

### Debug Mode

Enable debug logging:

```tsx
// Enable debug mode
localStorage.setItem('debug', 'dashboard:*')

// View WebSocket messages
localStorage.setItem('debug', 'dashboard:websocket')
```

## 📚 Additional Resources

- [Chart.js Documentation](https://www.chartjs.org/docs/)
- [React Query Guide](https://tanstack.com/query/latest)
- [WebSocket API Reference](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)