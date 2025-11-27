/**
 * @packageDocumentation
 * Manifest Generator - Generates and manages Organization Manifests
 *
 * This module provides the `ManifestGenerator` class for creating, updating,
 * validating, and serializing Organization Manifests. It serves as the primary
 * entry point for programmatically generating organizational structures.
 *
 * @module @wundr/org-genesis/generator/manifest-generator
 * @version 1.0.0
 */


import type {
  CreateOrgConfig,
  ManifestValidationError,
  ManifestValidationResult,
  ManifestValidationWarning,
  OrganizationManifest,
  OrgCommunicationConfig,
  OrgGovernanceConfig,
  OrgLifecycleState,
  OrgSecurityConfig,
  OrgSize,
  SerializedOrganizationManifest,
  VPNodeMapping,
} from '../types/index.js';
import { generateOrgId, generateSlug, isValidSlug } from '../utils/slug.js';

// =============================================================================
// CONFIGURATION INTERFACES
// =============================================================================

/**
 * Configuration options for the ManifestGenerator.
 *
 * Allows customization of default values used when generating new manifests.
 *
 * @example
 * ```typescript
 * const config: ManifestGeneratorConfig = {
 *   defaultSize: 'medium',
 *   defaultGovernance: {
 *     requireHumanApproval: true,
 *     approvalThresholdUsd: 5000,
 *     escalationTimeoutMinutes: 30,
 *     executiveVpIds: [],
 *     auditLoggingEnabled: true,
 *   },
 * };
 * ```
 */
export interface ManifestGeneratorConfig {
  /**
   * Default organization size when not specified in CreateOrgConfig.
   * @default 'medium'
   */
  defaultSize?: OrgSize;

  /**
   * Default governance configuration for new organizations.
   */
  defaultGovernance?: OrgGovernanceConfig;

  /**
   * Default security configuration for new organizations.
   */
  defaultSecurity?: OrgSecurityConfig;

  /**
   * Default communication configuration for new organizations.
   */
  defaultCommunication?: OrgCommunicationConfig;

  /**
   * Schema version to use for generated manifests.
   * @default '1.0.0'
   */
  schemaVersion?: string;
}

/**
 * Result of a manifest generation operation.
 *
 * Includes the generated manifest and any warnings encountered during generation.
 *
 * @example
 * ```typescript
 * const result = await generator.generate(config);
 * if (result.warnings.length > 0) {
 *   console.warn('Generation warnings:', result.warnings);
 * }
 * console.log('Generated manifest:', result.manifest.id);
 * ```
 */
export interface GenerateManifestResult {
  /**
   * The generated organization manifest.
   */
  manifest: OrganizationManifest;

  /**
   * Warnings encountered during generation (non-blocking issues).
   */
  warnings: string[];
}

// =============================================================================
// DEFAULT CONFIGURATIONS
// =============================================================================

/**
 * Default governance configuration for organizations.
 */
const DEFAULT_GOVERNANCE: OrgGovernanceConfig = {
  requireHumanApproval: true,
  approvalThresholdUsd: 10000,
  escalationTimeoutMinutes: 60,
  executiveVpIds: [],
  auditLoggingEnabled: true,
};

/**
 * Default security configuration for organizations.
 */
const DEFAULT_SECURITY: OrgSecurityConfig = {
  encryptionAtRest: 'AES-256',
  encryptionInTransit: 'TLS-1.3',
  mfaRequired: true,
  sessionTimeoutMinutes: 480,
  complianceFrameworks: [],
  ipAllowlist: [],
};

/**
 * Default communication configuration for organizations.
 */
const DEFAULT_COMMUNICATION: OrgCommunicationConfig = {
  protocol: 'grpc',
  messageQueue: 'redis',
  maxMessageSizeKb: 1024,
  compressionEnabled: true,
  retryPolicy: {
    maxRetries: 3,
    initialDelayMs: 100,
    maxDelayMs: 5000,
    backoffMultiplier: 2,
  },
};

/**
 * Orchestrator count recommendations by organization size.
 */
const VP_COUNT_BY_SIZE: Record<
  OrgSize,
  { min: number; max: number; recommended: number }
