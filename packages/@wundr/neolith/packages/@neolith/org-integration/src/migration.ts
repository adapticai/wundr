/**
 * @neolith/org-integration - Migration Functions
 *
 * Functions for migrating org-genesis results to Slack workspace resources.
 */


import type {
  DisciplineDefinition,
  DisciplineMapping,
  DisciplineMappingResult,
  MigrationOptions,
  MigrationResult,
  NeolithResult,
  OrchestratorDefinition,
  OrchestratorMapping,
  OrchestratorMappingResult,
} from './types';
import {
  createDisciplineMapper,
  createOrchestratorMapper,
  generateChannelName,
  generateDisplayName,
  IDMapper,
} from './utils';

// ============================================================================
// Main Migration Function
// ============================================================================

/**
 * Migrate an org-genesis result to Slack workspace resources.
 *
 * This is the main entry point for converting org-genesis output into
 * Slack users (for Orchestrators) and channels (for disciplines).
 *
 * @param neolithResult - The result from org-genesis generation
 * @param options - Migration options
 * @returns Migration result with all mappings
 *
 * @example
 * ```ts
 * const neolithResult = await runOrgGenesis(config);
 * const migrationResult = await migrateOrgGenesisResult(neolithResult, {
 *   workspaceId: 'T12345678',
 *   channelPrefix: 'neolith',
 *   dryRun: true,
 * });
 * ```
 */
export async function migrateOrgGenesisResult(
  neolithResult: NeolithResult,
  options: MigrationOptions
): Promise<MigrationResult> {
  const warnings: string[] = [];
  const startTime = Date.now();

  // Validate input
  if (!neolithResult.manifest) {
    throw new Error('Invalid Neolith result: missing manifest');
  }

  if (options.verbose) {
    logMigrationStart(neolithResult, options);
  }

  // Create Orchestrator mappings
  let orchestratorMappings: OrchestratorMappingResult;
  if (options.skipOrchestrators) {
    orchestratorMappings = createEmptyOrchestratorMappingResult();
    warnings.push('Orchestrator creation skipped by option');
  } else {
    orchestratorMappings = await createOrchestratorUsersFromManifest(
      neolithResult.orchestrators,
      neolithResult.manifest.id,
      options
    );
  }

  // Create discipline/channel mappings
  let disciplineMappings: DisciplineMappingResult;
  if (options.skipChannels) {
    disciplineMappings = createEmptyDisciplineMappingResult();
    warnings.push('Channel creation skipped by option');
  } else {
    disciplineMappings = await createChannelsFromDisciplines(
      neolithResult.disciplines,
      options
    );
  }

  // Determine overall status
  const status = determineOverallStatus(orchestratorMappings, disciplineMappings);

  if (options.verbose) {
    logMigrationComplete(
      orchestratorMappings,
      disciplineMappings,
      Date.now() - startTime
    );
  }

  return {
    orchestratorMappings,
    disciplineMappings,
    status,
    migratedAt: new Date().toISOString(),
    warnings,
  };
}

// ============================================================================
// OrchestratorUser Creation
// ============================================================================

/**
 * Create Slack users from Orchestrator definitions in the manifest.
 *
 * @param orchestrators - Array of Orchestrator definitions from org-genesis
 * @param organizationId - ID of the organization
 * @param options - Migration options
 * @returns Orchestrator mapping result
 */
export async function createOrchestratorUsersFromManifest(
  orchestrators: OrchestratorDefinition[],
  organizationId: string,
  options: MigrationOptions
): Promise<OrchestratorMappingResult> {
  const mappings: OrchestratorMapping[] = [];
  const orchestratorMapper = createOrchestratorMapper();

  for (const orchestrator of orchestrators) {
    const mapping = await createSingleOrchestratorUser(orchestrator, organizationId, options);
    mappings.push(mapping);

    if (mapping.status === 'success' && mapping.slackUserId) {
      orchestratorMapper.addMapping(orchestrator.id, mapping.slackUserId);
    }
  }

  const successful = mappings.filter(m => m.status === 'success').length;
  const failed = mappings.filter(m => m.status === 'failed').length;

  return {
    mappings,
    total: orchestrators.length,
    successful,
    failed,
    mappedAt: new Date().toISOString(),
  };
}

