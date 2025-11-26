/**
 * Deployment Types
 *
 * Type definitions for deployment management including services, agents,
 * workflows, and integrations deployed to various environments.
 */

/**
 * Deployment type categories
 */
export type DeploymentType = 'service' | 'agent' | 'workflow' | 'integration';

/**
 * Deployment status states
 */
export type DeploymentStatus = 'deploying' | 'running' | 'stopped' | 'failed' | 'updating';

/**
 * Deployment environment targets
 */
export type DeploymentEnvironment = 'production' | 'staging' | 'development';

/**
 * Health status of a deployment
 */
export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy' | 'unknown';

/**
 * Resource configuration for a deployment
 */
export interface DeploymentResources {
  /** CPU allocation (e.g., "1000m" = 1 CPU) */
  cpu: string;
  /** Memory allocation (e.g., "512Mi", "2Gi") */
  memory: string;
}

/**
 * Deployment configuration settings
 */
export interface DeploymentConfig {
  /** Deployment region (e.g., "us-east-1", "eu-west-1") */
  region: string;
  /** Number of replicas/instances */
  replicas: number;
  /** Resource allocation */
  resources: DeploymentResources;
  /** Environment variables */
  env: Record<string, string>;
}

/**
 * Health check information
 */
export interface DeploymentHealth {
  /** Current health status */
  status: HealthStatus;
  /** Last health check timestamp */
  lastCheck: Date | null;
  /** Uptime in seconds */
  uptime: number;
}

/**
 * Deployment statistics
 */
export interface DeploymentStats {
  /** Total number of requests */
  requests: number;
  /** Number of errors */
  errors: number;
  /** P50 latency in milliseconds */
  latencyP50: number;
  /** P99 latency in milliseconds */
  latencyP99: number;
}

/**
 * Main deployment interface
 */
export interface Deployment {
  /** Unique deployment identifier */
  id: string;
  /** Workspace this deployment belongs to */
  workspaceId: string;
  /** Deployment name */
  name: string;
  /** Optional description */
  description: string | null;
  /** Type of deployment */
  type: DeploymentType;
  /** Current deployment status */
  status: DeploymentStatus;
  /** Target environment */
  environment: DeploymentEnvironment;
  /** Deployment version */
  version: string;
  /** Public URL if available */
  url: string | null;
  /** Configuration settings */
  config: DeploymentConfig;
  /** Health information */
  health: DeploymentHealth;
  /** Performance statistics */
  stats: DeploymentStats;
  /** Creation timestamp */
  createdAt: Date;
  /** Last update timestamp */
  updatedAt: Date;
  /** Last deployment timestamp */
  deployedAt: Date | null;
}

/**
 * Input for creating a new deployment
 */
export interface CreateDeploymentInput {
  /** Deployment name */
  name: string;
  /** Optional description */
  description?: string;
  /** Type of deployment */
  type: DeploymentType;
  /** Target environment */
  environment: DeploymentEnvironment;
  /** Configuration settings */
  config: DeploymentConfig;
}

/**
 * Input for updating a deployment
 */
export interface UpdateDeploymentInput {
  /** Updated name */
  name?: string;
  /** Updated description */
  description?: string;
  /** Updated configuration */
  config?: Partial<DeploymentConfig>;
}

/**
 * Log entry for a deployment
 */
export interface DeploymentLog {
  /** Log entry ID */
  id: string;
  /** Deployment ID */
  deploymentId: string;
  /** Log timestamp */
  timestamp: Date;
  /** Log level */
  level: 'debug' | 'info' | 'warn' | 'error';
  /** Log message */
  message: string;
  /** Optional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Filters for querying deployments
 */
export interface DeploymentFilters {
  /** Filter by status */
  status?: DeploymentStatus;
  /** Filter by environment */
  environment?: DeploymentEnvironment;
  /** Filter by type */
  type?: DeploymentType;
  /** Search query */
  search?: string;
}

/**
 * Configuration for deployment status display
 */
export const DEPLOYMENT_STATUS_CONFIG: Record<
  DeploymentStatus,
  {
    label: string;
    color: string;
    bgColor: string;
    icon: string;
  }
> = {
  deploying: {
    label: 'Deploying',
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-50 dark:bg-blue-950',
    icon: 'loading',
  },
  running: {
    label: 'Running',
    color: 'text-green-600 dark:text-green-400',
    bgColor: 'bg-green-50 dark:bg-green-950',
    icon: 'check',
  },
  stopped: {
    label: 'Stopped',
    color: 'text-gray-600 dark:text-gray-400',
    bgColor: 'bg-gray-50 dark:bg-gray-950',
    icon: 'pause',
  },
  failed: {
    label: 'Failed',
    color: 'text-red-600 dark:text-red-400',
    bgColor: 'bg-red-50 dark:bg-red-950',
    icon: 'error',
  },
  updating: {
    label: 'Updating',
    color: 'text-yellow-600 dark:text-yellow-400',
    bgColor: 'bg-yellow-50 dark:bg-yellow-950',
    icon: 'refresh',
  },
};

/**
 * Configuration for health status display
 */
export const HEALTH_STATUS_CONFIG: Record<
  HealthStatus,
  {
    label: string;
    color: string;
    icon: string;
  }
> = {
  healthy: {
    label: 'Healthy',
    color: 'text-green-600 dark:text-green-400',
    icon: 'check-circle',
  },
  degraded: {
    label: 'Degraded',
    color: 'text-yellow-600 dark:text-yellow-400',
    icon: 'alert-triangle',
  },
  unhealthy: {
    label: 'Unhealthy',
    color: 'text-red-600 dark:text-red-400',
    icon: 'x-circle',
  },
  unknown: {
    label: 'Unknown',
    color: 'text-gray-600 dark:text-gray-400',
    icon: 'help-circle',
  },
};

/**
 * Configuration for deployment type display
 */
export const DEPLOYMENT_TYPE_CONFIG: Record<
  DeploymentType,
  {
    label: string;
    icon: string;
    color: string;
  }
> = {
  service: {
    label: 'Service',
    icon: 'server',
    color: 'text-blue-600 dark:text-blue-400',
  },
  agent: {
    label: 'Agent',
    icon: 'bot',
    color: 'text-purple-600 dark:text-purple-400',
  },
  workflow: {
    label: 'Workflow',
    icon: 'workflow',
    color: 'text-green-600 dark:text-green-400',
  },
  integration: {
    label: 'Integration',
    icon: 'plug',
    color: 'text-orange-600 dark:text-orange-400',
  },
};
