/**
 * Type definitions for AI Integration system
 */

export interface AIIntegrationConfig {
  claudeFlow: ClaudeFlowConfig;
  mcpTools: MCPToolsConfig;
  neural: NeuralConfig;
  swarm: SwarmConfig;
  memory: MemoryConfig;
  agents: AgentConfig;
  performance: PerformanceConfig;
  github: GitHubConfig;
}

export interface ClaudeFlowConfig {
  sessionPath?: string;
  maxConcurrentAgents: number;
  defaultTopology: TopologyType;
  hooks: {
    preTask: boolean;
    postTask: boolean;
    sessionRestore: boolean;
    exportMetrics: boolean;
  };
  sparc: {
    enabledPhases: SPARCPhase[];
    parallelExecution: boolean;
    autoOptimization: boolean;
  };
}

export interface MCPToolsConfig {
  registryPath: string;
  enabledTools: string[];
  autoDiscovery: boolean;
  cacheResults: boolean;
  timeout: number;
}

export interface NeuralConfig {
  modelsPath: string;
  enabledModels: string[];
  trainingInterval: number;
  patternRecognition: boolean;
  crossSessionLearning: boolean;
  maxMemorySize: number;
}

export interface SwarmConfig {
  defaultTopology: TopologyType;
  maxSwarmSize: number;
  consensusThreshold: number;
  faultTolerance: 'low' | 'medium' | 'high';
  adaptiveScaling: boolean;
}

export interface MemoryConfig {
  persistencePath: string;
  maxSessionMemory: number;
  compressionEnabled: boolean;
  crossSessionEnabled: boolean;
  retentionPolicy: {
    shortTerm: number; // hours
    longTerm: number; // days
    permanent: string[]; // patterns to keep permanently
  };
}

export interface AgentConfig {
  maxConcurrentAgents: number;
  spawningStrategy: 'on-demand' | 'pre-spawn' | 'adaptive';
  healthCheckInterval: number;
  autoRecovery: boolean;
  loadBalancing: boolean;
}

export interface PerformanceConfig {
  metricsCollection: boolean;
  bottleneckDetection: boolean;
  autoOptimization: boolean;
  alertThresholds: {
    responseTime: number;
    errorRate: number;
    memoryUsage: number;
  };
}

export interface GitHubConfig {
  token?: string;
  webhookSecret?: string;
  autoReview: boolean;
  swarmReview: boolean;
  integrationBranches: string[];
}

// Agent Types
export type AgentType = 
  // Core Development
  | 'coder' | 'reviewer' | 'tester' | 'planner' | 'researcher'
  // Swarm Coordination
  | 'hierarchical-coordinator' | 'mesh-coordinator' | 'adaptive-coordinator' 
  | 'collective-intelligence-coordinator' | 'swarm-memory-manager'
  // Consensus & Distributed
  | 'byzantine-coordinator' | 'raft-manager' | 'gossip-coordinator' 
  | 'consensus-builder' | 'crdt-synchronizer' | 'quorum-manager' | 'security-manager'
  // Performance & Optimization
  | 'perf-analyzer' | 'performance-benchmarker' | 'task-orchestrator' 
  | 'memory-coordinator' | 'smart-agent'
  // GitHub & Repository
  | 'github-modes' | 'pr-manager' | 'code-review-swarm' | 'issue-tracker' 
  | 'release-manager' | 'workflow-automation' | 'project-board-sync' 
  | 'repo-architect' | 'multi-repo-swarm'
  // SPARC Methodology
  | 'sparc-coord' | 'sparc-coder' | 'specification' | 'pseudocode' 
  | 'architecture' | 'refinement'
  // Specialized Development
  | 'backend-dev' | 'mobile-dev' | 'ml-developer' | 'cicd-engineer' 
  | 'api-docs' | 'system-architect' | 'code-analyzer' | 'base-template-generator'
  // Testing & Validation
  | 'tdd-london-swarm' | 'production-validator'
  // Migration & Planning
  | 'migration-planner' | 'swarm-init';

export interface Agent {
  id: string;
  type: AgentType;
  category: string;
  capabilities: string[];
  status: AgentStatus;
  topology: TopologyType;
  sessionId: string;
  createdAt: Date;
  lastActivity?: Date;
  metrics: AgentMetrics;
  context?: AgentContext;
}