/**
 * Create a single Orchestrator user in Slack.
 *
 * @param orchestrator - Orchestrator definition
 * @param organizationId - Organization ID
 * @param options - Migration options
 * @returns Orchestrator mapping
 */
async function createSingleOrchestratorUser(
  orchestrator: OrchestratorDefinition,
  _organizationId: string,
  options: MigrationOptions
): Promise<OrchestratorMapping> {
  const displayName = generateDisplayName(orchestrator.name);

  // In dry run mode, return a pending mapping
  if (options.dryRun) {
    return {
      orchestrator,
      slackUserId: `dry-run-${orchestrator.id}`,
      slackDisplayName: displayName,
      status: 'pending',
    };
  }

  try {
    // SKELETON: Actual Slack API integration will be implemented here
    // This will use the Slack API to create a bot user or app user
    // representing the Orchestrator in the workspace

    // TODO: Implement actual Slack user creation
    // const slackUser = await slackClient.createBotUser({
    //   workspaceId: options.workspaceId,
    //   displayName: displayName,
    //   realName: orchestrator.title,
    //   // ... other user properties
    // });

    // For now, return a placeholder successful mapping
    const slackUserId = `U${generatePlaceholderId(orchestrator.id)}`;

    return {
      orchestrator,
      slackUserId,
      slackDisplayName: displayName,
      status: 'success',
    };
  } catch (error) {
    return {
      orchestrator,
      slackUserId: '',
      slackDisplayName: displayName,
      status: 'failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================================================
// Channel Creation
// ============================================================================

/**
 * Create Slack channels from discipline definitions.
 *
 * @param disciplines - Array of discipline definitions from org-genesis
 * @param options - Migration options
 * @returns Discipline mapping result
 */
export async function createChannelsFromDisciplines(
  disciplines: DisciplineDefinition[],
  options: MigrationOptions
): Promise<DisciplineMappingResult> {
  const mappings: DisciplineMapping[] = [];
  const disciplineMapper = createDisciplineMapper();

  for (const discipline of disciplines) {
    const mapping = await createSingleChannel(discipline, options);
    mappings.push(mapping);

    if (mapping.status === 'success' && mapping.slackChannelId) {
      disciplineMapper.addMapping(discipline.id, mapping.slackChannelId);
    }
  }

  const successful = mappings.filter(m => m.status === 'success').length;
  const failed = mappings.filter(m => m.status === 'failed').length;

  return {
    mappings,
    total: disciplines.length,
    successful,
    failed,
    mappedAt: new Date().toISOString(),
  };
}

/**
 * Create a single Slack channel for a discipline.
 *
 * @param discipline - Discipline definition
 * @param options - Migration options
 * @returns Discipline mapping
 */
async function createSingleChannel(
  discipline: DisciplineDefinition,
  options: MigrationOptions
): Promise<DisciplineMapping> {
  const channelName = generateChannelName(
    discipline.name,
    options.channelPrefix
  );

  // In dry run mode, return a pending mapping
  if (options.dryRun) {
    return {
      discipline,
      slackChannelId: `dry-run-${discipline.id}`,
      slackChannelName: channelName,
      topic: discipline.description,
      purpose: discipline.purpose,
      isPrivate: options.privateChannels ?? false,
      status: 'pending',
    };
  }

  try {
    // SKELETON: Actual Slack API integration will be implemented here
    // This will use the Slack API to create a channel for the discipline

    // TODO: Implement actual Slack channel creation
    // const channel = await slackClient.conversations.create({
    //   name: channelName,
    //   is_private: options.privateChannels ?? false,
    //   // ... other channel properties
    // });
    //
    // // Set topic and purpose
    // await slackClient.conversations.setTopic({
    //   channel: channel.id,
    //   topic: discipline.description,
    // });
    //
    // await slackClient.conversations.setPurpose({
    //   channel: channel.id,
    //   purpose: discipline.purpose,
    // });

    // For now, return a placeholder successful mapping
    const slackChannelId = `C${generatePlaceholderId(discipline.id)}`;

    return {
      discipline,
      slackChannelId,
      slackChannelName: channelName,
      topic: discipline.description,
      purpose: discipline.purpose,
      isPrivate: options.privateChannels ?? false,
      status: 'success',
    };
  } catch (error) {
    return {
      discipline,
      slackChannelId: '',
      slackChannelName: channelName,
      isPrivate: options.privateChannels ?? false,
      status: 'failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create an empty Orchestrator mapping result (for when Orchestrator creation is skipped).
 */
function createEmptyOrchestratorMappingResult(): OrchestratorMappingResult {
  return {
    mappings: [],
    total: 0,
    successful: 0,
    failed: 0,
    mappedAt: new Date().toISOString(),
  };
}

/**
 * Create an empty discipline mapping result (for when channel creation is skipped).
 */
function createEmptyDisciplineMappingResult(): DisciplineMappingResult {
  return {
    mappings: [],
    total: 0,
    successful: 0,
    failed: 0,
    mappedAt: new Date().toISOString(),
  };
}

/**
 * Determine the overall migration status based on mapping results.
 */
function determineOverallStatus(
  orchestratorMappings: OrchestratorMappingResult,
  disciplineMappings: DisciplineMappingResult
): 'complete' | 'partial' | 'failed' {
  const totalOperations = orchestratorMappings.total + disciplineMappings.total;
  const totalSuccessful = orchestratorMappings.successful + disciplineMappings.successful;
  const totalFailed = orchestratorMappings.failed + disciplineMappings.failed;

  if (totalOperations === 0) {
    return 'complete'; // Nothing to do
  }

  if (totalFailed === totalOperations) {
    return 'failed';
  }

  if (totalSuccessful === totalOperations) {
    return 'complete';
  }

  return 'partial';
}

/**
 * Generate a placeholder ID for dry-run and skeleton modes.
 */
function generatePlaceholderId(baseId: string): string {
  // Generate a deterministic but unique-looking ID
  const hash = baseId
    .split('')
    .reduce((acc, char) => ((acc << 5) - acc + char.charCodeAt(0)) | 0, 0);
  return Math.abs(hash)
    .toString(36)
    .toUpperCase()
    .padStart(10, '0')
    .slice(0, 10);
}

/**
 * Log migration start information (for verbose mode).
 */
function logMigrationStart(
  neolithResult: NeolithResult,
  options: MigrationOptions
): void {
  // eslint-disable-next-line no-console
  console.log('Starting org-genesis migration to Neolith...');
  // eslint-disable-next-line no-console
  console.log(`  Organization: ${neolithResult.manifest.name}`);
  // eslint-disable-next-line no-console
  console.log(`  Orchestrators to create: ${neolithResult.orchestrators.length}`);
  // eslint-disable-next-line no-console
  console.log(`  Disciplines to create: ${neolithResult.disciplines.length}`);
  // eslint-disable-next-line no-console
  console.log(`  Dry run: ${options.dryRun ? 'yes' : 'no'}`);
}

/**
 * Log migration completion information (for verbose mode).
 */
function logMigrationComplete(
  orchestratorMappings: OrchestratorMappingResult,
  disciplineMappings: DisciplineMappingResult,
  durationMs: number
): void {
  // eslint-disable-next-line no-console
  console.log('Migration complete!');
  // eslint-disable-next-line no-console
  console.log(`  Orchestrators: ${orchestratorMappings.successful}/${orchestratorMappings.total} successful`);
  // eslint-disable-next-line no-console
  console.log(
    `  Channels: ${disciplineMappings.successful}/${disciplineMappings.total} successful`
  );
  // eslint-disable-next-line no-console
  console.log(`  Duration: ${durationMs}ms`);
}

// ============================================================================
// Export ID Mappers for External Use
// ============================================================================

export { createOrchestratorMapper, createDisciplineMapper, IDMapper };
