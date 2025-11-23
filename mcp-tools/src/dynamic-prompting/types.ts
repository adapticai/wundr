/**
 * Type definitions for the Dynamic Prompting System
 *
 * This module defines the core interfaces for configuring dynamic prompts,
 * personas, and context detection.
 *
 * @module mcp-tools/dynamic-prompting/types
 */

/**
 * Persona merging strategy options
 * - replace: Completely replace the current prompt with the persona prompt
 * - augment: Add persona instructions to the existing prompt
 * - layer: Layer multiple personas with priority ordering
 */
export type MergingStrategy = 'replace' | 'augment' | 'layer';

/**
 * Domain types for context detection
 */
export type DomainType =
  | 'frontend'
  | 'backend'
  | 'devops'
  | 'data-science'
  | 'machine-learning'
  | 'mobile'
  | 'security'
  | 'testing'
  | 'documentation'
  | 'general';

/**
 * Task types for context detection
 */
export type TaskType =
  | 'code-review'
  | 'implementation'
  | 'debugging'
  | 'refactoring'
  | 'testing'
  | 'documentation'
  | 'architecture'
  | 'planning'
  | 'optimization'
  | 'general';

/**
 * Priority levels for persona layering
 */
export type PersonaPriority = 'critical' | 'high' | 'medium' | 'low';

/**
 * Context signals used for detection
 */
export interface ContextSignals {
  /** File extensions present in the context */
  fileExtensions?: string[];
  /** Keywords found in the content */
  keywords?: string[];
  /** Directory patterns matched */
  directoryPatterns?: string[];
  /** Detected frameworks or libraries */
  frameworks?: string[];
  /** User-provided hints or explicit context */
  userHints?: string[];
  /** Task-related signals from user input */
  taskSignals?: string[];
}

/**
 * Detected context result
 */
export interface DetectedContext {
  /** Primary detected domain */
  domain: DomainType;
  /** Primary detected task type */
  taskType: TaskType;
  /** Confidence score for domain detection (0-1) */
  domainConfidence: number;
  /** Confidence score for task detection (0-1) */
  taskConfidence: number;
  /** Recommended persona IDs based on context */
  recommendedPersonas: string[];
  /** Raw signals used for detection */
  signals: ContextSignals;
  /** Additional metadata about the detection */
  metadata?: Record<string, unknown>;
}

/**
 * Persona configuration interface
 */
export interface PersonaConfig {
  /** Unique identifier for the persona */
  id: string;
  /** Display name for the persona */
  name: string;
  /** Brief description of the persona's purpose */
  description: string;
  /** The system prompt content for this persona */
  systemPrompt: string;
  /** Domains this persona is suited for */
  domains: DomainType[];
  /** Task types this persona excels at */
  taskTypes: TaskType[];
  /** Priority level when layering personas */
  priority: PersonaPriority;
  /** Tags for filtering and searching personas */
  tags?: string[];
  /** Whether this persona can be combined with others */
  combinable?: boolean;
  /** Personas that conflict with this one */
  conflictsWith?: string[];
  /** Personas that enhance this one */
  enhancedBy?: string[];
  /** Version for tracking updates */
  version?: string;
  /** Custom metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Dynamic prompt configuration
 */
export interface DynamicPromptConfig {
  /** Whether to enable automatic context detection */
  enableAutoDetection: boolean;
  /** Default merging strategy when combining personas */
  defaultMergingStrategy: MergingStrategy;
  /** Minimum confidence threshold for auto-applying personas */
  confidenceThreshold: number;
  /** Maximum number of personas to layer */
  maxLayeredPersonas: number;
  /** Default persona ID when no context is detected */
  fallbackPersonaId?: string;
  /** Custom personas to include in addition to built-in ones */
  customPersonas?: PersonaConfig[];
  /** Persona IDs to exclude from auto-selection */
  excludedPersonas?: string[];
  /** Whether to allow combining conflicting personas */
  allowConflicts?: boolean;
  /** Custom context detection rules */
  customDetectionRules?: DetectionRule[];
}

/**
 * Custom detection rule for extending context detection
 */
export interface DetectionRule {
  /** Rule identifier */
  id: string;
  /** Rule name */
  name: string;
  /** Patterns to match (regex strings) */
  patterns: string[];
  /** File extensions to match */
  fileExtensions?: string[];
  /** Keywords to look for */
  keywords?: string[];
  /** Domain to assign when rule matches */
  assignDomain?: DomainType;
  /** Task type to assign when rule matches */
  assignTaskType?: TaskType;
  /** Personas to recommend when rule matches */
  recommendPersonas?: string[];
  /** Weight/priority of this rule (higher = more important) */
  weight?: number;
}

/**
 * Prompt resolution result
 */
export interface ResolvedPrompt {
  /** The final resolved system prompt */
  systemPrompt: string;
  /** Active personas that contributed to the prompt */
  activePersonas: PersonaConfig[];
  /** Merging strategy that was used */
  mergingStrategy: MergingStrategy;
  /** Context that was detected */
  detectedContext: DetectedContext;
  /** Whether the prompt was auto-generated or manually specified */
  isAutoGenerated: boolean;
  /** Timestamp of resolution */
  resolvedAt: Date;
  /** Resolution metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Persona library interface
 */
export interface PersonaLibrary {
  /** Get all available personas */
  getAll(): PersonaConfig[];
  /** Get a persona by ID */
  getById(id: string): PersonaConfig | undefined;
  /** Get personas by domain */
  getByDomain(domain: DomainType): PersonaConfig[];
  /** Get personas by task type */
  getByTaskType(taskType: TaskType): PersonaConfig[];
  /** Search personas by query */
  search(query: string): PersonaConfig[];
  /** Add a custom persona */
  add(persona: PersonaConfig): void;
  /** Remove a persona by ID */
  remove(id: string): boolean;
  /** Check if a persona exists */
  exists(id: string): boolean;
}

/**
 * Dynamic prompt manager arguments for MCP integration
 */
export interface DynamicPromptingArgs {
  /** Action to perform */
  action:
    | 'resolve'
    | 'detect-context'
    | 'list-personas'
    | 'get-persona'
    | 'add-persona'
    | 'remove-persona';
  /** Content to analyze for context detection */
  content?: string;
  /** File paths for context signals */
  filePaths?: string[];
  /** Explicit persona IDs to use */
  personaIds?: string[];
  /** Merging strategy override */
  mergingStrategy?: MergingStrategy;
  /** User hints for context detection */
  userHints?: string[];
  /** Persona configuration for add action */
  persona?: PersonaConfig;
  /** Persona ID for get/remove actions */
  personaId?: string;
  /** Search query for list action */
  query?: string;
  /** Domain filter for list action */
  domain?: DomainType;
  /** Task type filter for list action */
  taskType?: TaskType;
}

/**
 * Result type for dynamic prompting operations
 */
export interface DynamicPromptingResult {
  /** Whether the operation succeeded */
  success: boolean;
  /** Action that was performed */
  action: DynamicPromptingArgs['action'];
  /** Result message */
  message: string;
  /** Resolved prompt (for resolve action) */
  resolvedPrompt?: ResolvedPrompt;
  /** Detected context (for detect-context action) */
  detectedContext?: DetectedContext;
  /** Personas list (for list-personas action) */
  personas?: PersonaConfig[];
  /** Single persona (for get-persona action) */
  persona?: PersonaConfig;
  /** Error message if operation failed */
  error?: string;
  /** Additional details */
  details?: unknown;
}
