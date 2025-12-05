# Dashboard Metric Widgets

Comprehensive set of dashboard metric widgets built with React, TypeScript, and shadcn/ui. These
components provide real-time data visualization with proper accessibility, loading states, and
responsive design.

## Components

### 1. KPI Card (`kpi-card.tsx`)

Key Performance Indicator cards with trend indicators, targets, and status badges.

**Features:**

- Trend indicators with directional icons
- Target progress visualization
- Status badges (success, warning, danger, info)
- Real-time update capability
- Custom formatting (currency, percentage, duration, compact)
- Tooltips for additional context

**Usage:**

```tsx
import { KPICard } from '@/components/analytics';

<KPICard
  title='Total Revenue'
  value={124567}
  format='currency'
  icon={<DollarSign className='w-5 h-5' />}
  trend={{
    current: 124567,
    previous: 98234,
    percentageChange: 26.8,
    direction: 'up',
    isPositive: true,
  }}
  target={150000}
  status='success'
  updateInterval={5000}
  onRefresh={fetchLatestRevenue}
/>;
```

### 2. Sparkline Chart (`sparkline-chart.tsx`)

Miniature line charts for visualizing trends in a compact space.

**Features:**

- Smooth curve interpolation
- Optional area fill
- Data point markers
- Interactive hover with tooltips
- Multiple color schemes
- Responsive scaling

**Usage:**

```tsx
import { SparklineChart } from '@/components/analytics';

<SparklineChart
  title='Revenue Trend'
  currentValue={124567}
  data={[
    { x: 1, y: 80000, label: 'Jan' },
    { x: 2, y: 95000, label: 'Feb' },
    { x: 3, y: 124567, label: 'Mar' },
  ]}
  format='currency'
  color='success'
  filled={true}
  showPoints={false}
  height={60}
  onHover={point => console.log(point)}
/>;
```

### 3. Progress Ring (`progress-ring.tsx`)

Circular progress indicators with animated values.

**Features:**

- Smooth animation with easing
- Multiple color schemes (including adaptive gradient)
- Customizable size and stroke width
- Center value display
- Percentage or absolute values
- Group component for multiple rings

**Usage:**

```tsx
import { ProgressRing, ProgressRingGroup } from '@/components/analytics';

// Single ring
<ProgressRing
  title="Sales Target"
  value={87500}
  max={100000}
  format="currency"
  color="success"
  showPercentage={true}
  subtitle="Q4 2024"
  animationDuration={1000}
/>

// Multiple rings
<ProgressRingGroup
  rings={[
    { title: 'Backend', value: 85, max: 100, color: 'success' },
    { title: 'Frontend', value: 72, max: 100, color: 'primary' },
    { title: 'Database', value: 91, max: 100, color: 'info' },
  ]}
  size={100}
/>
```

### 4. Stat Comparison Card (`stat-comparison-card.tsx`)

Period-over-period comparison cards with detailed breakdowns.

**Features:**

- Current vs previous period comparison
- Absolute and percentage change indicators
- Metadata display (count, average, peak)
- Visual progress bars
- Directional trend icons
- Multiple comparison modes

**Usage:**

```tsx
import { StatComparisonCard } from '@/components/analytics';

<StatComparisonCard
  title='Revenue Comparison'
  current={{
    label: 'This Month',
    value: 124567,
    metadata: {
      count: 1234,
      average: 100.95,
      peak: 5678,
    },
  }}
  previous={{
    label: 'Last Month',
    value: 98234,
    metadata: {
      count: 1056,
      average: 93.02,
      peak: 4523,
    },
  }}
  format='currency'
  icon={<DollarSign className='w-5 h-5' />}
  showDetails={true}
  mode='both'
/>;
```

### 5. Real-time Metrics (`realtime-metrics.tsx`)

Live-updating metric displays with activity feed.

**Features:**

- Auto-refresh with configurable intervals
- Live/paused state toggle
- Status indicators
- Change animations
- Activity feed with type icons
- Timestamp tracking

**Usage:**

```tsx
import { RealtimeMetrics, RealtimeActivityFeed } from '@/components/analytics';

// Real-time metrics
<RealtimeMetrics
  metrics={[
    {
      id: 'active-users',
      label: 'Active Users',
      value: 456,
      previousValue: 423,
      format: 'number',
      status: 'active',
      lastUpdated: new Date(),
    }
  ]}
  updateInterval={5000}
  onUpdate={async () => {
    const data = await fetchMetrics();
    return data;
  }}
  showLiveIndicator={true}
/>

// Activity feed
<RealtimeActivityFeed
  activities={[
    {
      id: '1',
      type: 'user',
      message: 'New user registration',
      timestamp: new Date(),
    }
  ]}
  maxItems={10}
/>
```

## Common Props

### Format Options

All widgets support these format types:

- `number` - Standard number formatting with locale support
- `currency` - USD currency with $ symbol
- `percentage` - Percentage with % symbol
- `duration` - Time duration (seconds, minutes, hours, days)
- `compact` - Compact notation (K, M, B suffixes)

### Color Schemes

Standard color options across components:

- `primary` - Theme primary color
- `success` - Green/emerald
- `warning` - Amber/yellow
- `danger` - Red/rose
- `info` - Blue
- `gradient` - Adaptive gradient based on value

### Loading States

All components support a loading state with skeleton placeholders:

```tsx
<KPICard title='...' value={0} isLoading={true} />
```

## Styling

All components use shadcn/ui styling and support:

- Dark mode via next-themes
- Custom className props
- Tailwind CSS classes
- Responsive design (mobile-first)
- Proper accessibility (ARIA labels, keyboard navigation)

## Real-time Updates

Components support real-time data updates:

```tsx
const [data, setData] = useState(initialData);

// Option 1: Manual refresh
<KPICard
  value={data.value}
  updateInterval={5000}
  onRefresh={async () => {
    const newData = await fetchData();
    setData(newData);
  }}
/>;

// Option 2: External update
useEffect(() => {
  const interval = setInterval(async () => {
    const newData = await fetchData();
    setData(newData);
  }, 5000);
  return () => clearInterval(interval);
}, []);
```

## Accessibility

All components follow WCAG 2.1 guidelines:

- Proper ARIA labels and roles
- Keyboard navigation support
- Screen reader announcements
- Color contrast compliance
- Focus indicators
- Semantic HTML

## Performance

Optimizations included:

- Memoized calculations
- Request animation frame for smooth animations
- CSS transitions over JS animations
- Lazy loading of heavy components
- Efficient re-render patterns

## Examples

See `/components/analytics/examples/dashboard-widgets-demo.tsx` for a comprehensive demo of all
widgets with sample data.

## TypeScript

All components are fully typed with TypeScript. Import types:

```tsx
import type {
  KPICardProps,
  SparklineDataPoint,
  ProgressRingProps,
  ComparisonPeriod,
  RealtimeMetric,
} from '@/components/analytics';
```

## Dependencies

Required packages (already included):

- `@radix-ui/react-tooltip` - Tooltips
- `@radix-ui/react-progress` - Progress primitives
- `lucide-react` - Icons
- `class-variance-authority` - Variant styling
- `clsx` & `tailwind-merge` - Utility classes

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers (iOS 14+, Android 10+)

## License

MIT - Part of the Wundr/Neolith project
