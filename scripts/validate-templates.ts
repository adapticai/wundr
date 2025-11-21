#!/usr/bin/env tsx

/**
 * Template Validation Script
 *
 * Validates consistency and correctness of all templates in the Wundr project.
 *
 * Usage:
 *   npx tsx scripts/validate-templates.ts
 *   npx tsx scripts/validate-templates.ts --fix
 *   npx tsx scripts/validate-templates.ts --verbose
 */

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';

// Configuration
const CONFIG = {
  templatePaths: [
    'packages/@wundr/computer-setup/resources/templates',
    'templates/.claude',
  ],
  agentPaths: ['templates/.claude/agents'],
  hookPaths: ['templates/.claude/hooks'],
  commandPaths: ['templates/.claude/commands'],
  expectedModel: 'claude-sonnet-4-5',
  validPermissionModes: ['auto', 'require'],
  validMcpTools: [
    'drift_detection',
    'pattern_standardize',
    'monorepo_manage',
    'governance_report',
    'dependency_analyze',
    'test_baseline',
    'claude_config',
  ],
  validClaudeTools: [
    'Read',
    'Write',
    'Edit',
    'Glob',
    'Grep',
    'Bash',
    'TodoWrite',
    'WebFetch',
    'WebSearch',
  ],
  maxFileLines: 1000,
  maxFileSizeKb: 100,
};

// Result types
interface ValidationResult {
  file: string;
  valid: boolean;
  errors: string[];
  warnings: string[];
}

interface ValidationSummary {
  totalFiles: number;
  validFiles: number;
  invalidFiles: number;
  totalErrors: number;
  totalWarnings: number;
  results: ValidationResult[];
}

// Agent frontmatter schema
interface AgentFrontmatter {
  name: string;
  description: string;
  tools?: string[];
  model?: string;
  permissionMode?: string;
  skills?: string[];
}

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

// Utility functions
function log(message: string, color: string = colors.reset): void {
  console.log(`${color}${message}${colors.reset}`);
}

function logError(message: string): void {
  log(`  ERROR: ${message}`, colors.red);
}

function logWarning(message: string): void {
  log(`  WARNING: ${message}`, colors.yellow);
}

function logSuccess(message: string): void {
  log(`  ${message}`, colors.green);
}

function logInfo(message: string): void {
  log(`  ${message}`, colors.cyan);
}

function fileExists(filePath: string): boolean {
  try {
    return fs.existsSync(filePath);
  } catch {
    return false;
  }
}

function readFile(filePath: string): string | null {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return null;
  }
}

function getFiles(dir: string, pattern?: RegExp): string[] {
  if (!fileExists(dir)) {
    return [];
  }

  const files: string[] = [];
  const items = fs.readdirSync(dir, { withFileTypes: true });

  for (const item of items) {
    const fullPath = path.join(dir, item.name);
    if (item.isDirectory()) {
      files.push(...getFiles(fullPath, pattern));
    } else if (!pattern || pattern.test(item.name)) {
      files.push(fullPath);
    }
  }

  return files;
}

// Extract YAML frontmatter from markdown file
function extractFrontmatter(content: string): AgentFrontmatter | null {
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!frontmatterMatch) {
    return null;
  }

  try {
    return yaml.parse(frontmatterMatch[1]) as AgentFrontmatter;
  } catch (error) {
    return null;
  }
}

