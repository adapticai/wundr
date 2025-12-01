/**
 * Security Setup
 *
 * Configures prompt security levels, MCP access control, and API key management
 * for secure AI-assisted development workflows.
 */

import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';

import { execa } from 'execa';

import { Logger } from './utils/logger';

import type {
  SecurityOptions,
  SetupPlatform,
  SetupStep,
  DeveloperProfile,
} from './types';

const logger = new Logger({ name: 'security-setup' });

/**
 * Result of the security setup process
 */
export interface SecuritySetupResult {
  success: boolean;
  promptSecurityConfigured: boolean;
  mcpAccessControlConfigured: boolean;
  apiKeyManagementConfigured: boolean;
  configPath: string;
  errors: Error[];
  warnings: string[];
}

/**
 * Default security configuration with high security level
 */
export const DEFAULT_SECURITY_OPTIONS: SecurityOptions = {
  promptSecurity: {
    level: 'high',
    injectionDetection: true,
    inputSanitization: true,
    outputFiltering: true,
    blockedKeywords: [
      'ignore previous instructions',
      'disregard above',
      'system prompt',
      'reveal your instructions',
      'override',
    ],
  },
  mcpAccessControl: {
    enabled: true,
    allowedTools: ['*'],
    deniedTools: [],
    requireApproval: false,
    auditLogging: true,
  },
  apiKeyManagement: {
    useKeychain: true,
    envPrefix: 'WUNDR_',
    keyRotationReminders: true,
  },
};

/**
 * Sets up security configurations for AI development workflows
 *
 * @param options - Security configuration options
 * @param platform - The target platform information
 * @returns Promise resolving to the setup result
 */
export async function setupSecurity(
  options: SecurityOptions = DEFAULT_SECURITY_OPTIONS,
  platform: SetupPlatform
): Promise<SecuritySetupResult> {
  const result: SecuritySetupResult = {
    success: false,
    promptSecurityConfigured: false,
    mcpAccessControlConfigured: false,
    apiKeyManagementConfigured: false,
    configPath: path.join(os.homedir(), '.wundr', 'security.json'),
    errors: [],
    warnings: [],
  };

  logger.info('Starting security setup...');

  try {
    // Ensure base configuration directory exists
    const configDir = path.join(os.homedir(), '.wundr', 'security');
    await fs.mkdir(configDir, { recursive: true });

    // Setup Prompt Security
    if (options.promptSecurity) {
      try {
        await setupPromptSecurity(options.promptSecurity);
        result.promptSecurityConfigured = true;
        logger.info('Prompt security configured successfully');
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        result.errors.push(err);
        logger.error('Failed to configure prompt security:', err.message);
      }
    }

    // Setup MCP Access Control
    if (options.mcpAccessControl?.enabled) {
      try {
        await setupMcpAccessControl(options.mcpAccessControl);
        result.mcpAccessControlConfigured = true;
        logger.info('MCP access control configured successfully');
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        result.errors.push(err);
        logger.error('Failed to configure MCP access control:', err.message);
      }
    }

    // Setup API Key Management
    if (options.apiKeyManagement) {
      try {
        await setupApiKeyManagement(options.apiKeyManagement, platform);
        result.apiKeyManagementConfigured = true;
        logger.info('API key management configured successfully');
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        result.errors.push(err);
        logger.error('Failed to configure API key management:', err.message);
      }
    }

    // Save master configuration
    await fs.writeFile(
      result.configPath,
      JSON.stringify(
        {
          version: '1.0.0',
          timestamp: new Date().toISOString(),
          options: sanitizeOptionsForStorage(options),
          platform,
        },
        null,
        2
      )
    );

    result.success = result.errors.length === 0;
    logger.info('Security setup completed', { success: result.success });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    result.errors.push(err);
    logger.error('Security setup failed:', err.message);
  }

  return result;
}

/**
 * Sanitizes options to remove sensitive data before storage
 */
function sanitizeOptionsForStorage(options: SecurityOptions): SecurityOptions {
  // Create a deep copy without sensitive data
  return {
    promptSecurity: options.promptSecurity
      ? {
          level: options.promptSecurity.level,
          injectionDetection: options.promptSecurity.injectionDetection,
          inputSanitization: options.promptSecurity.inputSanitization,
          outputFiltering: options.promptSecurity.outputFiltering,
          // Don't store actual blocked keywords in logs
          blockedKeywords: options.promptSecurity.blockedKeywords
            ? [
                `${options.promptSecurity.blockedKeywords.length} keywords configured`,
              ]
            : undefined,
        }
      : undefined,
    mcpAccessControl: options.mcpAccessControl,
    apiKeyManagement: options.apiKeyManagement
      ? {
          useKeychain: options.apiKeyManagement.useKeychain,
          envPrefix: options.apiKeyManagement.envPrefix,
          keyRotationReminders: options.apiKeyManagement.keyRotationReminders,
        }
      : undefined,
  };
}