export type AgentStatus = 'initializing' | 'active' | 'busy' | 'idle' | 'error' | 'shutdown';

export interface AgentMetrics {
  tasksCompleted: number;
  successRate: number;
  averageResponseTime: number;
  memoryUsage?: number;
  lastErrorAt?: Date;
  healthScore?: number;
}

// Topology Types
export type TopologyType = 'mesh' | 'hierarchical' | 'adaptive' | 'ring' | 'star';

export interface SwarmTopology {
  type: TopologyType;
  maxAgents: number;
  connectionPattern: string;
  coordinationStyle: string;
  faultTolerance: 'low' | 'medium' | 'high';
  metadata?: TopologyMetadata;
}

// SPARC Methodology
export type SPARCPhase = 'specification' | 'pseudocode' | 'architecture' | 'refinement' | 'completion';

export interface SPARCExecution {
  phases: SPARCPhase[];
  currentPhase: SPARCPhase;
  results: Record<SPARCPhase, SPARCResult>;
  startedAt: Date;
  completedAt?: Date;
}

// Task Management
export interface Task {
  id: string;
  title: string;
  description: string;
  type: TaskType;
  priority: TaskPriority;
  status: TaskStatus;
  assignedAgents: string[];
  requiredCapabilities: string[];
  context: TaskContext;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  result?: TaskResult;
  error?: TaskError;
}

export type TaskType = 'coding' | 'review' | 'testing' | 'analysis' | 'documentation' | 'deployment' | 'optimization';
export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';
export type TaskStatus = 'pending' | 'assigned' | 'in-progress' | 'completed' | 'failed' | 'cancelled';

// Memory Management
export interface MemoryEntry {
  id: string;
  type: MemoryType;
  content: any;
  sessionId: string;
  agentId?: string;
  taskId?: string;
  createdAt: Date;
  expiresAt?: Date;
  tags: string[];
  metadata: MemoryMetadata;
}

export type MemoryType = 'session' | 'agent' | 'task' | 'pattern' | 'consensus' | 'performance';

export interface MemoryContext {
  sessionMemory: MemoryEntry[];
  agentMemory: Map<string, MemoryEntry[]>;
  taskMemory: Map<string, MemoryEntry[]>;
  patterns: RecognizedPattern[];
}

// Neural Network Types
export interface NeuralModel {
  id: string;
  name: string;
  type: ModelType;
  status: ModelStatus;
  trainingData: TrainingDataPoint[];
  parameters: ModelParameters;
  performance: ModelPerformance;
  createdAt: Date;
  updatedAt: Date;
}

export type ModelType = 'pattern-recognition' | 'performance-prediction' | 'task-classification' | 'agent-selection';
export type ModelStatus = 'training' | 'ready' | 'updating' | 'error';

export interface ModelPerformance {
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  trainingLoss: number;
  validationLoss: number;
}

// MCP Tools
export interface MCPTool {
  id: string;
  name: string;
  category: string;
  capabilities: string[];
  status: 'available' | 'busy' | 'error';
  metadata: MCPToolMetadata;
}

// System Status
export type HiveStatus = 'initializing' | 'ready' | 'busy' | 'error' | 'shutting-down' | 'shutdown';

export interface OperationResult {
  success: boolean;
  message: string;
  data?: OperationResultData;
  error?: OperationError;
  timestamp?: Date;
}

// Performance Metrics
export interface PerformanceMetrics {
  responseTime: number;
  throughput: number;
  errorRate: number;
  memoryUsage: number;
  cpuUsage: number;
  activeConnections: number;
  queueLength: number;
}

export interface Bottleneck {
  type: 'memory' | 'cpu' | 'network' | 'agent' | 'task-queue';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  affectedComponents: string[];
  suggestedActions: string[];
  detectedAt: Date;
}

// GitHub Integration
export interface GitHubIntegrationConfig {
  repositories: string[];
  webhooks: GitHubWebhook[];
  automation: GitHubAutomation;
}

export interface GitHubWebhook {
  event: string;
  url: string;
  secret: string;
  actions: string[];
}

export interface GitHubAutomation {
  autoReview: boolean;
  autoMerge: boolean;
  swarmReview: boolean;
  qualityGates: string[];
}