// Validation functions
function validateAgentFrontmatter(
  filePath: string,
  content: string
): ValidationResult {
  const result: ValidationResult = {
    file: filePath,
    valid: true,
    errors: [],
    warnings: [],
  };

  const frontmatter = extractFrontmatter(content);

  if (!frontmatter) {
    result.valid = false;
    result.errors.push('Missing or invalid YAML frontmatter');
    return result;
  }

  // Required fields
  if (!frontmatter.name) {
    result.valid = false;
    result.errors.push('Missing required field: name');
  }

  if (!frontmatter.description) {
    result.valid = false;
    result.errors.push('Missing required field: description');
  }

  // Model validation
  if (frontmatter.model && frontmatter.model !== CONFIG.expectedModel) {
    result.warnings.push(
      `Model mismatch: expected '${CONFIG.expectedModel}', found '${frontmatter.model}'`
    );
  }

  // Permission mode validation
  if (
    frontmatter.permissionMode &&
    !CONFIG.validPermissionModes.includes(frontmatter.permissionMode)
  ) {
    result.errors.push(
      `Invalid permissionMode: '${frontmatter.permissionMode}'. Valid values: ${CONFIG.validPermissionModes.join(', ')}`
    );
    result.valid = false;
  }

  // Tools validation
  if (frontmatter.tools && Array.isArray(frontmatter.tools)) {
    for (const tool of frontmatter.tools) {
      const allValidTools = [...CONFIG.validMcpTools, ...CONFIG.validClaudeTools];
      if (!allValidTools.includes(tool)) {
        result.warnings.push(`Unknown tool: '${tool}'`);
      }
    }
  }

  // Skills validation
  if (frontmatter.skills && !Array.isArray(frontmatter.skills)) {
    result.errors.push('Skills must be an array');
    result.valid = false;
  }

  return result;
}

function validateMarkdownFile(filePath: string): ValidationResult {
  const result: ValidationResult = {
    file: filePath,
    valid: true,
    errors: [],
    warnings: [],
  };

  const content = readFile(filePath);
  if (!content) {
    result.valid = false;
    result.errors.push('Unable to read file');
    return result;
  }

  // File size check
  const stats = fs.statSync(filePath);
  const sizeKb = stats.size / 1024;
  if (sizeKb > CONFIG.maxFileSizeKb) {
    result.warnings.push(
      `File size (${sizeKb.toFixed(1)}KB) exceeds recommended max (${CONFIG.maxFileSizeKb}KB)`
    );
  }

  // Line count check
  const lines = content.split('\n').length;
  if (lines > CONFIG.maxFileLines) {
    result.warnings.push(
      `Line count (${lines}) exceeds recommended max (${CONFIG.maxFileLines})`
    );
  }

  // Check for placeholder text
  if (content.includes('[Date]') || content.includes('[Name/Team]')) {
    result.warnings.push('Contains unresolved placeholder text');
  }

  // Check for broken markdown links
  const linkPattern = /\[([^\]]+)\]\(([^)]+)\)/g;
  let match;
  while ((match = linkPattern.exec(content)) !== null) {
    const linkTarget = match[2];
    // Check internal links only (not URLs)
    if (!linkTarget.startsWith('http') && !linkTarget.startsWith('#')) {
      const absolutePath = path.resolve(path.dirname(filePath), linkTarget);
      if (!fileExists(absolutePath)) {
        result.warnings.push(`Potentially broken link: ${linkTarget}`);
      }
    }
  }

  return result;
}

function validateShellScript(filePath: string): ValidationResult {
  const result: ValidationResult = {
    file: filePath,
    valid: true,
    errors: [],
    warnings: [],
  };

  const content = readFile(filePath);
  if (!content) {
    result.valid = false;
    result.errors.push('Unable to read file');
    return result;
  }

  // Check shebang
  if (!content.startsWith('#!/bin/bash')) {
    result.warnings.push('Missing or incorrect shebang (expected #!/bin/bash)');
  }

  // Check for set -e
  if (!content.includes('set -e')) {
    result.warnings.push('Missing "set -e" for error handling');
  }

  // Check for executable permission marker
  const stats = fs.statSync(filePath);
  const isExecutable = (stats.mode & parseInt('0111', 8)) !== 0;
  if (!isExecutable) {
    result.warnings.push('File is not executable (chmod +x required)');
  }

  return result;
}

function validateYamlSyntax(content: string): { valid: boolean; error?: string } {
  try {
    yaml.parse(content);
    return { valid: true };
  } catch (error) {
    return { valid: false, error: String(error) };
  }
}

