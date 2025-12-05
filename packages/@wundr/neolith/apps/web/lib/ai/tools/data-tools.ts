/**
 * Data Manipulation and Analysis Tools
 *
 * Tools for data operations, transformations, and analytics.
 */

import { registerTool } from './index';
import type { ToolContext, ToolResult } from './index';

/**
 * Query Data Tool
 */
registerTool({
  name: 'query_data',
  description: 'Query workspace data with filters and aggregations',
  category: 'data',
  requiredPermissions: ['data:read'],
  cacheable: true,
  cacheTTL: 60,
  parameters: {
    type: 'object',
    properties: {
      source: {
        type: 'string',
        description: 'Data source to query',
        enum: ['messages', 'users', 'channels', 'workflows', 'files'],
      },
      filters: {
        type: 'object',
        description: 'Filter conditions',
        properties: {
          field: { type: 'string', description: 'Field to filter on' },
          operator: {
            type: 'string',
            description: 'Comparison operator',
            enum: ['eq', 'ne', 'gt', 'lt', 'gte', 'lte', 'contains', 'in'],
          },
          value: { type: 'string', description: 'Filter value' },
        },
      },
      aggregations: {
        type: 'array',
        description: 'Aggregations to perform',
        items: {
          type: 'object',
          description: 'Aggregation configuration',
          properties: {
            field: { type: 'string', description: 'Field to aggregate' },
            function: {
              type: 'string',
              description: 'Aggregation function',
              enum: ['count', 'sum', 'avg', 'min', 'max'],
            },
          },
        },
      },
      groupBy: {
        type: 'array',
        description: 'Fields to group by',
        items: { type: 'string', description: 'Field name' },
      },
      limit: {
        type: 'number',
        description: 'Maximum number of results',
        default: 100,
      },
    },
    required: ['source'],
  },
  async execute(
    input: {
      source: string;
      filters?: Record<string, unknown>;
      aggregations?: Array<{ field: string; function: string }>;
      groupBy?: string[];
      limit?: number;
    },
    context: ToolContext
  ): Promise<
    ToolResult<{
      data: unknown[];
      count: number;
      aggregations?: Record<string, number>;
    }>
  > {
    try {
      const response = await fetch(
        `/api/workspaces/${context.workspaceId}/data/query`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            source: input.source,
            filters: input.filters,
            aggregations: input.aggregations,
            groupBy: input.groupBy,
            limit: input.limit || 100,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Data query failed: ${response.statusText}`);
      }

      const results = await response.json();

      return {
        success: true,
        data: {
          data: results.data || [],
          count: results.count || 0,
          aggregations: results.aggregations,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to query data',
      };
    }
  },
});

/**
 * Transform Data Tool
 */
registerTool({
  name: 'transform_data',
  description: 'Transform and manipulate data using specified operations',
  category: 'data',
  requiredPermissions: ['data:write'],
  parameters: {
    type: 'object',
    properties: {
      data: {
        type: 'array',
        description: 'Input data array to transform',
        items: { type: 'object', description: 'Data record' },
      },
      operations: {
        type: 'array',
        description: 'Transformation operations to apply',
        items: {
          type: 'object',
          description: 'Transformation operation',
          properties: {
            type: {
              type: 'string',
              description: 'Operation type',
              enum: ['map', 'filter', 'sort', 'group', 'join'],
            },
            config: { type: 'object', description: 'Operation configuration' },
          },
        },
      },
    },
    required: ['data', 'operations'],
  },
  async execute(
    input: {
      data: Array<Record<string, unknown>>;
      operations: Array<{ type: string; config: Record<string, unknown> }>;
    },
    context: ToolContext
  ): Promise<ToolResult<{ data: unknown[]; summary: Record<string, number> }>> {
    try {
      let result = [...input.data];
      const summary: Record<string, number> = {
        originalCount: result.length,
      };

      for (const operation of input.operations) {
        switch (operation.type) {
          case 'filter': {
            const field = operation.config.field as string;
            const operator = operation.config.operator as string;
            const value = operation.config.value;

            result = result.filter(item => {
              const fieldValue = item[field] as any;
              switch (operator) {
                case 'eq':
                  return fieldValue === value;
                case 'ne':
                  return fieldValue !== value;
                case 'gt':
                  return (fieldValue as any) > (value as any);
                case 'lt':
                  return (fieldValue as any) < (value as any);
                case 'gte':
                  return (fieldValue as any) >= (value as any);
                case 'lte':
                  return (fieldValue as any) <= (value as any);
                case 'contains':
                  return String(fieldValue).includes(String(value));
                case 'in':
                  return Array.isArray(value) && value.includes(fieldValue);
                default:
                  return true;
              }
            });
            summary.afterFilter = result.length;
            break;
          }

          case 'map': {
            const fields = operation.config.fields as Record<string, string>;
            result = result.map(item => {
              const mapped: Record<string, unknown> = {};
              for (const [newField, sourceField] of Object.entries(fields)) {
                mapped[newField] = item[sourceField];
              }
              return mapped;
            });
            break;
          }

          case 'sort': {
            const field = operation.config.field as string;
            const order = (operation.config.order as string) || 'asc';
            result.sort((a, b) => {
              const aVal = a[field] as any;
              const bVal = b[field] as any;
              if ((aVal as any) < (bVal as any))
                return order === 'asc' ? -1 : 1;
              if ((aVal as any) > (bVal as any))
                return order === 'asc' ? 1 : -1;
              return 0;
            });
            break;
          }

          case 'group': {
            const field = operation.config.field as string;
            const grouped = new Map<unknown, unknown[]>();
            for (const item of result) {
              const key = item[field];
              if (!grouped.has(key)) {
                grouped.set(key, []);
              }
              grouped.get(key)!.push(item);
            }
            result = Array.from(grouped.entries()).map(([key, items]) => ({
              [field]: key,
              count: items.length,
              items,
            }));
            summary.groupCount = result.length;
            break;
          }
        }
      }

      summary.finalCount = result.length;

      return {
        success: true,
        data: {
          data: result,
          summary,
        },
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to transform data',
      };
    }
  },
});

/**
 * Export Data Tool
 */
registerTool({
  name: 'export_data',
  description: 'Export workspace data in various formats',
  category: 'data',
  requiredPermissions: ['data:export'],
  requiresApproval: true, // Sensitive operation
  parameters: {
    type: 'object',
    properties: {
      source: {
        type: 'string',
        description: 'Data source to export',
        enum: ['messages', 'users', 'channels', 'workflows', 'analytics'],
      },
      format: {
        type: 'string',
        description: 'Export format',
        enum: ['json', 'csv', 'xlsx', 'pdf'],
      },
      filters: {
        type: 'object',
        description: 'Filter data before export',
      },
      dateRange: {
        type: 'object',
        description: 'Date range for export',
        properties: {
          from: { type: 'string', description: 'Start date (ISO 8601)' },
          to: { type: 'string', description: 'End date (ISO 8601)' },
        },
      },
    },
    required: ['source', 'format'],
  },
  async execute(
    input: {
      source: string;
      format: string;
      filters?: Record<string, unknown>;
      dateRange?: { from: string; to: string };
    },
    context: ToolContext
  ): Promise<
    ToolResult<{ exportId: string; downloadUrl: string; size: number }>
  > {
    try {
      const response = await fetch(
        `/api/workspaces/${context.workspaceId}/data/export`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            source: input.source,
            format: input.format,
            filters: input.filters,
            dateRange: input.dateRange,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Data export failed: ${response.statusText}`);
      }

      const exportResult = await response.json();

      return {
        success: true,
        data: {
          exportId: exportResult.id,
          downloadUrl: exportResult.downloadUrl,
          size: exportResult.size,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to export data',
      };
    }
  },
});