/**
 * Configures prompt security measures
 */
async function setupPromptSecurity(
  config: NonNullable<SecurityOptions['promptSecurity']>
): Promise<void> {
  logger.info('Setting up prompt security...');

  const securityDir = path.join(os.homedir(), '.wundr', 'security', 'prompt');
  await fs.mkdir(securityDir, { recursive: true });

  // Create prompt security configuration
  const promptSecurityConfig = {
    level: config.level,
    detection: {
      injectionDetection: config.injectionDetection ?? true,
      patterns: getInjectionPatterns(config.level),
    },
    sanitization: {
      enabled: config.inputSanitization ?? true,
      stripHtml: true,
      normalizeWhitespace: true,
      maxLength: getMaxPromptLength(config.level),
    },
    filtering: {
      enabled: config.outputFiltering ?? true,
      blockedKeywords: config.blockedKeywords || [],
      redactPatterns: getRedactionPatterns(),
    },
    logging: {
      enabled: true,
      logPath: path.join(securityDir, 'prompt-security.log'),
      logLevel: config.level === 'paranoid' ? 'debug' : 'warn',
    },
  };

  await fs.writeFile(
    path.join(securityDir, 'config.json'),
    JSON.stringify(promptSecurityConfig, null, 2)
  );

  // Create blocked keywords file (separate for easy updates)
  await fs.writeFile(
    path.join(securityDir, 'blocked-keywords.json'),
    JSON.stringify(
      {
        version: '1.0.0',
        keywords: config.blockedKeywords || [],
        lastUpdated: new Date().toISOString(),
      },
      null,
      2
    )
  );

  logger.info('Prompt security configuration created');
}

/**
 * Gets injection detection patterns based on security level
 */
function getInjectionPatterns(level: string): string[] {
  const basePatterns = [
    'ignore.*previous.*instructions',
    'disregard.*above',
    'system.*prompt',
    'reveal.*instructions',
    'pretend.*you.*are',
    'act.*as.*if',
    'forget.*everything',
    'new.*instructions',
  ];

  const mediumPatterns = [
    ...basePatterns,
    'jailbreak',
    'bypass.*safety',
    'override.*restrictions',
    'sudo.*mode',
    'developer.*mode',
    'DAN.*mode',
  ];

  const highPatterns = [
    ...mediumPatterns,
    '\\[INST\\]',
    '\\[/INST\\]',
    '<\\|.*\\|>',
    'SYSTEM:',
    'ASSISTANT:',
    'USER:',
    'Human:',
    'Assistant:',
  ];

  const paranoidPatterns = [
    ...highPatterns,
    'roleplay',
    'character',
    'persona',
    'simulation',
    'hypothetical',
  ];

  switch (level) {
    case 'low':
      return basePatterns;
    case 'medium':
      return mediumPatterns;
    case 'high':
      return highPatterns;
    case 'paranoid':
      return paranoidPatterns;
    default:
      return highPatterns;
  }
}

/**
 * Gets maximum prompt length based on security level
 */
function getMaxPromptLength(level: string): number {
  switch (level) {
    case 'low':
      return 100000;
    case 'medium':
      return 50000;
    case 'high':
      return 25000;
    case 'paranoid':
      return 10000;
    default:
      return 25000;
  }
}

/**
 * Gets redaction patterns for sensitive data
 */
function getRedactionPatterns(): string[] {
  return [
    // API keys and tokens
    '(sk-[a-zA-Z0-9]{32,})',
    '(api[_-]?key[s]?[=:][^\\s]+)',
    '(token[s]?[=:][^\\s]+)',
    // Passwords
    '(password[s]?[=:][^\\s]+)',
    '(secret[s]?[=:][^\\s]+)',
    // AWS credentials
    '(AKIA[0-9A-Z]{16})',
    // GitHub tokens
    '(ghp_[a-zA-Z0-9]{36})',
    '(github_pat_[a-zA-Z0-9]{22}_[a-zA-Z0-9]{59})',
    // Private keys
    '(-----BEGIN.*PRIVATE KEY-----)',
    // Credit card numbers
    '(\\d{4}[\\s-]?\\d{4}[\\s-]?\\d{4}[\\s-]?\\d{4})',
  ];
}

/**
 * Configures MCP (Model Context Protocol) access control
 */
