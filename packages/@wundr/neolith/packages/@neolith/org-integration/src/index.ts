/**
 * @neolith/org-integration
 *
 * Integration layer between Neolith App and @wundr/org-genesis package.
 * Provides utilities for migrating org-genesis results to Slack workspace resources.
 *
 * @packageDocumentation
 */

// ============================================================================
// Type Exports
// ============================================================================

export type {
  AgentDefinition,
  DisciplineDefinition,

  // Discipline Mapping
  DisciplineMapping,
  DisciplineMappingResult,

  // Common Types
  MappingStatus,
  MigrationOptions,
  MigrationResult,
  // Neolith Configuration
  NeolithConfig,
  NeolithConfigOptions,
  NeolithMetadata,

  // Neolith Results
  NeolithResult,
  OrganizationManifest,
  OrchestratorDefinition,

  // OrchestratorMapping
  OrchestratorMapping,
  OrchestratorMappingResult,
  OrchestratorPersona,
} from './types';

// ============================================================================
// Migration Exports
// ============================================================================

export {
  createChannelsFromDisciplines,
  createDisciplineMapper,
  createOrchestratorMapper,
  createOrchestratorUsersFromManifest,
  IDMapper,
  migrateOrgGenesisResult,
} from './migration';

// ============================================================================
// Utility Exports
// ============================================================================

export {
  deepClone,
  deepMerge,
  generateChannelName,
  generateDisplayName,
  // Slug generation
  generateSlug,
  generateUniqueId,

  // Validation
  isValidChannelName,
  isValidDisplayName,
  type SlugOptions,

  // Data transformation
  safeGet,

  // Hash utilities
  simpleHash,
} from './utils';

// ============================================================================
// Version
// ============================================================================

/**
 * Package version
 */
export const VERSION = '0.1.0';
