# Load Report Page Features

## Overview
The `/dashboard/load-report` page provides comprehensive functionality for loading, viewing, and analyzing code analysis reports in the Wundr dashboard.

## Core Features

### 1. Report Metadata Display
- **File Information**: Name, filename, upload date, file size
- **Analysis Metadata**: Version, generator, environment, analysis duration
- **Summary Statistics**: Total files, entities, duplicates, circular dependencies, unused exports, code smells

### 2. Report Management
- **File Upload**: JSON file upload with drag-and-drop support
- **Report Library**: Grid view of all loaded reports with search and filtering
- **Export/Download**: Export reports back to JSON format
- **Delete Reports**: Remove unwanted reports from the library

### 3. Interactive Charts and Visualizations
- **Entity Distribution**: Doughnut chart showing entity types
- **Duplicate Severity**: Bar chart of duplicate clusters by severity
- **Complexity Distribution**: Line chart of entity complexity ranges
- **Dependency Analysis**: Line chart of dependency distributions
- **Theme-Aware Charts**: Automatic dark/light mode support

### 4. Advanced Filtering and Search
- **Search**: Full-text search across report names and filenames
- **Sort Options**: By name, upload date, or file size
- **Filter Categories**: 
  - All reports
  - Recent (24h)
  - Large files (>1MB)
  - Complex projects (>100 entities)

### 5. Report Comparison Features
- **Side-by-Side Comparison**: Compare two reports directly
- **Trend Analysis**: Identify improving, degrading, and stable metrics
- **Change Visualization**: Bar chart comparing metrics between reports
- **Metric Differences**: Detailed breakdown of changes between reports

### 6. Data Persistence
- **Local Storage**: Reports persist between browser sessions
- **Cache Management**: Efficient caching with TTL support
- **Session Recovery**: Automatic restoration of selected reports

## Technical Implementation

### Components Used
- **Chart.js**: For interactive data visualizations
- **React Hooks**: useState, useEffect, useMemo for state management
- **Custom Hooks**: useAnalysis, useChartTheme, useDataCache
- **UI Components**: Cards, tabs, buttons, badges, inputs from shadcn/ui
- **Date Utilities**: date-fns for date formatting and calculations

### Data Structure
```typescript
interface LoadedReport {
  id: string
  name: string
  fileName: string
  uploadDate: string
  fileSize: number
  analysisData: any
  summary: {
    totalFiles: number
    totalEntities: number
    duplicateClusters: number
    circularDependencies: number
    unusedExports: number
    codeSmells: number
  }
  metadata: {
    version: string
    generator: string
    environment: string
    duration: number
  }
}
```

### Key Functionality
1. **File Processing**: JSON parsing with error handling
2. **State Management**: Complex state for reports, comparisons, and filters
3. **Chart Generation**: Dynamic chart data based on analysis results
4. **Responsive Design**: Mobile-friendly grid layouts and responsive charts

## User Experience

### Loading Reports
1. Click "Upload Report" button
2. Select JSON analysis file
3. File is parsed and added to library
4. Automatically selected for viewing

### Viewing Analysis
1. Select report from library grid
2. View summary cards with key metrics
3. Explore interactive charts
4. Export or delete as needed

### Comparing Reports
1. Enable "Compare" mode
2. Select two reports from library
3. View side-by-side metrics
4. Analyze trends and changes

## Error Handling
- Invalid JSON files show user-friendly error messages
- Failed uploads don't crash the interface
- Missing data gracefully handled with defaults
- Large files processed with loading indicators

## Accessibility Features
- Keyboard navigation support
- Screen reader compatible
- High contrast mode support
- Focus management for modals and interactions

## Performance Optimizations
- Memoized calculations for expensive operations
- Efficient re-renders with React.memo patterns
- Lazy loading for large datasets
- Cached chart configurations