# Token Budget Dashboard Components

Production-quality React components for visualizing and managing LLM token budgets in the Neolith application.

## Components

### 1. BudgetOverview

Displays current token usage against budget limits with progress visualization.

**Features:**
- Multi-period views (hourly, daily, monthly)
- Color-coded progress bar based on usage percentage
- Projected budget exhaustion time
- Cost estimation
- Real-time usage statistics

**Props:**
```typescript
interface BudgetOverviewProps {
  usage: BudgetUsage;
  className?: string;
  onViewChange?: (view: 'hourly' | 'daily' | 'monthly') => void;
}

interface BudgetUsage {
  current: number;
  limit: number;
  period: 'hourly' | 'daily' | 'monthly';
  projectedExhaustion?: Date;
  costEstimate?: number;
}
```

**Usage:**
```tsx
import { BudgetOverview } from '@/components/budget';

<BudgetOverview
  usage={{
    current: 750000,
    limit: 1000000,
    period: 'daily',
    projectedExhaustion: new Date(Date.now() + 3600000),
    costEstimate: 0.15
  }}
  onViewChange={(view) => console.log('View changed to:', view)}
/>
```

### 2. UsageChart

Interactive line chart showing token consumption trends over time.

**Features:**
- Multiple data series (input, output, total tokens)
- Interactive legend with hover effects
- Responsive recharts implementation
- Statistical summaries (total, average, peak)
- Time-based formatting (hourly/daily/monthly)

**Props:**
```typescript
interface UsageChartProps {
  data: UsageDataPoint[];
  className?: string;
  showComparison?: boolean;
  previousPeriodData?: UsageDataPoint[];
}

interface UsageDataPoint {
  timestamp: Date;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}
```

**Usage:**
```tsx
import { UsageChart } from '@/components/budget';

const data = [
  {
    timestamp: new Date('2025-11-30T00:00:00'),
    inputTokens: 10000,
    outputTokens: 5000,
    totalTokens: 15000
  },
  // ... more data points
];

<UsageChart
  data={data}
  showComparison={true}
  previousPeriodData={previousPeriodData}
/>
```

### 3. BudgetAlerts

Alert management system for budget threshold notifications.

**Features:**
- Severity-based alerts (info, warning, critical)
- Active/acknowledged alert separation
- Configurable thresholds dialog
- Alert acknowledgment and dismissal
- Relative time formatting

**Props:**
```typescript
interface BudgetAlertsProps {
  alerts: BudgetAlert[];
  thresholds: AlertThresholds;
  className?: string;
  onAcknowledge?: (alertId: string) => void;
  onDismiss?: (alertId: string) => void;
  onUpdateThresholds?: (thresholds: AlertThresholds) => void;
}

interface BudgetAlert {
  id: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  timestamp: Date;
  acknowledged: boolean;
  threshold?: number;
  currentValue?: number;
}

interface AlertThresholds {
  warningThreshold: number;
  criticalThreshold: number;
}
```

**Usage:**
```tsx
import { BudgetAlerts } from '@/components/budget';

const alerts = [
  {
    id: '1',
    severity: 'critical',
    message: 'Daily budget 95% consumed',
    timestamp: new Date(),
    acknowledged: false,
    threshold: 90,
    currentValue: 95
  }
];

<BudgetAlerts
  alerts={alerts}
  thresholds={{ warningThreshold: 75, criticalThreshold: 90 }}
  onAcknowledge={(id) => console.log('Acknowledged:', id)}
  onDismiss={(id) => console.log('Dismissed:', id)}
  onUpdateThresholds={(thresholds) => console.log('Updated:', thresholds)}
/>
```

### 4. BudgetSettings

Configuration interface for budget limits and alert thresholds.

**Features:**
- Hierarchical budget limits (hourly, daily, monthly)
- Alert threshold configuration
- Auto-pause toggle
- Real-time validation with error feedback
- Save/reset functionality

**Props:**
```typescript
interface BudgetSettingsProps {
  config: BudgetConfiguration;
  className?: string;
  onSave?: (config: BudgetConfiguration) => void;
  onReset?: () => void;
  isSaving?: boolean;
}

interface BudgetConfiguration {
  hourlyLimit: number;
  dailyLimit: number;
  monthlyLimit: number;
  autoPauseEnabled: boolean;
  warningThreshold: number;
  criticalThreshold: number;
}
```