/**
 * Generate Analytics Tool
 */
registerTool({
  name: 'generate_analytics',
  description: 'Generate analytics and insights from workspace data',
  category: 'data',
  requiredPermissions: ['analytics:read'],
  cacheable: true,
  cacheTTL: 300,
  parameters: {
    type: 'object',
    properties: {
      metric: {
        type: 'string',
        description: 'Metric to analyze',
        enum: [
          'user_activity',
          'message_volume',
          'workflow_performance',
          'channel_engagement',
          'file_usage',
        ],
      },
      timeRange: {
        type: 'string',
        description: 'Time range for analysis',
        enum: ['1d', '7d', '30d', '90d', '1y'],
        default: '30d',
      },
      groupBy: {
        type: 'string',
        description: 'Group analytics by dimension',
        enum: ['day', 'week', 'month', 'user', 'channel'],
      },
      includeComparison: {
        type: 'boolean',
        description: 'Include comparison with previous period',
        default: false,
      },
    },
    required: ['metric'],
  },
  async execute(
    input: {
      metric: string;
      timeRange?: string;
      groupBy?: string;
      includeComparison?: boolean;
    },
    context: ToolContext
  ): Promise<
    ToolResult<{
      metric: string;
      data: Array<{ date: string; value: number }>;
      summary: { total: number; average: number; trend: string };
      comparison?: { change: number; changePercent: number };
    }>
  > {
    try {
      const params = new URLSearchParams({
        metric: input.metric,
        timeRange: input.timeRange || '30d',
      });
      if (input.groupBy) params.append('groupBy', input.groupBy);
      if (input.includeComparison) params.append('includeComparison', 'true');

      const response = await fetch(
        `/api/workspaces/${context.workspaceId}/analytics?${params.toString()}`
      );

      if (!response.ok) {
        throw new Error(`Analytics generation failed: ${response.statusText}`);
      }

      const analytics = await response.json();

      return {
        success: true,
        data: {
          metric: input.metric,
          data: analytics.data || [],
          summary: analytics.summary || {
            total: 0,
            average: 0,
            trend: 'stable',
          },
          comparison: analytics.comparison,
        },
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to generate analytics',
      };
    }
  },
});

