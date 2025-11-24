/**
 * @genesis/org-integration
 *
 * Integration layer between Genesis App and @wundr/org-genesis package.
 * Provides utilities for migrating org-genesis results to Slack workspace resources.
 *
 * @packageDocumentation
 */

// ============================================================================
// Type Exports
// ============================================================================

export type {
  // Genesis Configuration
  GenesisConfig,
  GenesisConfigOptions,

  // Genesis Results
  GenesisResult,
  OrganizationManifest,
  VPDefinition,
  VPPersona,
  DisciplineDefinition,
  AgentDefinition,
  GenesisMetadata,

  // VP Mapping
  VPMapping,
  VPMappingResult,

  // Discipline Mapping
  DisciplineMapping,
  DisciplineMappingResult,

  // Common Types
  MappingStatus,
  MigrationResult,
  MigrationOptions,
} from './types';

// ============================================================================
// Migration Exports
// ============================================================================

export {
  migrateOrgGenesisResult,
  createVPUsersFromManifest,
  createChannelsFromDisciplines,
  createVPMapper,
  createDisciplineMapper,
  IDMapper,
} from './migration';

// ============================================================================
// Utility Exports
// ============================================================================

export {
  // Slug generation
  generateSlug,
  generateChannelName,
  generateDisplayName,
  type SlugOptions,

  // Validation
  isValidChannelName,
  isValidDisplayName,

  // Hash utilities
  simpleHash,
  generateUniqueId,

  // Data transformation
  safeGet,
  deepClone,
  deepMerge,
} from './utils';

// ============================================================================
// Version
// ============================================================================

/**
 * Package version
 */
export const VERSION = '0.1.0';
