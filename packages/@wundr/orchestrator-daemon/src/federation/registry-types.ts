/**
 * Federation Registry Types
 *
 * Types specific to the FederationRegistry for multi-orchestrator coordination.
 */

/**
 * Orchestrator status for registry
 */
export type RegistryOrchestratorStatus = 'online' | 'offline' | 'busy' | 'draining';

/**
 * Orchestrator metadata for registry
 */
export interface RegistryOrchestratorMetadata {
  id: string;
  name: string;
  capabilities: string[];
  region: string;
  tier: string;
  maxSessions: number;
  currentSessions: number;
  tokensUsed: number;
  tokenLimit: number;
  status: RegistryOrchestratorStatus;
  lastHeartbeat: Date;
  registeredAt: Date;
  metadata?: Record<string, unknown>;
}

/**
 * Orchestrator metrics for registry
 */
export interface RegistryOrchestratorMetrics {
  id: string;
  load: number; // 0-1 (currentSessions / maxSessions)
  sessions: number;
  tokensUsed: number;
  tokenLimit: number;
  tokenUtilization: number; // 0-1 (tokensUsed / tokenLimit)
  status: RegistryOrchestratorStatus;
  lastHeartbeat: Date;
  uptime: number; // milliseconds
}

/**
 * Registry configuration
 */
export interface FederationRegistryConfig {
  redis: {
    host: string;
    port: number;
    password?: string;
    db?: number;
    keyPrefix: string;
  };
  heartbeatTimeout: number; // milliseconds (>30s = unhealthy)
  staleTimeout: number; // milliseconds (>5min = deregister)
  cleanupInterval: number; // milliseconds
}

/**
 * Registry events
 */
export interface FederationRegistryEvents {
  'orchestrator:registered': (metadata: RegistryOrchestratorMetadata) => void;
  'orchestrator:deregistered': (id: string) => void;
  'orchestrator:status_changed': (id: string, oldStatus: RegistryOrchestratorStatus, newStatus: RegistryOrchestratorStatus) => void;
  'orchestrator:unhealthy': (id: string, lastHeartbeat: Date) => void;
  'orchestrator:stale': (id: string, lastHeartbeat: Date) => void;
  'heartbeat:received': (id: string, timestamp: Date) => void;
}

/**
 * Query filters for orchestrator lookup
 */
export interface OrchestratorQuery {
  capabilities?: string[];
  region?: string;
  status?: RegistryOrchestratorStatus[];
  minAvailableSessions?: number;
  minAvailableTokens?: number;
}
