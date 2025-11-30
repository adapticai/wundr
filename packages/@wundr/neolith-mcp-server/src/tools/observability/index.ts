/**
 * Observability Tools
 *
 * MCP tools for monitoring system health, orchestrator metrics,
 * alerts, and distributed node status.
 *
 * @module @wundr.io/neolith-mcp-server/tools/observability
 */

// ============================================================================
// Tool Exports
// ============================================================================

export {
  getSystemHealth,
  getSystemHealthInputSchema,
  type GetSystemHealthInput,
  type SystemHealthData,
  type GetSystemHealthResponse,
} from './get-system-health';

export {
  getOrchestratorMetrics,
  getOrchestratorMetricsInputSchema,
  type GetOrchestratorMetricsInput,
  type OrchestratorMetricsData,
  type MetricDataPoint,
  type GetOrchestratorMetricsResponse,
} from './get-orchestrator-metrics';

export {
  getActiveAlerts,
  getActiveAlertsInputSchema,
  type GetActiveAlertsInput,
  type Alert,
  type GetActiveAlertsResponse,
} from './get-active-alerts';

export {
  acknowledgeAlert,
  acknowledgeAlertInputSchema,
  type AcknowledgeAlertInput,
  type AcknowledgeAlertData,
  type AcknowledgeAlertResponse,
} from './acknowledge-alert';

export {
  getNodeStatus,
  getNodeStatusInputSchema,
  type GetNodeStatusInput,
  type NodeStatus,
  type GetNodeStatusResponse,
} from './get-node-status';

// ============================================================================
// Tool Collections
// ============================================================================

import type { McpTool } from '../registry';
import { zodToJsonSchema } from '../schemas';
import {
  getSystemHealth,
  getSystemHealthInputSchema,
  type GetSystemHealthInput,
} from './get-system-health';
import {
  getOrchestratorMetrics,
  getOrchestratorMetricsInputSchema,
  type GetOrchestratorMetricsInput,
} from './get-orchestrator-metrics';
import {
  getActiveAlerts,
  getActiveAlertsInputSchema,
  type GetActiveAlertsInput,
} from './get-active-alerts';
import {
  acknowledgeAlert,
  acknowledgeAlertInputSchema,
  type AcknowledgeAlertInput,
} from './acknowledge-alert';
import {
  getNodeStatus,
  getNodeStatusInputSchema,
  type GetNodeStatusInput,
} from './get-node-status';
import type { NeolithAPIClient } from '../../types/index';

/**
 * Get System Health Tool Definition
 */
export const getSystemHealthTool: McpTool = {
  name: 'neolith-get-system-health',
  description: 'Get overall system health status including active orchestrators, total sessions, and error rates',
  category: 'observability',
  inputSchema: zodToJsonSchema(getSystemHealthInputSchema),
  zodSchema: getSystemHealthInputSchema,
  handler: async (input: unknown) => {
    const apiClient = (input as any).apiClient as NeolithAPIClient;
    const validatedInput = getSystemHealthInputSchema.parse(input);
    return getSystemHealth(apiClient, validatedInput);
  },
};

/**
 * Get Orchestrator Metrics Tool Definition
 */
export const getOrchestratorMetricsTool: McpTool = {
  name: 'neolith-get-orchestrator-metrics',
  description: 'Get detailed metrics for a specific orchestrator over a time range (sessions, tokens, latency, errors)',
  category: 'observability',
  inputSchema: zodToJsonSchema(getOrchestratorMetricsInputSchema),
  zodSchema: getOrchestratorMetricsInputSchema,
  handler: async (input: unknown) => {
    const apiClient = (input as any).apiClient as NeolithAPIClient;
    const validatedInput = getOrchestratorMetricsInputSchema.parse(input);
    return getOrchestratorMetrics(apiClient, validatedInput);
  },
};

/**
 * Get Active Alerts Tool Definition
 */
export const getActiveAlertsTool: McpTool = {
  name: 'neolith-get-active-alerts',
  description: 'List all active health alerts in the system, optionally filtered by severity and orchestrator ID',
  category: 'observability',
  inputSchema: zodToJsonSchema(getActiveAlertsInputSchema),
  zodSchema: getActiveAlertsInputSchema,
  handler: async (input: unknown) => {
    const apiClient = (input as any).apiClient as NeolithAPIClient;
    const validatedInput = getActiveAlertsInputSchema.parse(input);
    return getActiveAlerts(apiClient, validatedInput);
  },
};

/**
 * Acknowledge Alert Tool Definition
 */
export const acknowledgeAlertTool: McpTool = {
  name: 'neolith-acknowledge-alert',
  description: 'Acknowledge a specific health alert to mark it as seen/handled',
  category: 'observability',
  inputSchema: zodToJsonSchema(acknowledgeAlertInputSchema),
  zodSchema: acknowledgeAlertInputSchema,
  handler: async (input: unknown) => {
    const apiClient = (input as any).apiClient as NeolithAPIClient;
    const validatedInput = acknowledgeAlertInputSchema.parse(input);
    return acknowledgeAlert(apiClient, validatedInput);
  },
};

/**
 * Get Node Status Tool Definition
 */
export const getNodeStatusTool: McpTool = {
  name: 'neolith-get-node-status',
  description: 'Get the status of distributed nodes in the system (health, sessions, load, uptime)',
  category: 'observability',
  inputSchema: zodToJsonSchema(getNodeStatusInputSchema),
  zodSchema: getNodeStatusInputSchema,
  handler: async (input: unknown) => {
    const apiClient = (input as any).apiClient as NeolithAPIClient;
    const validatedInput = getNodeStatusInputSchema.parse(input);
    return getNodeStatus(apiClient, validatedInput);
  },
};

/**
 * All observability tools
 */
export const observabilityTools: McpTool[] = [
  getSystemHealthTool,
  getOrchestratorMetricsTool,
  getActiveAlertsTool,
  acknowledgeAlertTool,
  getNodeStatusTool,
];

/**
 * Observability tool names
 */
export const OBSERVABILITY_TOOL_NAMES = {
  GET_SYSTEM_HEALTH: 'neolith-get-system-health',
  GET_ORCHESTRATOR_METRICS: 'neolith-get-orchestrator-metrics',
  GET_ACTIVE_ALERTS: 'neolith-get-active-alerts',
  ACKNOWLEDGE_ALERT: 'neolith-acknowledge-alert',
  GET_NODE_STATUS: 'neolith-get-node-status',
} as const;

/**
 * Observability tool descriptions
 */
export const OBSERVABILITY_TOOL_DESCRIPTIONS = {
  [OBSERVABILITY_TOOL_NAMES.GET_SYSTEM_HEALTH]: getSystemHealthTool.description,
  [OBSERVABILITY_TOOL_NAMES.GET_ORCHESTRATOR_METRICS]: getOrchestratorMetricsTool.description,
  [OBSERVABILITY_TOOL_NAMES.GET_ACTIVE_ALERTS]: getActiveAlertsTool.description,
  [OBSERVABILITY_TOOL_NAMES.ACKNOWLEDGE_ALERT]: acknowledgeAlertTool.description,
  [OBSERVABILITY_TOOL_NAMES.GET_NODE_STATUS]: getNodeStatusTool.description,
} as const;
