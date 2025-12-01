# Report Visualization Components Guide

This guide covers the comprehensive report visualization components built for the monorepo
refactoring toolkit. These components provide interactive, theme-aware visualizations with export
capabilities.

## Components Overview

### 1. ReportLoader

The `ReportLoader` component handles loading and parsing JSON analysis reports.

**Features:**

- File upload support (.json files)
- URL-based report loading
- Sample report generation
- JSON validation
- Error handling with user feedback

**Usage:**

```tsx
import { ReportLoader } from '@/components/visualizations';

<ReportLoader onReportLoad={report => setReport(report)} onError={error => console.error(error)} />;
```

### 2. DuplicatesVisualization

Interactive visualization for duplicate code analysis with multiple view modes.

**Features:**

- Multiple chart types (Bar, Doughnut)
- View modes: Overview, By Type, By Score, Top Files
- Score range filtering
- Interactive file selection
- Export functionality (PNG, PDF, CSV, JSON)

**Usage:**

```tsx
import { DuplicatesVisualization } from '@/components/visualizations';

<DuplicatesVisualization
  data={report.duplicates}
  duplicateFiles={report.duplicates.duplicateFiles}
  onFileSelect={file => handleFileSelection(file)}
/>;
```

### 3. DependencyGraph

Comprehensive dependency analysis with multiple visualization modes.

**Features:**

- Overview of dependency types
- Tree structure visualization
- Security vulnerabilities display
- Size vs dependencies scatter plot
- Search and filtering capabilities
- Interactive node selection

**Usage:**

```tsx
import { DependencyGraph } from '@/components/visualizations';

<DependencyGraph
  data={report.dependencies}
  onNodeSelect={node => handleNodeSelection(node)}
  onVulnerabilitySelect={vuln => handleVulnerabilitySelection(vuln)}
/>;
```

### 4. CircularDependencyDiagram

Visual representation of circular dependencies with network diagrams.

**Features:**

- Interactive network diagram
- Severity-based color coding
- Multiple view modes (Network, List, Impact)
- Severity filtering
- Click-to-select functionality
- Canvas-based visualization

**Usage:**

```tsx
import { CircularDependencyDiagram } from '@/components/visualizations';

<CircularDependencyDiagram
  dependencies={report.circularDependencies}
  onDependencySelect={dep => handleDependencySelection(dep)}
/>;
```

### 5. MetricsOverview

Comprehensive metrics dashboard with cards and progress indicators.

**Features:**

- Categorized metrics (Code Quality, Performance, Maintainability, Complexity)
- Trend indicators (with comparison to previous metrics)
- Progress bars for target-based metrics
- Severity indicators
- Export functionality
- Summary score calculations

**Usage:**

```tsx
import { MetricsOverview } from '@/components/visualizations';

<MetricsOverview
  metrics={report.metrics}
  summary={report.summary}
  previousMetrics={previousReport?.metrics} // Optional for trend comparison
/>;
```

### 6. DataTable

Generic, feature-rich data table component with sorting, filtering, and pagination.

**Features:**

- Column-based configuration
- Sortable columns
- Filterable columns with dropdown options
- Global search functionality
- Pagination with customizable page size
- Export to CSV/JSON
- Row selection callbacks
- Responsive design

**Usage:**

```tsx
import { DataTable, Column } from '@/components/visualizations';

const columns: Column<DuplicateFile>[] = [
  { key: 'path', title: 'File Path', sortable: true },
  { key: 'type', title: 'Type', sortable: true, filterable: true },
  {
    key: 'duplicateScore',
    title: 'Similarity',
    sortable: true,
    render: value => `${(value * 100).toFixed(1)}%`,
  },
];

<DataTable
  data={duplicateFiles}
  columns={columns}
  title='Duplicate Files'
  searchable
  exportable
  pagination
  pageSize={10}
  onRowSelect={file => handleRowSelection(file)}
/>;
```

### 7. ReportDashboard

Complete dashboard combining all visualization components with tabbed interface.