// Events
export interface AIEvent {
  id: string;
  type: string;
  source: string;
  data: EventData;
  timestamp: Date;
}

export interface EventHandler {
  (event: AIEvent): Promise<void>;
}

// Additional interfaces to replace any types
export interface AgentContext {
  readonly sessionId: string;
  readonly userId?: string;
  readonly requestId: string;
  readonly configuration: Record<string, unknown>;
  readonly state: Record<string, unknown>;
}

export interface TopologyMetadata {
  readonly algorithm: string;
  readonly parameters: Record<string, unknown>;
  readonly constraints: Record<string, unknown>;
  readonly optimizations: string[];
}

export interface SPARCResult {
  readonly phase: SPARCPhase;
  readonly success: boolean;
  readonly artifacts: Artifact[];
  readonly nextPhase?: SPARCPhase;
  readonly metrics: PhaseMetrics;
}

export interface Artifact {
  readonly type: 'specification' | 'pseudocode' | 'architecture' | 'code' | 'tests' | 'documentation';
  readonly content: string;
  readonly metadata: Record<string, unknown>;
}

export interface PhaseMetrics {
  readonly duration: number;
  readonly resourcesUsed: ResourceUsage;
  readonly qualityScore: number;
}

export interface ResourceUsage {
  readonly memory: number;
  readonly cpu: number;
  readonly tokens: number;
}

export interface TaskContext {
  readonly parentTaskId?: string;
  readonly dependencies: string[];
  readonly configuration: Record<string, unknown>;
  readonly environment: Record<string, unknown>;
}

export interface TaskResult {
  readonly data: unknown;
  readonly metadata: Record<string, unknown>;
  readonly artifacts: Artifact[];
  readonly metrics: TaskMetrics;
}

export interface TaskError {
  readonly code: string;
  readonly message: string;
  readonly stack?: string;
  readonly context: Record<string, unknown>;
}

export interface TaskMetrics {
  readonly startTime: Date;
  readonly endTime: Date;
  readonly duration: number;
  readonly resourcesUsed: ResourceUsage;
}

export interface MemoryMetadata {
  readonly priority: number;
  readonly source: string;
  readonly compression: boolean;
  readonly encryption: boolean;
  readonly checksum: string;
}

export interface RecognizedPattern {
  readonly id: string;
  readonly type: 'code' | 'behavior' | 'performance' | 'error';
  readonly confidence: number;
  readonly occurrences: PatternOccurrence[];
  readonly suggestions: string[];
}

export interface PatternOccurrence {
  readonly location: string;
  readonly context: Record<string, unknown>;
  readonly timestamp: Date;
}

export interface TrainingDataPoint {
  readonly input: Record<string, unknown>;
  readonly output: Record<string, unknown>;
  readonly metadata: Record<string, unknown>;
  readonly quality: number;
}

export interface ModelParameters {
  readonly layers: LayerConfiguration[];
  readonly optimizer: OptimizerConfiguration;
  readonly hyperparameters: Record<string, number>;
  readonly regularization: RegularizationConfiguration;
}

export interface LayerConfiguration {
  readonly type: string;
  readonly size: number;
  readonly activation: string;
  readonly dropout?: number;
}

export interface OptimizerConfiguration {
  readonly type: 'adam' | 'sgd' | 'rmsprop';
  readonly learningRate: number;
  readonly momentum?: number;
  readonly beta1?: number;
  readonly beta2?: number;
}

export interface RegularizationConfiguration {
  readonly l1?: number;
  readonly l2?: number;
  readonly dropout?: number;
}

export interface MCPToolMetadata {
  readonly version: string;
  readonly dependencies: string[];
  readonly configuration: Record<string, unknown>;
  readonly permissions: string[];
}

export interface OperationResultData {
  readonly type: string;
  readonly payload: Record<string, unknown>;
  readonly timestamp: Date;
  readonly source: string;
}

export interface OperationError {
  readonly code: string;
  readonly message: string;
  readonly details?: Record<string, unknown>;
  readonly recoverable: boolean;
}

export interface EventData {
  readonly category: string;
  readonly action: string;
  readonly properties: Record<string, unknown>;
  readonly metadata: Record<string, unknown>;
}