/**
 * @neolith/org-integration - Migration Functions
 *
 * Functions for migrating org-genesis results to Slack workspace resources.
 */

import {
  generateChannelName,
  generateDisplayName,
  createVPMapper,
  createDisciplineMapper,
  IDMapper,
} from './utils';

import type {
  NeolithResult,
  VPDefinition,
  DisciplineDefinition,
  VPMapping,
  VPMappingResult,
  DisciplineMapping,
  DisciplineMappingResult,
  MigrationResult,
  MigrationOptions,
} from './types';

// ============================================================================
// Main Migration Function
// ============================================================================

/**
 * Migrate an org-genesis result to Slack workspace resources.
 *
 * This is the main entry point for converting org-genesis output into
 * Slack users (for VPs) and channels (for disciplines).
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

  // Create VP mappings
  let vpMappings: VPMappingResult;
  if (options.skipVPs) {
    vpMappings = createEmptyVPMappingResult();
    warnings.push('VP creation skipped by option');
  } else {
    vpMappings = await createVPUsersFromManifest(
      neolithResult.vps,
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
  const status = determineOverallStatus(vpMappings, disciplineMappings);

  if (options.verbose) {
    logMigrationComplete(
      vpMappings,
      disciplineMappings,
      Date.now() - startTime
    );
  }

  return {
    vpMappings,
    disciplineMappings,
    status,
    migratedAt: new Date().toISOString(),
    warnings,
  };
}

// ============================================================================
// VP User Creation
// ============================================================================

/**
 * Create Slack users from VP definitions in the manifest.
 *
 * @param vps - Array of VP definitions from org-genesis
 * @param organizationId - ID of the organization
 * @param options - Migration options
 * @returns VP mapping result
 */
export async function createVPUsersFromManifest(
  vps: VPDefinition[],
  organizationId: string,
  options: MigrationOptions
): Promise<VPMappingResult> {
  const mappings: VPMapping[] = [];
  const vpMapper = createVPMapper();

  for (const vp of vps) {
    const mapping = await createSingleVPUser(vp, organizationId, options);
    mappings.push(mapping);

    if (mapping.status === 'success' && mapping.slackUserId) {
      vpMapper.addMapping(vp.id, mapping.slackUserId);
    }
  }

  const successful = mappings.filter(m => m.status === 'success').length;
  const failed = mappings.filter(m => m.status === 'failed').length;

  return {
    mappings,
    total: vps.length,
    successful,
    failed,
    mappedAt: new Date().toISOString(),
  };
}

/**
 * Create a single VP user in Slack.
 *
 * @param vp - VP definition
 * @param organizationId - Organization ID
 * @param options - Migration options
 * @returns VP mapping
 */
async function createSingleVPUser(
  vp: VPDefinition,
  _organizationId: string,
  options: MigrationOptions
): Promise<VPMapping> {
  const displayName = generateDisplayName(vp.name);

  // In dry run mode, return a pending mapping
  if (options.dryRun) {
    return {
      vp,
      slackUserId: `dry-run-${vp.id}`,
      slackDisplayName: displayName,
      status: 'pending',
    };
  }

  try {
    // SKELETON: Actual Slack API integration will be implemented here
    // This will use the Slack API to create a bot user or app user
    // representing the VP in the workspace

    // TODO: Implement actual Slack user creation
    // const slackUser = await slackClient.createBotUser({
    //   workspaceId: options.workspaceId,
    //   displayName: displayName,
    //   realName: vp.title,
    //   // ... other user properties
    // });

    // For now, return a placeholder successful mapping
    const slackUserId = `U${generatePlaceholderId(vp.id)}`;

    return {
      vp,
      slackUserId,
      slackDisplayName: displayName,
      status: 'success',
    };
  } catch (error) {
    return {
      vp,
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
 * Create an empty VP mapping result (for when VP creation is skipped).
 */
function createEmptyVPMappingResult(): VPMappingResult {
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
  vpMappings: VPMappingResult,
  disciplineMappings: DisciplineMappingResult
): 'complete' | 'partial' | 'failed' {
  const totalOperations = vpMappings.total + disciplineMappings.total;
  const totalSuccessful = vpMappings.successful + disciplineMappings.successful;
  const totalFailed = vpMappings.failed + disciplineMappings.failed;

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
  console.log(`  VPs to create: ${neolithResult.vps.length}`);
  // eslint-disable-next-line no-console
  console.log(`  Disciplines to create: ${neolithResult.disciplines.length}`);
  // eslint-disable-next-line no-console
  console.log(`  Dry run: ${options.dryRun ? 'yes' : 'no'}`);
}

/**
 * Log migration completion information (for verbose mode).
 */
function logMigrationComplete(
  vpMappings: VPMappingResult,
  disciplineMappings: DisciplineMappingResult,
  durationMs: number
): void {
  // eslint-disable-next-line no-console
  console.log('Migration complete!');
  // eslint-disable-next-line no-console
  console.log(`  VPs: ${vpMappings.successful}/${vpMappings.total} successful`);
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

export { createVPMapper, createDisciplineMapper, IDMapper };
