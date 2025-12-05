# Reporting Components

A comprehensive, fully-functional reporting system with reusable chart components, report templates, and export utilities built with shadcn/ui and Recharts.

## Features

- **Reusable Chart Components**: Line, Bar, Area, and Pie charts
- **Report Templates**: Pre-built templates for common report types
- **Advanced Filters**: Date range picker with presets and dynamic filter builder
- **Export Utilities**: PDF and CSV export functionality
- **TypeScript**: Fully typed with comprehensive type definitions
- **shadcn/ui**: Built on top of shadcn/ui components for consistency

## Components

### Chart Components

#### LineChart
```tsx
import { LineChart } from '@/components/reporting';

<LineChart
  data={data}
  dataKeys={['revenue', 'profit']}
  xAxisKey="date"
  title="Revenue Trends"
  description="Monthly revenue and profit"
  height={400}
  curved
/>
```

#### BarChart
```tsx
import { BarChart } from '@/components/reporting';

<BarChart
  data={data}
  dataKeys={['sales', 'returns']}
  xAxisKey="category"
  title="Sales by Category"
  stacked
  horizontal
/>
```

#### AreaChart
```tsx
import { AreaChart } from '@/components/reporting';

<AreaChart
  data={data}
  dataKeys={['users', 'sessions']}
  xAxisKey="date"
  title="User Growth"
  gradient
  stacked
/>
```

#### PieChart
```tsx
import { PieChart } from '@/components/reporting';

<PieChart
  data={[
    { name: 'Desktop', value: 400 },
    { name: 'Mobile', value: 300 },
    { name: 'Tablet', value: 200 }
  ]}
  title="Device Distribution"
  donut
  innerRadius={60}
/>
```

### Filter Components

#### DateRangePicker
```tsx
import { DateRangePicker } from '@/components/reporting';

<DateRangePicker
  value={dateRange}
  onChange={(range) => setDateRange(range)}
  showPresets
/>
```

Built-in presets:
- Today
- Last 7 days
- Last 30 days
- Last 90 days
- Year to date
- Custom range

#### ReportFilters
```tsx
import { ReportFilters } from '@/components/reporting';

const filters = [
  {
    id: 'status',
    label: 'Status',
    type: 'select',
    options: [
      { label: 'Active', value: 'active' },
      { label: 'Inactive', value: 'inactive' }
    ]
  },
  {
    id: 'dateRange',
    label: 'Date Range',
    type: 'daterange'
  }
];

<ReportFilters
  filters={filters}
  values={filterValues}
  onChange={setFilterValues}
  onApply={() => fetchData()}
  onReset={() => resetFilters()}
/>
```

### Export Utilities

#### PDF Export
```tsx
import { exportToPDF, exportElementToPDF } from '@/components/reporting';

// Export structured report
await exportToPDF(report, {
  format: 'pdf',
  filename: 'report.pdf',
  orientation: 'portrait',
  includeMetadata: true
});

// Export HTML element
await exportElementToPDF('report-content', 'report.pdf', 'landscape');
```

#### CSV Export
```tsx
import { exportToCSV, convertChartDataToCSV } from '@/components/reporting';

// Export table data
exportToCSV(tableData, 'data.csv');

// Export chart data
convertChartDataToCSV(chartData, 'chart-data.csv');
```

### Report Templates

#### PerformanceReport
```tsx
import { PerformanceReport } from '@/components/reporting';

<PerformanceReport
  dateRange={{ from: startDate, to: endDate }}
  metrics={[
    {
      title: 'Total Revenue',
      value: '$125,000',
      change: 12.5,
      changeLabel: 'from last month',
      trend: 'up'
    }
  ]}
  timeSeriesData={timeSeriesData}
  categoryData={categoryData}
/>
```

#### AnalyticsReport
```tsx
import { AnalyticsReport } from '@/components/reporting';

<AnalyticsReport
  title="User Analytics"
  dateRange={{ from: startDate, to: endDate }}
  overviewData={{
    totalUsers: 10000,
    activeUsers: 7500,
    totalSessions: 25000,
    avgSessionDuration: '5m 23s'
  }}
  timeSeriesData={timeSeriesData}
  categoryData={categoryData}
  comparisonData={comparisonData}
/>
```

### ReportBuilder

Main component that combines filters, date range picker, and export functionality:

```tsx
import { ReportBuilder } from '@/components/reporting';

<ReportBuilder
  title="Monthly Report"
  description="Performance metrics for the current month"
  filters={filters}
  onFilterChange={handleFilterChange}
  onDateRangeChange={handleDateRangeChange}
  showDateRange
  showFilters
  showExport
>
  {/* Your report content */}
  <LineChart data={data} dataKeys={['value']} xAxisKey="date" />
</ReportBuilder>
```

## TypeScript Types

All components are fully typed. Import types from the main index:

```tsx
import type {
  ChartConfig,
  DateRange,
  ReportFilter,
  MetricCardData,
  TableData,
  ExportOptions
} from '@/components/reporting';
```

## Customization

### Colors

Charts use CSS variables from your theme:
- `hsl(var(--chart-1))` through `hsl(var(--chart-5))`

Or provide custom colors:
```tsx
<LineChart
  data={data}
  dataKeys={['value']}
  xAxisKey="date"
  colors={['#3b82f6', '#ef4444', '#10b981']}
/>
```

### Styling

All components accept a `className` prop for custom styling:
```tsx
<LineChart
  data={data}
  dataKeys={['value']}
  xAxisKey="date"
  className="custom-chart-styles"
/>
```

## Examples

### Complete Report Example

```tsx
'use client';

import { useState } from 'react';
import {
  ReportBuilder,
  LineChart,
  BarChart,
  PieChart,
  type DateRange,
  type ReportFilter
} from '@/components/reporting';

export function SalesReport() {
  const [dateRange, setDateRange] = useState<DateRange>();
  const [filters, setFilters] = useState({});

  const reportFilters: ReportFilter[] = [
    {
      id: 'region',
      label: 'Region',
      type: 'select',
      options: [
        { label: 'North', value: 'north' },
        { label: 'South', value: 'south' }
      ]
    }
  ];

  return (
    <ReportBuilder
      title="Sales Report"
      description="Comprehensive sales analytics"
      filters={reportFilters}
      onFilterChange={setFilters}
      onDateRangeChange={setDateRange}
    >
      <div className="grid gap-6">
        <LineChart
          title="Sales Trends"
          data={salesData}
          dataKeys={['sales', 'target']}
          xAxisKey="month"
          height={400}
        />

        <div className="grid md:grid-cols-2 gap-6">
          <BarChart
            title="Sales by Region"
            data={regionData}
            dataKeys={['sales']}
            xAxisKey="region"
          />

          <PieChart
            title="Product Distribution"
            data={productData}
            donut
          />
        </div>
      </div>
    </ReportBuilder>
  );
}
```

## Dependencies

- recharts: ^2.15.4
- date-fns: ^4.1.0
- jspdf: ^3.0.4
- html2canvas: ^1.4.1
- @radix-ui components (via shadcn/ui)
- lucide-react: ^0.554.0

## Notes

- All components are client-side ('use client')
- Charts are responsive by default
- Export functions work in browser environments only
- PDF export quality depends on screen resolution and canvas rendering