/**
 * Create Report Tool
 */
registerTool({
  name: 'create_report',
  description:
    'Create a custom data report with multiple metrics and visualizations',
  category: 'data',
  requiredPermissions: ['report:create'],
  parameters: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description: 'Report name',
      },
      description: {
        type: 'string',
        description: 'Report description',
      },
      metrics: {
        type: 'array',
        description: 'Metrics to include in report',
        items: {
          type: 'object',
          description: 'Metric configuration object',
          properties: {
            type: { type: 'string', description: 'Metric type' },
            config: { type: 'object', description: 'Metric configuration' },
          },
        },
      },
      schedule: {
        type: 'string',
        description: 'Report schedule (cron expression)',
      },
      recipients: {
        type: 'array',
        description: 'User IDs to receive report',
        items: { type: 'string', description: 'User ID' },
      },
    },
    required: ['name', 'metrics'],
  },
  async execute(
    input: Record<string, unknown>,
    context: ToolContext
  ): Promise<ToolResult<{ reportId: string; status: string }>> {
    const { name, description, metrics, schedule, recipients } = input as {
      name: string;
      description?: string;
      metrics: Array<{ type: string; config: Record<string, unknown> }>;
      schedule?: string;
      recipients?: string[];
    };
    try {
      const response = await fetch(
        `/api/workspaces/${context.workspaceId}/reports`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name,
            description,
            config: {
              metrics,
              schedule,
              recipients,
            },
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Report creation failed: ${response.statusText}`);
      }

      const report = await response.json();

      return {
        success: true,
        data: {
          reportId: report.id,
          status: 'created',
        },
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to create report',
      };
    }
  },
});

/**
 * Calculate Statistics Tool
 */
registerTool({
  name: 'calculate_statistics',
  description: 'Calculate statistical metrics from a dataset',
  category: 'data',
  requiredPermissions: ['data:read'],
  parameters: {
    type: 'object',
    properties: {
      data: {
        type: 'array',
        description: 'Array of numeric values',
        items: { type: 'number', description: 'Numeric value' },
      },
      metrics: {
        type: 'array',
        description: 'Statistical metrics to calculate',
        items: {
          type: 'string',
          description: 'Statistical metric name',
          enum: [
            'mean',
            'median',
            'mode',
            'stddev',
            'variance',
            'min',
            'max',
            'percentiles',
          ],
        },
      },
    },
    required: ['data', 'metrics'],
  },
  async execute(
    input: Record<string, unknown>,
    context: ToolContext
  ): Promise<ToolResult<Record<string, number | number[]>>> {
    const { data, metrics } = input as {
      data: number[];
      metrics: string[];
    };
    try {
      const results: Record<string, number | number[]> = {};
      const sorted = [...data].sort((a, b) => a - b);

      for (const metric of metrics) {
        switch (metric) {
          case 'mean':
            results.mean = data.reduce((a, b) => a + b, 0) / data.length;
            break;

          case 'median':
            const mid = Math.floor(sorted.length / 2);
            results.median =
              sorted.length % 2 === 0
                ? (sorted[mid - 1] + sorted[mid]) / 2
                : sorted[mid];
            break;

          case 'mode': {
            const freq = new Map<number, number>();
            for (const val of data) {
              freq.set(val, (freq.get(val) || 0) + 1);
            }
            const maxFreq = Math.max(...freq.values());
            results.mode = Array.from(freq.entries())
              .filter(([, f]) => f === maxFreq)
              .map(([v]) => v)[0];
            break;
          }

          case 'min':
            results.min = Math.min(...data);
            break;

          case 'max':
            results.max = Math.max(...data);
            break;

          case 'stddev': {
            const mean = data.reduce((a, b) => a + b, 0) / data.length;
            const variance =
              data.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
              data.length;
            results.stddev = Math.sqrt(variance);
            break;
          }

          case 'variance': {
            const mean = data.reduce((a, b) => a + b, 0) / data.length;
            results.variance =
              data.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
              data.length;
            break;
          }

          case 'percentiles': {
            const p25 = sorted[Math.floor(sorted.length * 0.25)];
            const p50 = sorted[Math.floor(sorted.length * 0.5)];
            const p75 = sorted[Math.floor(sorted.length * 0.75)];
            const p95 = sorted[Math.floor(sorted.length * 0.95)];
            results.percentiles = [p25, p50, p75, p95];
            break;
          }
        }
      }

      return {
        success: true,
        data: results,
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to calculate statistics',
      };
    }
  },
});