> = {
  small: { min: 1, max: 5, recommended: 2 },
  medium: { min: 3, max: 15, recommended: 5 },
  large: { min: 10, max: 50, recommended: 15 },
  enterprise: { min: 25, max: 100, recommended: 50 },
};

// =============================================================================
// MANIFEST GENERATOR CLASS
// =============================================================================

/**
 * Generator for Organization Manifests.
 *
 * The ManifestGenerator class provides comprehensive functionality for:
 * - Generating new organization manifests from configuration
 * - Updating existing manifests with new values
 * - Validating manifest structure and content
 * - Managing Orchestrator registrations within manifests
 * - Importing/exporting manifests as JSON
 *
 * @example
 * ```typescript
 * // Create generator with custom defaults
 * const generator = new ManifestGenerator({
 *   defaultSize: 'medium',
 *   defaultGovernance: {
 *     requireHumanApproval: true,
 *     approvalThresholdUsd: 5000,
 *     escalationTimeoutMinutes: 30,
 *     executiveVpIds: [],
 *     auditLoggingEnabled: true,
 *   },
 * });
 *
 * // Generate a new manifest
 * const result = await generator.generate({
 *   name: 'Acme Corporation',
 *   mission: 'Innovating solutions for a better tomorrow',
 *   industry: 'technology',
 *   size: 'medium',
 * });
 *
 * // Validate the manifest
 * const validation = generator.validate(result.manifest);
 * if (validation.valid) {
 *   console.log('Manifest is valid!');
 * }
 *
 * // Export to JSON
 * const json = generator.export(result.manifest);
 * ```
 */
export class ManifestGenerator {
  private readonly config: Required<ManifestGeneratorConfig>;

  /**
   * Creates a new ManifestGenerator instance.
   *
   * @param config - Optional configuration to customize default values
   *
   * @example
   * ```typescript
   * // Create with defaults
   * const generator = new ManifestGenerator();
   *
   * // Create with custom config
   * const customGenerator = new ManifestGenerator({
   *   defaultSize: 'large',
   *   schemaVersion: '2.0.0',
   * });
   * ```
   */
  constructor(config?: ManifestGeneratorConfig) {
    this.config = {
      defaultSize: config?.defaultSize ?? 'medium',
      defaultGovernance: config?.defaultGovernance ?? DEFAULT_GOVERNANCE,
      defaultSecurity: config?.defaultSecurity ?? DEFAULT_SECURITY,
      defaultCommunication:
        config?.defaultCommunication ?? DEFAULT_COMMUNICATION,
      schemaVersion: config?.schemaVersion ?? '1.0.0',
    };
  }