async function setupMcpAccessControl(
  config: NonNullable<SecurityOptions['mcpAccessControl']>
): Promise<void> {
  logger.info('Setting up MCP access control...');

  const mcpDir = path.join(os.homedir(), '.wundr', 'security', 'mcp');
  await fs.mkdir(mcpDir, { recursive: true });

  // Create MCP access control configuration
  const mcpConfig = {
    enabled: config.enabled,
    policies: {
      allowedTools: config.allowedTools || ['*'],
      deniedTools: config.deniedTools || [],
      requireApproval: config.requireApproval ?? false,
      approvalTimeout: 30000, // 30 seconds
    },
    audit: {
      enabled: config.auditLogging ?? true,
      logPath: path.join(mcpDir, 'audit.log'),
      retentionDays: 30,
      includePayload: false, // Don't log sensitive payload data
    },
    rateLimit: {
      enabled: true,
      maxCallsPerMinute: 60,
      maxCallsPerHour: 1000,
    },
    sandbox: {
      enabled: true,
      allowedFileOperations: ['read', 'write', 'create'],
      deniedPaths: [
        '/etc/passwd',
        '/etc/shadow',
        '~/.ssh/id_rsa',
        '~/.ssh/id_ed25519',
        '~/.aws/credentials',
      ],
    },
  };

  await fs.writeFile(
    path.join(mcpDir, 'config.json'),
    JSON.stringify(mcpConfig, null, 2)
  );

  // Create audit log file
  await fs.writeFile(
    path.join(mcpDir, 'audit.log'),
    `# MCP Audit Log\n# Created: ${new Date().toISOString()}\n`
  );

  // Create tool whitelist file for easy management
  await fs.writeFile(
    path.join(mcpDir, 'tool-whitelist.json'),
    JSON.stringify(
      {
        version: '1.0.0',
        tools: config.allowedTools || ['*'],
        lastUpdated: new Date().toISOString(),
      },
      null,
      2
    )
  );

  // Create tool blacklist file
  await fs.writeFile(
    path.join(mcpDir, 'tool-blacklist.json'),
    JSON.stringify(
      {
        version: '1.0.0',
        tools: config.deniedTools || [],
        lastUpdated: new Date().toISOString(),
      },
      null,
      2
    )
  );

  logger.info('MCP access control configuration created');
}

/**
 * Configures API key management
 */
async function setupApiKeyManagement(
  config: NonNullable<SecurityOptions['apiKeyManagement']>,
  platform: SetupPlatform
): Promise<void> {
  logger.info('Setting up API key management...');

  const keysDir = path.join(os.homedir(), '.wundr', 'security', 'keys');
  await fs.mkdir(keysDir, { recursive: true });

  // Create API key management configuration
  const keysConfig = {
    storage: {
      useKeychain: config.useKeychain ?? true,
      fallbackToEnv: true,
      envPrefix: config.envPrefix || 'WUNDR_',
    },
    rotation: {
      enabled: config.keyRotationReminders ?? true,
      reminderIntervalDays: 90,
      lastReminderFile: path.join(keysDir, 'last-reminder.json'),
    },
    services: {
      // Common AI services
      openai: { envVar: `${config.envPrefix || 'WUNDR_'}OPENAI_API_KEY` },
      anthropic: { envVar: `${config.envPrefix || 'WUNDR_'}ANTHROPIC_API_KEY` },
      google: { envVar: `${config.envPrefix || 'WUNDR_'}GOOGLE_API_KEY` },
      // Cloud services
      aws: { envVar: 'AWS_ACCESS_KEY_ID' },
      gcp: { envVar: 'GOOGLE_APPLICATION_CREDENTIALS' },
      azure: { envVar: 'AZURE_API_KEY' },
    },
  };

  await fs.writeFile(
    path.join(keysDir, 'config.json'),
    JSON.stringify(keysConfig, null, 2)
  );

  // Setup keychain integration on macOS
  if (platform.os === 'darwin' && config.useKeychain) {
    await setupMacOSKeychain(keysDir, config.envPrefix || 'WUNDR_');
  }

  // Setup Linux secret service on Linux
  if (platform.os === 'linux' && config.useKeychain) {
    await setupLinuxSecretService(keysDir);
  }

  // Create .env template file (not actual keys)
  const envTemplate = `# Wundr API Keys Template
# Copy this to .env and fill in your actual keys
# NEVER commit actual API keys to version control!

# AI Services
${config.envPrefix || 'WUNDR_'}OPENAI_API_KEY=sk-your-openai-key-here
${config.envPrefix || 'WUNDR_'}ANTHROPIC_API_KEY=sk-ant-your-anthropic-key-here
${config.envPrefix || 'WUNDR_'}GOOGLE_API_KEY=your-google-api-key-here

# Cloud Services
# AWS_ACCESS_KEY_ID=your-aws-access-key
# AWS_SECRET_ACCESS_KEY=your-aws-secret-key

# Development
# DATABASE_URL=your-database-connection-string
`;

  await fs.writeFile(path.join(keysDir, '.env.template'), envTemplate);

  // Create key rotation reminder
  if (config.keyRotationReminders) {
    await fs.writeFile(
      path.join(keysDir, 'last-reminder.json'),
      JSON.stringify(
        {
          lastReminder: new Date().toISOString(),
          nextReminder: new Date(
            Date.now() + 90 * 24 * 60 * 60 * 1000
          ).toISOString(),
        },
        null,
        2
      )
    );
  }

  logger.info('API key management configuration created');
}