// Main validation function
async function validateTemplates(options: {
  fix?: boolean;
  verbose?: boolean;
}): Promise<ValidationSummary> {
  const summary: ValidationSummary = {
    totalFiles: 0,
    validFiles: 0,
    invalidFiles: 0,
    totalErrors: 0,
    totalWarnings: 0,
    results: [],
  };

  log('\n=== Template Validation Report ===\n', colors.bold + colors.blue);

  // Validate agent files
  log('Validating Agent Templates...', colors.bold);
  const agentFiles = getFiles('templates/.claude/agents', /\.md$/);

  for (const file of agentFiles) {
    summary.totalFiles++;
    const content = readFile(file);
    if (!content) continue;

    const frontmatterResult = validateAgentFrontmatter(file, content);
    const markdownResult = validateMarkdownFile(file);

    const combinedResult: ValidationResult = {
      file,
      valid: frontmatterResult.valid && markdownResult.valid,
      errors: [...frontmatterResult.errors, ...markdownResult.errors],
      warnings: [...frontmatterResult.warnings, ...markdownResult.warnings],
    };

    summary.results.push(combinedResult);
    summary.totalErrors += combinedResult.errors.length;
    summary.totalWarnings += combinedResult.warnings.length;

    if (combinedResult.valid) {
      summary.validFiles++;
      if (options.verbose) {
        logSuccess(`PASS: ${path.basename(file)}`);
      }
    } else {
      summary.invalidFiles++;
      logError(`FAIL: ${path.basename(file)}`);
      combinedResult.errors.forEach((e) => logError(`  - ${e}`));
    }

    if (options.verbose && combinedResult.warnings.length > 0) {
      combinedResult.warnings.forEach((w) => logWarning(`  - ${w}`));
    }
  }

  // Validate hook files
  log('\nValidating Hook Scripts...', colors.bold);
  const hookFiles = getFiles('templates/.claude/hooks', /\.sh$/);

  for (const file of hookFiles) {
    summary.totalFiles++;
    const result = validateShellScript(file);

    summary.results.push(result);
    summary.totalErrors += result.errors.length;
    summary.totalWarnings += result.warnings.length;

    if (result.valid) {
      summary.validFiles++;
      if (options.verbose) {
        logSuccess(`PASS: ${path.basename(file)}`);
      }
    } else {
      summary.invalidFiles++;
      logError(`FAIL: ${path.basename(file)}`);
      result.errors.forEach((e) => logError(`  - ${e}`));
    }

    if (options.verbose && result.warnings.length > 0) {
      result.warnings.forEach((w) => logWarning(`  - ${w}`));
    }
  }

  // Validate command files
  log('\nValidating Command Templates...', colors.bold);
  const commandFiles = getFiles('templates/.claude/commands', /\.md$/);

  for (const file of commandFiles) {
    summary.totalFiles++;
    const result = validateMarkdownFile(file);

    summary.results.push(result);
    summary.totalErrors += result.errors.length;
    summary.totalWarnings += result.warnings.length;

    if (result.valid) {
      summary.validFiles++;
      if (options.verbose) {
        logSuccess(`PASS: ${path.basename(file)}`);
      }
    } else {
      summary.invalidFiles++;
      logError(`FAIL: ${path.basename(file)}`);
      result.errors.forEach((e) => logError(`  - ${e}`));
    }

    if (options.verbose && result.warnings.length > 0) {
      result.warnings.forEach((w) => logWarning(`  - ${w}`));
    }
  }

  // Validate root configuration files
  log('\nValidating Configuration Files...', colors.bold);
  const configFiles = [
    'templates/.claude/CLAUDE.md',
    'templates/.claude/conventions.md',
    'templates/.claude/README.md',
    'templates/.claude/SETUP_GUIDE.md',
    'packages/@wundr/computer-setup/resources/templates/CLAUDE.md.template',
  ];

  for (const file of configFiles) {
    if (!fileExists(file)) {
      logWarning(`File not found: ${file}`);
      continue;
    }

    summary.totalFiles++;
    const result = validateMarkdownFile(file);

    summary.results.push(result);
    summary.totalErrors += result.errors.length;
    summary.totalWarnings += result.warnings.length;

    if (result.valid) {
      summary.validFiles++;
      if (options.verbose) {
        logSuccess(`PASS: ${path.basename(file)}`);
      }
    } else {
      summary.invalidFiles++;
      logError(`FAIL: ${path.basename(file)}`);
      result.errors.forEach((e) => logError(`  - ${e}`));
    }

    if (options.verbose && result.warnings.length > 0) {
      result.warnings.forEach((w) => logWarning(`  - ${w}`));
    }
  }

  // Check for model version consistency
  log('\nValidating Model Version Consistency...', colors.bold);
  const modelVersions = new Set<string>();
  for (const file of agentFiles) {
    const content = readFile(file);
    if (!content) continue;
    const frontmatter = extractFrontmatter(content);
    if (frontmatter?.model) {
      modelVersions.add(frontmatter.model);
    }
  }

  if (modelVersions.size === 1) {
    logSuccess(`All agents use consistent model: ${Array.from(modelVersions)[0]}`);
  } else if (modelVersions.size > 1) {
    logWarning(`Inconsistent model versions found: ${Array.from(modelVersions).join(', ')}`);
  }

  // Check for required directories
  log('\nValidating Directory Structure...', colors.bold);
  const requiredDirs = [
    'templates/.claude/agents/core',
    'templates/.claude/agents/github',
    'templates/.claude/agents/sparc',
    'templates/.claude/agents/specialized',
    'templates/.claude/agents/swarm',
    'templates/.claude/hooks',
    'templates/.claude/commands',
  ];

  for (const dir of requiredDirs) {
    if (fileExists(dir)) {
      if (options.verbose) {
        logSuccess(`Directory exists: ${dir}`);
      }
    } else {
      logWarning(`Missing directory: ${dir}`);
    }
  }

  // Print summary
  log('\n=== Validation Summary ===\n', colors.bold + colors.blue);
  log(`Total Files: ${summary.totalFiles}`);
  log(`Valid: ${summary.validFiles}`, colors.green);
  log(`Invalid: ${summary.invalidFiles}`, summary.invalidFiles > 0 ? colors.red : colors.green);
  log(`Errors: ${summary.totalErrors}`, summary.totalErrors > 0 ? colors.red : colors.green);
  log(`Warnings: ${summary.totalWarnings}`, summary.totalWarnings > 0 ? colors.yellow : colors.green);

  const passRate = ((summary.validFiles / summary.totalFiles) * 100).toFixed(1);
  log(`\nPass Rate: ${passRate}%`, parseFloat(passRate) === 100 ? colors.green : colors.yellow);

  if (summary.invalidFiles === 0 && summary.totalErrors === 0) {
    log('\nAll templates are valid!', colors.bold + colors.green);
  } else {
    log('\nSome templates have issues that need attention.', colors.bold + colors.yellow);
  }

  return summary;
}

// CLI handling
const args = process.argv.slice(2);
const options = {
  fix: args.includes('--fix'),
  verbose: args.includes('--verbose') || args.includes('-v'),
};

if (args.includes('--help') || args.includes('-h')) {
  console.log(`
Template Validation Script

Usage:
  npx tsx scripts/validate-templates.ts [options]

Options:
  --verbose, -v    Show detailed output including warnings
  --fix            Attempt to fix issues automatically (not yet implemented)
  --help, -h       Show this help message

Examples:
  npx tsx scripts/validate-templates.ts
  npx tsx scripts/validate-templates.ts --verbose
  npx tsx scripts/validate-templates.ts --fix
`);
  process.exit(0);
}

// Run validation
validateTemplates(options)
  .then((summary) => {
    process.exit(summary.invalidFiles > 0 ? 1 : 0);
  })
  .catch((error) => {
    console.error('Validation failed:', error);
    process.exit(1);
  });