  /**
   * Generates a new Organization Manifest from the provided configuration.
   *
   * This method creates a complete manifest with all required fields populated.
   * Optional fields that are not provided will use sensible defaults based on
   * the organization size and industry.
   *
   * @param config - Configuration for the new organization
   * @returns Promise resolving to the generated manifest and any warnings
   *
   * @example
   * ```typescript
   * const result = await generator.generate({
   *   name: 'Startup AI Labs',
   *   mission: 'Democratizing AI for small businesses',
   *   industry: 'technology',
   *   size: 'small',
   *   orchestratorCount: 3,
   *   generateDisciplines: true,
   * });
   *
   * console.log(`Created organization: ${result.manifest.name}`);
   * console.log(`ID: ${result.manifest.id}`);
   * console.log(`Warnings: ${result.warnings.length}`);
   * ```
   */
  async generate(config: CreateOrgConfig): Promise<GenerateManifestResult> {
    const warnings: string[] = [];
    const now = new Date();

    // Generate slug from name if not provided
    const slug = config.slug ?? generateSlug(config.name);

    // Validate slug format
    if (!isValidSlug(slug)) {
      warnings.push(
        `Generated slug "${slug}" may contain invalid characters. Consider providing a custom slug.`,
      );
    }

    // Generate unique organization ID
    const id = generateOrgId();

    // Determine Orchestrator count based on size if not specified
    const sizeConfig = VP_COUNT_BY_SIZE[config.size];
    let orchestratorCount = config.orchestratorCount ?? sizeConfig.recommended;

    // Validate Orchestrator count against size recommendations
    if (orchestratorCount < sizeConfig.min) {
      warnings.push(
        `Orchestrator count ${orchestratorCount} is below recommended minimum ${sizeConfig.min} for ${config.size} organizations.`,
      );
    } else if (orchestratorCount > sizeConfig.max) {
      warnings.push(
        `Orchestrator count ${orchestratorCount} exceeds recommended maximum ${sizeConfig.max} for ${config.size} organizations.`,
      );
      orchestratorCount = sizeConfig.max;
    }

    // Build governance configuration with overrides
    const governance: OrgGovernanceConfig = {
      ...this.config.defaultGovernance,
      ...config.governance,
    };

    // Build security configuration with overrides
    const security: OrgSecurityConfig = {
      ...this.config.defaultSecurity,
      ...config.security,
    };

    // Build communication configuration with overrides
    const communication: OrgCommunicationConfig = {
      ...this.config.defaultCommunication,
      ...config.communication,
    };

    // Add industry-specific compliance frameworks if applicable
    if (
      config.industry === 'healthcare' &&
      !security.complianceFrameworks.includes('HIPAA')
    ) {
      security.complianceFrameworks = [
        ...security.complianceFrameworks,
        'HIPAA',
      ];
      warnings.push(
        'Added HIPAA compliance framework for healthcare organization.',
      );
    }
    if (
      config.industry === 'finance' &&
      !security.complianceFrameworks.includes('SOC2')
    ) {
      security.complianceFrameworks = [
        ...security.complianceFrameworks,
        'SOC2',
        'PCI-DSS',
      ];
      warnings.push(
        'Added SOC2 and PCI-DSS compliance frameworks for finance organization.',
      );
    }

    // Create the manifest
    const manifest: OrganizationManifest = {
      id,
      name: config.name,
      slug,
      mission: config.mission,
      description: config.description,
      industry: config.industry,
      size: config.size,
      lifecycleState: 'draft',
      vpRegistry: [],
      disciplineIds: config.initialDisciplines ?? [],
      governance,
      security,
      communication,
      createdAt: now,
      updatedAt: now,
      schemaVersion: this.config.schemaVersion,
      metadata: config.metadata ?? {},
    };

    return { manifest, warnings };
  }

  /**
   * Updates an existing manifest with new values.
   *
   * Performs a shallow merge of the updates into the existing manifest.
   * The `updatedAt` timestamp is automatically set to the current time.
   *
   * @param manifest - The existing manifest to update
   * @param updates - Partial manifest with fields to update
   * @returns A new manifest with the updates applied
   *
   * @example
   * ```typescript
   * const updated = generator.update(manifest, {
   *   name: 'Acme Corp International',
   *   lifecycleState: 'active',
   *   metadata: { region: 'us-east-1' },
   * });
   * ```
   */
  update(
    manifest: OrganizationManifest,
    updates: Partial<OrganizationManifest>,
  ): OrganizationManifest {
    const now = new Date();

    // Merge governance, security, and communication configs if provided
    const governance = updates.governance
      ? { ...manifest.governance, ...updates.governance }
      : manifest.governance;

    const security = updates.security
      ? { ...manifest.security, ...updates.security }
      : manifest.security;

    const communication = updates.communication
      ? { ...manifest.communication, ...updates.communication }
      : manifest.communication;

    // Merge metadata if provided
    const metadata = updates.metadata
      ? { ...manifest.metadata, ...updates.metadata }
      : manifest.metadata;

    return {
      ...manifest,
      ...updates,
      governance,
      security,
      communication,
      metadata,
      updatedAt: now,
    };
  }

