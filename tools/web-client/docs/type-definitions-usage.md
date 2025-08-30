# Type Definitions Usage Guide

This guide demonstrates how to use the centralized type definitions provided in `/types/index.d.ts`.

## Importing Types

### Import Individual Types

```typescript
import type { 
  ApiResponse, 
  FileInfo, 
  AnalysisEntity, 
  Report,
  ConfigurationState 
} from '@/types';
```

### Import All Types

```typescript
import type * as Types from '@/types';

// Usage: Types.ApiResponse<string>
```

## Common Usage Examples

### 1. API Response Handling

```typescript
import type { ApiResponse, AnalysisData } from '@/types';

async function fetchAnalysisData(): Promise<ApiResponse<AnalysisData>> {
  const response = await fetch('/api/analysis');
  return response.json();
}

// Usage
const result = await fetchAnalysisData();
if (result.success) {
  console.log('Analysis data:', result.data);
  console.log('Processing time:', result.meta?.duration);
}
```

### 2. File Operations

```typescript
import type { FileInfo, FileOperations } from '@/types';

const fileOperations: FileOperations = {
  readFile: async (path: string) => {
    const response = await fetch(`/api/files/read?path=${path}`);
    return response.text();
  },
  writeFile: async (path: string, content: string) => {
    await fetch('/api/files/write', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, content })
    });
  },
  // ... implement other operations
};

// File info usage
const fileInfo: FileInfo = {
  id: '1',
  path: '/src/components/Button.tsx',
  name: 'Button.tsx',
  size: 2048,
  type: 'file',
  modifiedAt: new Date(),
  extension: 'tsx',
  mimeType: 'text/typescript'
};
```

### 3. Component Props

```typescript
import type { SummaryCardProps, TableProps } from '@/types';
import { TrendingUp } from 'lucide-react';

// Summary card props
const summaryProps: SummaryCardProps = {
  title: 'Code Quality',
  value: '85%',
  icon: TrendingUp,
  variant: 'success',
  trend: {
    value: 5,
    direction: 'up',
    label: '+5% from last month'
  }
};

// Table props
interface UserData {
  id: string;
  name: string;
  email: string;
  role: string;
}

const tableProps: TableProps<UserData> = {
  data: users,
  columns: [
    { key: 'name', label: 'Name', sortable: true },
    { key: 'email', label: 'Email', sortable: true },
    { key: 'role', label: 'Role', width: '100px' }
  ],
  onSort: (key, direction) => console.log(`Sort by ${key} ${direction}`),
  pagination: {
    page: 1,
    pageSize: 10,
    total: 100,
    onPageChange: (page) => console.log(`Go to page ${page}`)
  }
};
```

### 4. Analysis Data

```typescript
import type { 
  AnalysisEntity, 
  AnalysisIssue, 
  AnalysisDuplicate,
  CircularDependency 
} from '@/types';

// Creating analysis entities
const entity: AnalysisEntity = {
  id: 'component-1',
  name: 'UserProfile',
  path: '/src/components/UserProfile.tsx',
  type: 'component',
  dependencies: ['react', 'lodash'],
  complexity: {
    cyclomatic: 5,
    cognitive: 3,
    halstead: {
      volume: 120.5,
      difficulty: 8.2,
      effort: 988.1
    }
  },
  metrics: {
    linesOfCode: 85,
    maintainabilityIndex: 78,
    testCoverage: 85.5
  },
  issues: [],
  tags: ['component', 'user-interface'],
  lastModified: new Date()
};

// Handling analysis issues
const issue: AnalysisIssue = {
  id: 'issue-1',
  type: 'code_smell',
  severity: 'medium',
  message: 'Function too complex',
  file: '/src/utils/helper.ts',
  line: 45,
  category: 'complexity',
  effort: 'medium',
  impact: 'medium',
  tags: ['refactoring', 'complexity'],
  suggestions: [
    'Break down into smaller functions',
    'Extract common logic'
  ]
};
```

### 5. Configuration Management

```typescript
import type { ConfigurationState, AnalysisSettings } from '@/types';

const defaultConfig: ConfigurationState = {
  general: {
    theme: 'dark',
    language: 'en',
    autoSave: true,
    notifications: true,
    compactMode: false,
    sidebarCollapsed: false
  },
  analysis: {
    patternsToIgnore: ['*.test.ts', '*.spec.ts'],
    duplicateThreshold: 80,
    complexityThreshold: 10,
    minFileSize: 100,
    excludeDirectories: ['node_modules', 'dist', '.git'],
    includeFileTypes: ['ts', 'tsx', 'js', 'jsx'],
    enableSmartAnalysis: true,
    analysisDepth: 'medium'
  },
  integration: {
    webhookUrls: {
      onAnalysisComplete: '',
      onReportGenerated: '',
      onError: ''
    },
    apiKeys: {
      github: '',
      slack: '',
      jira: ''
    },
    automations: {
      autoUpload: false,
      scheduleAnalysis: true,
      notifyOnCompletion: true
    }
  },
  export: {
    defaultFormats: ['json', 'pdf'],
    defaultPath: '/exports',
    includeMetadata: true,
    compressionEnabled: false,
    timestampFiles: true,
    maxFileSize: 104857600 // 100MB
  }
};

// Update analysis settings
function updateAnalysisSettings(updates: Partial<AnalysisSettings>) {
  return {
    ...defaultConfig.analysis,
    ...updates
  };
}
```