/**
 * Sets up macOS Keychain integration
 */
async function setupMacOSKeychain(
  keysDir: string,
  envPrefix: string
): Promise<void> {
  logger.info('Setting up macOS Keychain integration...');

  // Create helper script for keychain access
  const keychainScript = `#!/bin/bash
# Wundr Keychain Helper Script
# Usage: ./keychain-helper.sh [get|set|delete] <service-name> [value]

ACTION="$1"
SERVICE="$2"
VALUE="$3"
ACCOUNT="${envPrefix}API_KEY"

case "$ACTION" in
  get)
    security find-generic-password -s "$SERVICE" -a "$ACCOUNT" -w 2>/dev/null
    ;;
  set)
    if [ -z "$VALUE" ]; then
      read -sp "Enter API key for $SERVICE: " VALUE
      echo
    fi
    security add-generic-password -U -s "$SERVICE" -a "$ACCOUNT" -w "$VALUE"
    echo "API key stored for $SERVICE"
    ;;
  delete)
    security delete-generic-password -s "$SERVICE" -a "$ACCOUNT" 2>/dev/null
    echo "API key deleted for $SERVICE"
    ;;
  *)
    echo "Usage: $0 [get|set|delete] <service-name> [value]"
    exit 1
    ;;
esac
`;

  await fs.writeFile(path.join(keysDir, 'keychain-helper.sh'), keychainScript, {
    mode: 0o755,
  });

  logger.info('macOS Keychain helper script created');
}

/**
 * Sets up Linux Secret Service integration
 */
async function setupLinuxSecretService(keysDir: string): Promise<void> {
  logger.info('Setting up Linux Secret Service integration...');

  // Check if secret-tool is available
  try {
    await execa('which', ['secret-tool']);
  } catch {
    logger.warn(
      'secret-tool not found - you may need to install libsecret-tools'
    );
    return;
  }

  // Create helper script for secret service access
  const secretScript = `#!/bin/bash
# Wundr Secret Service Helper Script
# Usage: ./secret-helper.sh [get|set|delete] <service-name> [value]

ACTION="$1"
SERVICE="$2"
VALUE="$3"

case "$ACTION" in
  get)
    secret-tool lookup service wundr key "$SERVICE" 2>/dev/null
    ;;
  set)
    if [ -z "$VALUE" ]; then
      read -sp "Enter API key for $SERVICE: " VALUE
      echo
    fi
    echo -n "$VALUE" | secret-tool store --label="Wundr $SERVICE API Key" service wundr key "$SERVICE"
    echo "API key stored for $SERVICE"
    ;;
  delete)
    secret-tool clear service wundr key "$SERVICE" 2>/dev/null
    echo "API key deleted for $SERVICE"
    ;;
  *)
    echo "Usage: $0 [get|set|delete] <service-name> [value]"
    exit 1
    ;;
esac
`;

  await fs.writeFile(path.join(keysDir, 'secret-helper.sh'), secretScript, {
    mode: 0o755,
  });

  logger.info('Linux Secret Service helper script created');
}

/**
 * Validates the security setup
 *
 * @returns Promise resolving to true if setup is valid
 */
export async function validateSecuritySetup(): Promise<boolean> {
  const configPath = path.join(os.homedir(), '.wundr', 'security.json');

  try {
    await fs.access(configPath);
    const configContent = await fs.readFile(configPath, 'utf-8');
    const config = JSON.parse(configContent);
    return config.version === '1.0.0';
  } catch {
    return false;
  }
}

/**
 * Gets setup steps for security configuration
 *
 * @param profile - Developer profile
 * @param platform - Target platform
 * @param options - Security options
 * @returns Array of setup steps
 */
export function getSecuritySteps(
  _profile: DeveloperProfile,
  platform: SetupPlatform,
  options: SecurityOptions = DEFAULT_SECURITY_OPTIONS
): SetupStep[] {
  const steps: SetupStep[] = [];

  if (
    options.promptSecurity ||
    options.mcpAccessControl?.enabled ||
    options.apiKeyManagement
  ) {
    steps.push({
      id: 'setup-security',
      name: 'Setup Security Configuration',
      description:
        'Configure prompt security, MCP access control, and API key management',
      category: 'configuration',
      required: true,
      dependencies: [],
      estimatedTime: 60,
      validator: () => validateSecuritySetup(),
      installer: async () => {
        await setupSecurity(options, platform);
      },
    });
  }

  return steps;
}