  /**
   * Validates an organization manifest for structural correctness and consistency.
   *
   * Performs comprehensive validation including:
   * - Required field presence
   * - Field format validation (slugs, IDs)
   * - Referential integrity (Orchestrator IDs in registry)
   * - Governance and security configuration validation
   *
   * @param manifest - The manifest to validate
   * @returns Validation result with errors and warnings
   *
   * @example
   * ```typescript
   * const result = generator.validate(manifest);
   *
   * if (!result.valid) {
   *   console.error('Validation errors:');
   *   result.errors.forEach(err => {
   *     console.error(`  ${err.path}: ${err.message}`);
   *   });
   * }
   *
   * if (result.warnings.length > 0) {
   *   console.warn('Validation warnings:');
   *   result.warnings.forEach(warn => {
   *     console.warn(`  ${warn.path}: ${warn.message}`);
   *   });
   * }
   * ```
   */
  validate(manifest: OrganizationManifest): ManifestValidationResult {
    const errors: ManifestValidationError[] = [];
    const warnings: ManifestValidationWarning[] = [];

    // Required field validation
    if (!manifest.id || manifest.id.trim() === '') {
      errors.push({
        code: 'MISSING_ID',
        message: 'Organization ID is required',
        path: 'id',
      });
    }

    if (!manifest.name || manifest.name.trim() === '') {
      errors.push({
        code: 'MISSING_NAME',
        message: 'Organization name is required',
        path: 'name',
      });
    }

    if (!manifest.slug || manifest.slug.trim() === '') {
      errors.push({
        code: 'MISSING_SLUG',
        message: 'Organization slug is required',
        path: 'slug',
      });
    } else if (!isValidSlug(manifest.slug)) {
      errors.push({
        code: 'INVALID_SLUG',
        message:
          'Slug must contain only lowercase letters, numbers, and hyphens',
        path: 'slug',
        value: manifest.slug,
      });
    }

    if (!manifest.mission || manifest.mission.trim() === '') {
      errors.push({
        code: 'MISSING_MISSION',
        message: 'Organization mission is required',
        path: 'mission',
      });
    } else if (manifest.mission.length < 10) {
      warnings.push({
        code: 'SHORT_MISSION',
        message: 'Mission statement is very short',
        path: 'mission',
        suggestion:
          'Consider providing a more detailed mission statement (at least 10 characters)',
      });
    }

    // Industry validation
    const validIndustries = [
      'technology',
      'finance',
      'healthcare',
      'legal',
      'marketing',
      'manufacturing',
      'retail',
      'gaming',
      'media',
      'custom',
    ];
    if (!validIndustries.includes(manifest.industry)) {
      errors.push({
        code: 'INVALID_INDUSTRY',
        message: `Invalid industry "${manifest.industry}"`,
        path: 'industry',
        value: manifest.industry,
      });
    }

    // Size validation
    const validSizes = ['small', 'medium', 'large', 'enterprise'];
    if (!validSizes.includes(manifest.size)) {
      errors.push({
        code: 'INVALID_SIZE',
        message: `Invalid organization size "${manifest.size}"`,
        path: 'size',
        value: manifest.size,
      });
    }

    // Lifecycle state validation
    const validStates: OrgLifecycleState[] = [
      'draft',
      'active',
      'suspended',
      'archived',
    ];
    if (!validStates.includes(manifest.lifecycleState)) {
      errors.push({
        code: 'INVALID_LIFECYCLE_STATE',
        message: `Invalid lifecycle state "${manifest.lifecycleState}"`,
        path: 'lifecycleState',
        value: manifest.lifecycleState,
      });
    }

    // Orchestrator Registry validation
    if (!Array.isArray(manifest.vpRegistry)) {
      errors.push({
        code: 'INVALID_VP_REGISTRY',
        message: 'Orchestrator registry must be an array',
        path: 'vpRegistry',
      });
    } else {
      // Validate each Orchestrator in registry
      const orchestratorIds = new Set<string>();
      manifest.vpRegistry.forEach((orchestrator, index) => {
        if (!orchestrator.orchestratorId) {
          errors.push({
            code: 'MISSING_VP_ID',
            message: `Orchestrator at index ${index} is missing orchestratorId`,
            path: `vpRegistry[${index}].orchestratorId`,
          });
        } else if (orchestratorIds.has(orchestrator.orchestratorId)) {
          errors.push({
            code: 'DUPLICATE_VP_ID',
            message: `Duplicate Orchestrator ID "${orchestrator.orchestratorId}"`,
            path: `vpRegistry[${index}].orchestratorId`,
            value: orchestrator.orchestratorId,
          });
        } else {
          orchestratorIds.add(orchestrator.orchestratorId);
        }

        if (!orchestrator.nodeId) {
          errors.push({
            code: 'MISSING_NODE_ID',
            message: `Orchestrator at index ${index} is missing nodeId`,
            path: `vpRegistry[${index}].nodeId`,
          });
        }

        if (!orchestrator.hostname) {
          errors.push({
            code: 'MISSING_HOSTNAME',
            message: `Orchestrator at index ${index} is missing hostname`,
            path: `vpRegistry[${index}].hostname`,
          });
        }

        const validStatuses = [
          'active',
          'inactive',
          'provisioning',
          'error',
          'maintenance',
        ];
        if (!validStatuses.includes(orchestrator.status)) {
          errors.push({
            code: 'INVALID_VP_STATUS',
            message: `Invalid Orchestrator status "${orchestrator.status}" at index ${index}`,
            path: `vpRegistry[${index}].status`,
            value: orchestrator.status,
          });
        }
      });

      // Check Orchestrator count against size recommendations
      const sizeConfig = VP_COUNT_BY_SIZE[manifest.size];
      if (sizeConfig) {
        if (manifest.vpRegistry.length < sizeConfig.min) {
          warnings.push({
            code: 'LOW_VP_COUNT',
            message: `Orchestrator count ${manifest.vpRegistry.length} is below recommended minimum ${sizeConfig.min} for ${manifest.size} organizations`,
            path: 'vpRegistry',
            suggestion: `Consider adding more VPs (recommended: ${sizeConfig.recommended})`,
          });
        } else if (manifest.vpRegistry.length > sizeConfig.max) {
          warnings.push({
            code: 'HIGH_VP_COUNT',
            message: `Orchestrator count ${manifest.vpRegistry.length} exceeds recommended maximum ${sizeConfig.max} for ${manifest.size} organizations`,
            path: 'vpRegistry',
          });
        }
      }
    }

    // Discipline IDs validation
    if (!Array.isArray(manifest.disciplineIds)) {
      errors.push({
        code: 'INVALID_DISCIPLINE_IDS',
        message: 'Discipline IDs must be an array',
        path: 'disciplineIds',
      });
    }

    // Governance validation
    if (manifest.governance) {
      if (manifest.governance.approvalThresholdUsd < 0) {
        errors.push({
          code: 'INVALID_APPROVAL_THRESHOLD',
          message: 'Approval threshold must be non-negative',
          path: 'governance.approvalThresholdUsd',
          value: manifest.governance.approvalThresholdUsd,
        });
      }
      if (manifest.governance.escalationTimeoutMinutes < 1) {
        errors.push({
          code: 'INVALID_ESCALATION_TIMEOUT',
          message: 'Escalation timeout must be at least 1 minute',
          path: 'governance.escalationTimeoutMinutes',
          value: manifest.governance.escalationTimeoutMinutes,
        });
      }
    }

    // Security validation
    if (manifest.security) {
      if (manifest.security.sessionTimeoutMinutes < 1) {
        errors.push({
          code: 'INVALID_SESSION_TIMEOUT',
          message: 'Session timeout must be at least 1 minute',
          path: 'security.sessionTimeoutMinutes',
          value: manifest.security.sessionTimeoutMinutes,
        });
      }

      // Warn about disabled security features
      if (manifest.security.encryptionAtRest === 'none') {
        warnings.push({
          code: 'NO_ENCRYPTION_AT_REST',
          message: 'Encryption at rest is disabled',
          path: 'security.encryptionAtRest',
          suggestion: 'Enable AES-256 encryption for production deployments',
        });
      }
      if (!manifest.security.mfaRequired) {
        warnings.push({
          code: 'MFA_NOT_REQUIRED',
          message: 'Multi-factor authentication is not required',
          path: 'security.mfaRequired',
          suggestion: 'Enable MFA for enhanced security',
        });
      }
    }

    // Communication validation
    if (manifest.communication) {
      if (manifest.communication.maxMessageSizeKb < 1) {
        errors.push({
          code: 'INVALID_MESSAGE_SIZE',
          message: 'Max message size must be at least 1 KB',
          path: 'communication.maxMessageSizeKb',
          value: manifest.communication.maxMessageSizeKb,
        });
      }
      if (manifest.communication.retryPolicy) {
        if (manifest.communication.retryPolicy.maxRetries < 0) {
          errors.push({
            code: 'INVALID_MAX_RETRIES',
            message: 'Max retries must be non-negative',
            path: 'communication.retryPolicy.maxRetries',
            value: manifest.communication.retryPolicy.maxRetries,
          });
        }
        if (manifest.communication.retryPolicy.backoffMultiplier < 1) {
          errors.push({
            code: 'INVALID_BACKOFF_MULTIPLIER',
            message: 'Backoff multiplier must be at least 1',
            path: 'communication.retryPolicy.backoffMultiplier',
            value: manifest.communication.retryPolicy.backoffMultiplier,
          });
        }
      }
    }

    // Timestamp validation
    if (!manifest.createdAt) {
      errors.push({
        code: 'MISSING_CREATED_AT',
        message: 'Created timestamp is required',
        path: 'createdAt',
      });
    }
    if (!manifest.updatedAt) {
      errors.push({
        code: 'MISSING_UPDATED_AT',
        message: 'Updated timestamp is required',
        path: 'updatedAt',
      });
    }
    if (manifest.createdAt && manifest.updatedAt) {
      if (manifest.updatedAt < manifest.createdAt) {
        warnings.push({
          code: 'UPDATED_BEFORE_CREATED',
          message: 'Updated timestamp is before created timestamp',
          path: 'updatedAt',
          suggestion: 'Ensure timestamps are set correctly',
        });
      }
    }

    // Metadata validation (must be an object)
    if (manifest.metadata === null || typeof manifest.metadata !== 'object') {
      errors.push({
        code: 'INVALID_METADATA',
        message: 'Metadata must be an object',
        path: 'metadata',
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Adds a Orchestrator to the manifest's Orchestrator registry.
   *
   * @param manifest - The manifest to add the Orchestrator to
   * @param orchestrator - The Orchestrator node mapping to add
   * @returns A new manifest with the Orchestrator added
   * @throws Error if a Orchestrator with the same ID already exists
   *
   * @example
   * ```typescript
   * const vp: VPNodeMapping = {
   *   orchestratorId: 'vp_abc123',
   *   nodeId: 'node-us-east-1a',
   *   hostname: 'orchestrator-eng.cluster.internal',
   *   status: 'provisioning',
   * };
   *
   * const updated = generator.addVP(manifest, vp);
   * console.log(`VPs: ${updated.vpRegistry.length}`);
   * ```
   */
  addVP(
    manifest: OrganizationManifest,
    vp: VPNodeMapping,
  ): OrganizationManifest {
    // Check for duplicate Orchestrator ID
    const existingVp = manifest.vpRegistry.find(v => v.orchestratorId === vp.orchestratorId);
    if (existingVp) {
      throw new Error(`Orchestrator with ID "${vp.orchestratorId}" already exists in the registry`);
    }

    return this.update(manifest, {
      vpRegistry: [...manifest.vpRegistry, vp],
    });
  }

  /**
   * Removes a Orchestrator from the manifest's Orchestrator registry.
   *
   * @param manifest - The manifest to remove the Orchestrator from
   * @param orchestratorId - The ID of the Orchestrator to remove
   * @returns A new manifest with the Orchestrator removed
   * @throws Error if no Orchestrator with the given ID exists
   *
   * @example
   * ```typescript
   * const updated = generator.removeVP(manifest, 'vp_abc123');
   * console.log(`Remaining VPs: ${updated.vpRegistry.length}`);
   * ```
   */
  removeVP(manifest: OrganizationManifest, orchestratorId: string): OrganizationManifest {
    const vpIndex = manifest.vpRegistry.findIndex(v => v.orchestratorId === orchestratorId);
    if (vpIndex === -1) {
      throw new Error(`Orchestrator with ID "${orchestratorId}" not found in the registry`);
    }

    const vpRegistry = manifest.vpRegistry.filter(v => v.orchestratorId !== orchestratorId);

    // Also remove from executive Orchestrator IDs in governance if present
    let governance = manifest.governance;
    if (governance?.executiveVpIds.includes(orchestratorId)) {
      governance = {
        ...governance,
        executiveVpIds: governance.executiveVpIds.filter(id => id !== orchestratorId),
      };
    }

    return this.update(manifest, {
      vpRegistry,
      governance,
    });
  }

  /**
   * Exports the manifest as a JSON string.
   *
   * Serializes the manifest with proper date handling and formatting.
   * Dates are converted to ISO 8601 strings for JSON compatibility.
   *
   * @param manifest - The manifest to export
   * @param prettyPrint - Whether to format the JSON with indentation (default: true)
   * @returns JSON string representation of the manifest
   *
   * @example
   * ```typescript
   * const json = generator.export(manifest);
   * await fs.writeFile('organization.json', json);
   *
   * // Minified output
   * const minified = generator.export(manifest, false);
   * ```
   */
  export(manifest: OrganizationManifest, prettyPrint = true): string {
    const serialized: SerializedOrganizationManifest = {
      ...manifest,
      createdAt: manifest.createdAt.toISOString(),
      updatedAt: manifest.updatedAt.toISOString(),
      vpRegistry: manifest.vpRegistry.map(orchestrator => ({
        ...orchestrator,
        provisionedAt: orchestrator.provisionedAt?.toISOString() as unknown as Date,
        lastStatusChange: orchestrator.lastStatusChange?.toISOString() as unknown as Date,
        healthMetrics: orchestrator.healthMetrics
          ? {
              ...orchestrator.healthMetrics,
              lastHealthCheck:
                orchestrator.healthMetrics.lastHealthCheck.toISOString() as unknown as Date,
            }
          : undefined,
      })),
    };

    return prettyPrint
      ? JSON.stringify(serialized, null, 2)
      : JSON.stringify(serialized);
  }

  /**
   * Imports a manifest from a JSON string.
   *
   * Parses the JSON and converts date strings back to Date objects.
   * Performs basic validation on the parsed data.
   *
   * @param json - JSON string representation of a manifest
   * @returns The parsed OrganizationManifest
   * @throws Error if the JSON is invalid or missing required fields
   *
   * @example
   * ```typescript
   * const json = await fs.readFile('organization.json', 'utf-8');
   * const manifest = generator.import(json);
   * console.log(`Imported: ${manifest.name}`);
   * ```
   */
  import(json: string): OrganizationManifest {
    let parsed: SerializedOrganizationManifest;

    try {
      parsed = JSON.parse(json);
    } catch (error) {
      throw new Error(
        `Invalid JSON: ${error instanceof Error ? error.message : 'Parse error'}`,
      );
    }

    // Validate required fields
    if (!parsed.id) {
      throw new Error('Missing required field: id');
    }
    if (!parsed.name) {
      throw new Error('Missing required field: name');
    }
    if (!parsed.slug) {
      throw new Error('Missing required field: slug');
    }
    if (!parsed.mission) {
      throw new Error('Missing required field: mission');
    }
    if (!parsed.industry) {
      throw new Error('Missing required field: industry');
    }
    if (!parsed.size) {
      throw new Error('Missing required field: size');
    }

    // Convert date strings to Date objects
    const manifest: OrganizationManifest = {
      ...parsed,
      createdAt: new Date(parsed.createdAt),
      updatedAt: new Date(parsed.updatedAt),
      vpRegistry: (parsed.vpRegistry ?? []).map(orchestrator => ({
        ...orchestrator,
        provisionedAt: orchestrator.provisionedAt
          ? new Date(orchestrator.provisionedAt as unknown as string)
          : undefined,
        lastStatusChange: orchestrator.lastStatusChange
          ? new Date(orchestrator.lastStatusChange as unknown as string)
          : undefined,
        healthMetrics: orchestrator.healthMetrics
          ? {
              ...orchestrator.healthMetrics,
              lastHealthCheck: new Date(
                orchestrator.healthMetrics.lastHealthCheck as unknown as string,
              ),
            }
          : undefined,
      })),
      disciplineIds: parsed.disciplineIds ?? [],
      metadata: parsed.metadata ?? {},
    };

    // Validate the imported manifest
    const validation = this.validate(manifest);
    if (!validation.valid) {
      const errorMessages = validation.errors
        .map(e => `${e.path}: ${e.message}`)
        .join('; ');
      throw new Error(`Invalid manifest: ${errorMessages}`);
    }

    return manifest;
  }

  /**
   * Gets the current configuration of the generator.
   *
   * @returns The generator's configuration
   *
   * @example
   * ```typescript
   * const config = generator.getConfig();
   * console.log(`Default size: ${config.defaultSize}`);
   * ```
   */
  getConfig(): Readonly<Required<ManifestGeneratorConfig>> {
    return { ...this.config };
  }

  /**
   * Creates a copy of a manifest with a new ID.
   *
   * Useful for creating variations or templates from existing manifests.
   *
   * @param manifest - The manifest to clone
   * @param newName - Optional new name for the clone
   * @returns A new manifest with a fresh ID and updated timestamps
   *
   * @example
   * ```typescript
   * const clone = generator.clone(manifest, 'Acme Corp - Dev Environment');
   * console.log(`Clone ID: ${clone.id}`);
   * ```
   */
  clone(
    manifest: OrganizationManifest,
    newName?: string,
  ): OrganizationManifest {
    const now = new Date();
    const name = newName ?? `${manifest.name} (Copy)`;
    const slug = generateSlug(name);

    return {
      ...manifest,
      id: generateOrgId(),
      name,
      slug,
      lifecycleState: 'draft',
      vpRegistry: [], // Don't copy Orchestrator registrations
      createdAt: now,
      updatedAt: now,
    };
  }

  /**
   * Checks if a manifest can be activated (transitioned to 'active' state).
   *
   * Validates that all prerequisites for activation are met.
   *
   * @param manifest - The manifest to check
   * @returns Object indicating if activation is possible and any blocking issues
   *
   * @example
   * ```typescript
   * const check = generator.canActivate(manifest);
   * if (check.canActivate) {
   *   const activated = generator.update(manifest, { lifecycleState: 'active' });
   * } else {
   *   console.error('Cannot activate:', check.blockers);
   * }
   * ```
   */
  canActivate(manifest: OrganizationManifest): {
    canActivate: boolean;
    blockers: string[];
  } {
    const blockers: string[] = [];

    // Must be in draft or suspended state
    if (
      manifest.lifecycleState !== 'draft' &&
      manifest.lifecycleState !== 'suspended'
    ) {
      blockers.push(
        `Cannot activate from "${manifest.lifecycleState}" state. Must be in "draft" or "suspended".`,
      );
    }

    // Must have at least one Orchestrator
    if (manifest.vpRegistry.length === 0) {
      blockers.push('Organization must have at least one Orchestrator to activate.');
    }

    // All VPs must be in valid state (not error)
    const errorVps = manifest.vpRegistry.filter(orchestrator => orchestrator.status === 'error');
    if (errorVps.length > 0) {
      blockers.push(
        `${errorVps.length} VP(s) are in error state: ${errorVps.map(v => v.orchestratorId).join(', ')}`,
      );
    }

    // Must pass validation
    const validation = this.validate(manifest);
    if (!validation.valid) {
      blockers.push(
        ...validation.errors.map(
          e => `Validation error: ${e.message} (${e.path})`,
        ),
      );
    }

    return {
      canActivate: blockers.length === 0,
      blockers,
    };
  }
}

// =============================================================================
// FACTORY FUNCTION
// =============================================================================

/**
 * Creates a new ManifestGenerator instance with optional configuration.
 *
 * This is the recommended way to create a ManifestGenerator as it provides
 * a clean factory interface.
 *
 * @param config - Optional configuration for the generator
 * @returns A new ManifestGenerator instance
 *
 * @example
 * ```typescript
 * // Create with defaults
 * const generator = createManifestGenerator();
 *
 * // Create with custom config
 * const customGenerator = createManifestGenerator({
 *   defaultSize: 'large',
 *   defaultGovernance: {
 *     requireHumanApproval: false,
 *     approvalThresholdUsd: 50000,
 *     escalationTimeoutMinutes: 120,
 *     executiveVpIds: [],
 *     auditLoggingEnabled: true,
 *   },
 * });
 * ```
 */
export function createManifestGenerator(
  config?: ManifestGeneratorConfig,
): ManifestGenerator {
  return new ManifestGenerator(config);
}
