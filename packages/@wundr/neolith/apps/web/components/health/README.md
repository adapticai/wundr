# Health Dashboard Components

Phase 5.3: Observability & Monitoring UI components for the Neolith platform.

## Components

### 1. SystemOverview
Displays high-level system metrics in a 4-card grid layout.

**Features:**
- Orchestrator status (active/total)
- Active session count
- Token usage percentage
- Error rate monitoring
- Color-coded status indicators (green/yellow/red)

**Usage:**
```tsx
import { SystemOverview, type SystemOverviewData } from '@/components/health';

const data: SystemOverviewData = {
  orchestrators: { total: 10, active: 9 },
  sessions: { total: 50, active: 32 },
  tokens: { used: 75000, total: 100000, percentage: 75 },
  errorRate: { rate: 0.5, threshold: 2.0 }
};

<SystemOverview data={data} />
```

### 2. OrchestratorList
Sortable table view of orchestrator status with expandable details.

**Features:**
- Sortable columns (name, status, sessions, budget, last activity)
- Status badges with visual indicators
- Token budget progress bars
- Expandable rows showing metadata (version, uptime, memory, CPU)
- Click to expand/collapse details

**Usage:**
```tsx
import { OrchestratorList, type OrchestratorData } from '@/components/health';

const orchestrators: OrchestratorData[] = [
  {
    id: '1',
    name: 'Backend Orchestrator',
    status: 'active',
    sessions: 12,
    tokenBudget: { used: 8500, total: 10000, percentage: 85 },
    lastActivity: '2025-11-30T23:00:00Z',
    metadata: {
      version: '1.2.0',
      uptime: '5d 3h',
      memoryUsage: 45.2,
      cpuUsage: 32.1
    }
  }
];

<OrchestratorList orchestrators={orchestrators} />
```

### 3. MetricsChartsPanel
Interactive charts displaying system metrics over time.

**Features:**
- 4 responsive charts (Token Usage, Sessions, Error Rate, Response Time)
- Time range selector (1h, 24h, 7d, 30d)
- Uses recharts for visualization
- Custom tooltips
- Responsive grid layout

**Usage:**
```tsx
import { MetricsChartsPanel, type MetricsData, type TimeRange } from '@/components/health';

const data: MetricsData[] = [
  {
    timestamp: '2025-11-30T23:00:00Z',
    tokenUsage: 7500,
    sessionCount: 32,
    errorRate: 0.5,
    responseTime: 145
  },
  // ... more data points
];

const handleTimeRangeChange = (range: TimeRange) => {
  console.log('Time range changed to:', range);
};

<MetricsChartsPanel 
  data={data} 
  onTimeRangeChange={handleTimeRangeChange}
/>
```

### 4. AlertsPanel
Alert management with severity filtering and acknowledgment.

**Features:**
- Alert list with severity badges (critical, warning, info)
- Severity-based filtering
- Acknowledge button with confirmation dialog
- Relative timestamps (e.g., "5m ago")
- Visual severity indicators

**Usage:**
```tsx
import { AlertsPanel, type Alert } from '@/components/health';

const alerts: Alert[] = [
  {
    id: '1',
    severity: 'critical',
    message: 'Token budget exceeded for Orchestrator 3',
    timestamp: '2025-11-30T23:30:00Z',
    orchestratorId: '3',
    orchestratorName: 'ML Orchestrator',
    acknowledged: false
  }
];

const handleAcknowledge = (alertId: string) => {
  console.log('Acknowledged alert:', alertId);
};

<AlertsPanel 
  alerts={alerts}
  onAcknowledge={handleAcknowledge}
/>
```

## Types

All TypeScript types are exported from the components:

```tsx
import type {
  SystemOverviewData,
  OrchestratorData,
  OrchestratorStatus,
  MetricsData,
  TimeRange,
  Alert,
  AlertSeverity
} from '@/components/health';
```

## Dependencies

- **shadcn/ui**: Card, Badge, Table, Progress, Button, AlertDialog
- **lucide-react**: Icons (Users, Activity, Coins, AlertTriangle, etc.)
- **recharts**: Chart components (LineChart, AreaChart, BarChart)
- **Tailwind CSS**: Styling and responsive design

## File Structure

```
components/health/
├── system-overview.tsx     (146 lines)
├── orchestrator-list.tsx   (294 lines)
├── metrics-charts.tsx      (269 lines)
├── alerts-panel.tsx        (249 lines)
└── index.ts               (export barrel)
```

## Design Patterns

1. **Color-coded status**: All components use consistent color coding
   - Green: Success/Healthy
   - Yellow: Warning
   - Red: Error/Critical
   - Blue: Info/Neutral

2. **Responsive design**: All components use Tailwind responsive classes
   - Mobile-first approach
   - Grid layouts adapt to screen size
   - Tables scroll horizontally on mobile

3. **TypeScript-first**: Fully typed with exported interfaces
   - Strict null checks
   - Proper event typing
   - Type-safe props

4. **Accessibility**: Following a11y best practices
   - Semantic HTML
   - ARIA labels where needed
   - Keyboard navigation support
