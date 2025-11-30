/**
 * Charter Capabilities Types
 *
 * Type definitions for orchestrator charter capabilities management.
 *
 * @module types/charter-capabilities
 */

/**
 * Capability categories
 */
export type CapabilityCategory =
  | 'communication'
  | 'development'
  | 'analysis'
  | 'automation'
  | 'management';

/**
 * Permission levels for capabilities
 */
export type PermissionLevel = 'none' | 'read' | 'write' | 'admin';

/**
 * Orchestrator Capability
 *
 * Represents a single capability that can be enabled for an orchestrator.
 *
 * @interface
 * @property {string} id - Unique capability identifier
 * @property {string} name - Display name
 * @property {string} description - Description of what this capability does
 * @property {CapabilityCategory} category - Category this capability belongs to
 * @property {boolean} enabled - Whether this capability is enabled
 * @property {PermissionLevel} permissionLevel - Permission level for this capability
 * @property {Record<string, unknown>} [parameters] - Optional capability-specific parameters
 * @property {RateLimit} [rateLimit] - Optional rate limiting configuration
 */
export interface OrchestratorCapability {
  id: string;
  name: string;
  description: string;
  category: CapabilityCategory;
  enabled: boolean;
  permissionLevel: PermissionLevel;
  parameters?: Record<string, unknown>;
  rateLimit?: RateLimit;
}

/**
 * Rate limiting configuration
 *
 * @interface
 * @property {number} [maxPerHour] - Maximum executions per hour
 * @property {number} [maxPerDay] - Maximum executions per day
 * @property {number} [maxPerMinute] - Maximum executions per minute
 */
export interface RateLimit {
  maxPerHour?: number;
  maxPerDay?: number;
  maxPerMinute?: number;
}

/**
 * Capability definition for the UI
 *
 * @interface
 * @property {string} id - Capability ID matching OrchestratorCapability.id
 * @property {string} name - Display name
 * @property {string} description - Description
 * @property {CapabilityCategory} category - Category
 * @property {string} [icon] - Optional emoji or icon
 * @property {ParameterDefinition[]} [parameterDefinitions] - Parameter schema
 */
export interface CapabilityDefinition {
  id: string;
  name: string;
  description: string;
  category: CapabilityCategory;
  icon?: string;
  parameterDefinitions?: ParameterDefinition[];
}

/**
 * Parameter definition for capability configuration
 *
 * @interface
 * @property {string} key - Parameter key
 * @property {string} label - Display label
 * @property {string} type - Input type (text, number, boolean, select)
 * @property {unknown} [defaultValue] - Default value
 * @property {boolean} [required] - Whether this parameter is required
 * @property {string[]} [options] - Options for select type
 * @property {string} [description] - Help text
 */
export interface ParameterDefinition {
  key: string;
  label: string;
  type: 'text' | 'number' | 'boolean' | 'select';
  defaultValue?: unknown;
  required?: boolean;
  options?: string[];
  description?: string;
}

/**
 * Pre-defined capability definitions grouped by category
 */