### 6. Report Generation

```typescript
import type { 
  Report, 
  ReportTemplate, 
  ReportSection,
  ReportChart 
} from '@/types';

const reportTemplate: ReportTemplate = {
  id: 'code-quality-template',
  name: 'Code Quality Report',
  description: 'Comprehensive code quality analysis report',
  type: 'code-quality',
  category: 'standard',
  parameters: [
    {
      key: 'dateRange',
      label: 'Date Range',
      type: 'daterange',
      required: true,
      description: 'Analysis period'
    },
    {
      key: 'includeTests',
      label: 'Include Test Files',
      type: 'boolean',
      required: false,
      defaultValue: false
    }
  ],
  sections: [
    {
      id: 'overview',
      title: 'Executive Summary',
      content: [],
      charts: [],
      tables: [],
      order: 1
    }
  ]
};

// Chart configuration
const complexityChart: ReportChart = {
  id: 'complexity-distribution',
  title: 'Complexity Distribution',
  type: 'bar',
  data: {
    labels: ['Low', 'Medium', 'High', 'Very High'],
    datasets: [{
      label: 'Number of Files',
      data: [45, 23, 12, 3],
      backgroundColor: ['#22c55e', '#eab308', '#f97316', '#ef4444']
    }]
  }
};
```

### 7. Batch Processing

```typescript
import type { BatchJob, BatchConfig, BatchResults } from '@/types';

const batchJob: BatchJob = {
  id: 'batch-1',
  name: 'Process Templates',
  description: 'Batch process all template files',
  status: 'pending',
  progress: 0,
  createdAt: new Date(),
  templateIds: ['tmpl-1', 'tmpl-2', 'tmpl-3'],
  consolidationType: 'merge',
  priority: 'high',
  estimatedDuration: 300, // 5 minutes
  errors: [],
  warnings: [],
  executionIds: [],
  config: {
    backupStrategy: 'auto',
    conflictResolution: 'interactive',
    maxConcurrentJobs: 3,
    retryAttempts: 2,
    rollbackOnFailure: true
  }
};
```

### 8. WebSocket Communication

```typescript
import type { WebSocketMessage, RealtimeUpdate } from '@/types';

// WebSocket message
const message: WebSocketMessage = {
  type: 'subscribe',
  channel: 'analysis-updates',
  timestamp: new Date().toISOString(),
  payload: {
    filters: ['code-quality', 'security']
  }
};

// Real-time update handler
function handleUpdate(update: RealtimeUpdate) {
  switch (update.type) {
    case 'analysis':
      console.log('Analysis update:', update.data);
      break;
    case 'performance':
      console.log('Performance update:', update.data);
      break;
    default:
      console.log('Unknown update type:', update.type);
  }
}
```

## Type Utilities

The type definitions also include utility types for common patterns:

```typescript
import type { 
  TimeRange, 
  SeverityLevel, 
  PriorityLevel, 
  StatusType 
} from '@/types';

// Time range selection
const timeRange: TimeRange = '24h'; // '1h' | '6h' | '24h' | '7d' | '30d' | '90d' | '1y'

// Severity levels
const severity: SeverityLevel = 'high'; // 'low' | 'medium' | 'high' | 'critical'

// Priority levels  
const priority: PriorityLevel = 'medium'; // 'low' | 'medium' | 'high' | 'critical'

// Status types
const status: StatusType = 'running'; // 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | 'paused'
```

## Best Practices

1. **Always use the centralized types**: Import from `@/types` instead of defining types inline
2. **Extend base interfaces**: Use composition to build complex types from base types
3. **Provide JSDoc comments**: When creating custom types, document them thoroughly
4. **Use generic types**: Leverage generic APIs like `ApiResponse<T>` for type safety
5. **Validate at boundaries**: Use type guards when data comes from external sources

## Path Aliases

The types are available through the following import paths:

- `@/types` - Main type definitions
- `@/types/data` - Legacy data types (re-exported from main)
- `@/types/reports` - Legacy report types (re-exported from main)  
- `@/types/config` - Legacy config types (re-exported from main)

## IDE Support

Most modern IDEs will provide:
- Auto-completion for type properties
- Type checking and error highlighting  
- Go-to-definition for type definitions
- Hover documentation from JSDoc comments