**Usage:**
```tsx
import { BudgetSettings } from '@/components/budget';

<BudgetSettings
  config={{
    hourlyLimit: 100000,
    dailyLimit: 1000000,
    monthlyLimit: 10000000,
    autoPauseEnabled: true,
    warningThreshold: 75,
    criticalThreshold: 90
  }}
  onSave={(config) => console.log('Saving:', config)}
  onReset={() => console.log('Reset to defaults')}
  isSaving={false}
/>
```

## Color Coding

### Usage Percentage Colors
- **Green (Success)**: 0-74% usage
- **Yellow (Warning)**: 75-89% usage
- **Red (Critical)**: 90-100% usage

### Alert Severity Colors
- **Info**: Blue
- **Warning**: Yellow
- **Critical**: Red

## Validation Rules

The BudgetSettings component enforces the following validation:

1. All limits must be greater than 0
2. Daily limit ≥ 24 × hourly limit
3. Monthly limit ≥ 30 × daily limit
4. Warning threshold < critical threshold
5. Thresholds must be between 0-100%

## Dependencies

All components use shadcn/ui primitives:
- Card, CardContent, CardDescription, CardHeader, CardTitle
- Progress
- Badge
- Button
- Input
- Label
- Switch
- Dialog
- Separator

Charts use recharts:
- LineChart
- Line
- XAxis, YAxis
- CartesianGrid
- ResponsiveContainer

## File Structure

```
components/budget/
├── budget-overview.tsx      # Usage overview with progress
├── usage-chart.tsx          # Token consumption trends
├── budget-alerts.tsx        # Alert management
├── budget-settings.tsx      # Configuration interface
├── index.ts                 # Barrel exports
└── README.md                # This file
```

## Integration Example

Complete dashboard page example:

```tsx
'use client';

import { useState } from 'react';
import {
  BudgetOverview,
  UsageChart,
  BudgetAlerts,
  BudgetSettings,
  type BudgetUsage,
  type UsageDataPoint,
  type BudgetAlert,
  type BudgetConfiguration
} from '@/components/budget';

export default function BudgetDashboard() {
  const [usage, setUsage] = useState<BudgetUsage>({
    current: 750000,
    limit: 1000000,
    period: 'daily',
    projectedExhaustion: new Date(Date.now() + 7200000),
    costEstimate: 0.15
  });

  const [chartData, setChartData] = useState<UsageDataPoint[]>([
    // ... data points
  ]);

  const [alerts, setAlerts] = useState<BudgetAlert[]>([
    // ... alerts
  ]);

  const [config, setConfig] = useState<BudgetConfiguration>({
    hourlyLimit: 100000,
    dailyLimit: 1000000,
    monthlyLimit: 10000000,
    autoPauseEnabled: true,
    warningThreshold: 75,
    criticalThreshold: 90
  });

  return (
    <div className="space-y-6 p-6">
      <div className="grid gap-6 md:grid-cols-2">
        <BudgetOverview usage={usage} />
        <BudgetAlerts
          alerts={alerts}
          thresholds={{
            warningThreshold: config.warningThreshold,
            criticalThreshold: config.criticalThreshold
          }}
          onAcknowledge={(id) => {
            setAlerts((prev) =>
              prev.map((alert) =>
                alert.id === id ? { ...alert, acknowledged: true } : alert
              )
            );
          }}
        />
      </div>
      <UsageChart data={chartData} />
      <BudgetSettings
        config={config}
        onSave={(newConfig) => {
          setConfig(newConfig);
          // API call to save config
        }}
        onReset={() => {
          // Reset to defaults
        }}
      />
    </div>
  );
}
```

## TypeScript Support

All components are fully typed with TypeScript. Import types as needed:

```typescript
import type {
  BudgetUsage,
  BudgetOverviewProps,
  UsageDataPoint,
  UsageChartProps,
  BudgetAlert,
  AlertSeverity,
  AlertThresholds,
  BudgetAlertsProps,
  BudgetConfiguration,
  BudgetSettingsProps
} from '@/components/budget';
```

## Styling

Components use Tailwind CSS and follow the shadcn/ui design system. All components accept a `className` prop for custom styling.

## Accessibility

- Semantic HTML structure
- ARIA labels where appropriate
- Keyboard navigation support
- Focus management in dialogs
- Color contrast compliance

## Performance

- React.memo optimization candidates for static data
- useMemo for expensive calculations
- Debounced input handlers in settings
- Efficient chart rendering with recharts