export const CAPABILITY_DEFINITIONS: Record<CapabilityCategory, CapabilityDefinition[]> = {
  communication: [
    {
      id: 'send_messages',
      name: 'Send Messages',
      description: 'Send messages in channels and direct messages',
      category: 'communication',
      icon: '💬',
    },
    {
      id: 'manage_channels',
      name: 'Manage Channels',
      description: 'Create, update, and archive channels',
      category: 'communication',
      icon: '📢',
    },
    {
      id: 'schedule_meetings',
      name: 'Schedule Meetings',
      description: 'Schedule and manage meetings and huddles',
      category: 'communication',
      icon: '📅',
    },
  ],
  development: [
    {
      id: 'code_review',
      name: 'Code Review',
      description: 'Review code changes and provide feedback',
      category: 'development',
      icon: '👀',
    },
    {
      id: 'write_code',
      name: 'Write Code',
      description: 'Generate and modify code',
      category: 'development',
      icon: '💻',
    },
    {
      id: 'run_tests',
      name: 'Run Tests',
      description: 'Execute test suites and report results',
      category: 'development',
      icon: '✓',
    },
    {
      id: 'deploy',
      name: 'Deploy',
      description: 'Deploy applications and services',
      category: 'development',
      icon: '🚀',
    },
  ],
  analysis: [
    {
      id: 'data_analysis',
      name: 'Data Analysis',
      description: 'Analyze data sets and generate insights',
      category: 'analysis',
      icon: '📊',
    },
    {
      id: 'report_generation',
      name: 'Report Generation',
      description: 'Create and distribute reports',
      category: 'analysis',
      icon: '📝',
    },
    {
      id: 'trend_analysis',
      name: 'Trend Analysis',
      description: 'Identify and analyze trends in data',
      category: 'analysis',
      icon: '📈',
    },
  ],
  automation: [
    {
      id: 'task_scheduling',
      name: 'Task Scheduling',
      description: 'Schedule and manage automated tasks',
      category: 'automation',
      icon: '⏰',
    },
    {
      id: 'workflow_automation',
      name: 'Workflow Automation',
      description: 'Create and execute automated workflows',
      category: 'automation',
      icon: '🔄',
    },
    {
      id: 'notifications',
      name: 'Notifications',
      description: 'Send automated notifications and alerts',
      category: 'automation',
      icon: '🔔',
    },
  ],
  management: [
    {
      id: 'resource_allocation',
      name: 'Resource Allocation',
      description: 'Allocate and manage resources',
      category: 'management',
      icon: '🎯',
    },
    {
      id: 'team_coordination',
      name: 'Team Coordination',
      description: 'Coordinate team activities and tasks',
      category: 'management',
      icon: '👥',
    },
    {
      id: 'project_tracking',
      name: 'Project Tracking',
      description: 'Track project progress and milestones',
      category: 'management',
      icon: '📋',
    },
  ],
};

/**
 * Category display configuration
 */
export const CATEGORY_CONFIG: Record<
  CapabilityCategory,
  {
    label: string;
    description: string;
    color: string;
  }
> = {
  communication: {
    label: 'Communication',
    description: 'Messaging, channels, and meetings',
    color: 'bg-blue-100 text-blue-700 border-blue-200',
  },
  development: {
    label: 'Development',
    description: 'Code, testing, and deployment',
    color: 'bg-green-100 text-green-700 border-green-200',
  },
  analysis: {
    label: 'Analysis',
    description: 'Data analysis and reporting',
    color: 'bg-purple-100 text-purple-700 border-purple-200',
  },
  automation: {
    label: 'Automation',
    description: 'Automated workflows and tasks',
    color: 'bg-orange-100 text-orange-700 border-orange-200',
  },
  management: {
    label: 'Management',
    description: 'Resource and project management',
    color: 'bg-pink-100 text-pink-700 border-pink-200',
  },
};

/**
 * Get all capabilities flattened from definitions
 */
export function getAllCapabilityDefinitions(): CapabilityDefinition[] {
  return Object.values(CAPABILITY_DEFINITIONS).flat();
}

/**
 * Get capabilities by category
 */
export function getCapabilitiesByCategory(
  category: CapabilityCategory,
): CapabilityDefinition[] {
  return CAPABILITY_DEFINITIONS[category] || [];
}

/**
 * Get capability definition by ID
 */
export function getCapabilityDefinition(id: string): CapabilityDefinition | undefined {
  return getAllCapabilityDefinitions().find((def) => def.id === id);
}

/**
 * Create default capability from definition
 */
export function createDefaultCapability(
  definition: CapabilityDefinition,
): OrchestratorCapability {
  return {
    id: definition.id,
    name: definition.name,
    description: definition.description,
    category: definition.category,
    enabled: false,
    permissionLevel: 'read',
    parameters: {},
  };
}