**Features:**

- Tabbed interface for different analysis areas
- Report header with summary statistics
- Integrated component interactions
- State management for selections
- Responsive layout

**Usage:**

```tsx
import { ReportDashboard } from '@/components/visualizations';

<ReportDashboard initialReport={report} />;
```

## Theme Support

All components are theme-aware using the `useChartTheme` hook:

```tsx
import { useChartTheme } from '@/hooks/useChartTheme';

const { colors, chartDefaults, getColorPalette, isDark } = useChartTheme();
```

**Theme Features:**

- Automatic dark/light mode detection
- Consistent color palette
- Chart.js integration
- Responsive color schemes

## Export Functionality

The `ChartExporter` utility provides export capabilities:

```tsx
import { exportChart, exportTableData } from '@/utils/chartExport';

// Export charts
await exportChart(chartRef.current, {
  format: 'png', // 'png' | 'pdf' | 'csv' | 'json'
  filename: 'chart-export',
  includeData: true,
});

// Export table data
exportTableData(data, 'filename', 'csv'); // or 'json'
```

## Data Types

All components use TypeScript interfaces defined in `/src/types/report.ts`:

```tsx
interface AnalysisReport {
  id: string;
  timestamp: string;
  projectName: string;
  version: string;
  summary: ReportSummary;
  duplicates: DuplicateAnalysis;
  dependencies: DependencyAnalysis;
  circularDependencies: CircularDependency[];
  metrics: ProjectMetrics;
  packages: PackageInfo[];
}
```

## Responsive Design

All components are built with responsive design principles:

- Mobile-first approach
- Flexible grid layouts
- Adaptive chart sizing
- Touch-friendly interactions
- Collapsible filters and controls

## Performance Considerations

- **Lazy Loading**: Heavy components load on demand
- **Virtualization**: Large datasets use virtualized rendering
- **Memoization**: Expensive calculations are memoized
- **Chart Optimization**: Chart.js performance optimizations applied
- **Bundle Splitting**: Dynamic imports for optional features

## Integration Examples

### Basic Usage

```tsx
import { ReportDashboard } from '@/components/visualizations';

function App() {
  return <ReportDashboard />;
}
```

### Custom Integration

```tsx
import {
  ReportLoader,
  MetricsOverview,
  DuplicatesVisualization,
} from '@/components/visualizations';

function CustomDashboard() {
  const [report, setReport] = useState(null);

  return (
    <div>
      {!report ? (
        <ReportLoader onReportLoad={setReport} />
      ) : (
        <>
          <MetricsOverview metrics={report.metrics} summary={report.summary} />
          <DuplicatesVisualization data={report.duplicates} />
        </>
      )}
    </div>
  );
}
```

## Dependencies

The visualization components require these key dependencies:

```json
{
  "chart.js": "^4.4.0",
  "react-chartjs-2": "^5.2.0",
  "jspdf": "^2.5.1",
  "lucide-react": "^0.292.0",
  "next-themes": "^0.2.1"
}
```

## Best Practices

1. **Data Validation**: Always validate report data before rendering
2. **Error Boundaries**: Wrap components in error boundaries
3. **Loading States**: Show loading indicators for async operations
4. **Accessibility**: Ensure keyboard navigation and screen reader support
5. **Performance**: Use React.memo for expensive components
6. **Testing**: Write unit tests for component interactions

## Troubleshooting

### Common Issues

1. **Charts not rendering**: Ensure Chart.js is properly imported
2. **Theme not applying**: Check ThemeProvider configuration
3. **Export not working**: Verify browser support for canvas operations
4. **Performance issues**: Consider data pagination or virtualization

### Debug Mode

Enable debug mode for development:

```tsx
const DEBUG = process.env.NODE_ENV === 'development';

// Add to component props
<DependencyGraph data={data} debug={DEBUG} />;
```

This comprehensive guide covers all aspects of the report visualization components, from basic usage
to advanced customization and troubleshooting.
