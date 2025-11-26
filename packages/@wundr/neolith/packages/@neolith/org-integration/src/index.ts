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
  // Neolith Configuration
  NeolithConfig,
  NeolithConfigOptions,

  // Neolith Results
  NeolithResult,
  OrganizationManifest,
  VPDefinition,
  VPPersona,
  DisciplineDefinition,
  AgentDefinition,
  NeolithMetadata,

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
