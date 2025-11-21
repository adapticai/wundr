#!/usr/bin/env ts-node
/**
 * Agent Frontmatter Validation Script
 *
 * Validates that all agent markdown files in templates/.claude/agents/
 * have the required frontmatter fields with correct values.
 *
 * Required fields:
 * - name: agent-name (lowercase, kebab-case)
 * - description: Action-oriented description (<150 chars)
 * - tools: Array of tool names
 * - model: claude-sonnet-4-5
 * - permissionMode: "auto" | "require"
 * - skills: Array of skill identifiers
 *
 * Usage:
 *   npx ts-node scripts/validate-agent-frontmatter.ts
 *   npx ts-node scripts/validate-agent-frontmatter.ts --fix
 */

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';

interface AgentFrontmatter {
  name: string;
  description: string;
  tools: string[];
  model: string;
  permissionMode: 'auto' | 'require';
  skills: string[];
}

interface ValidationError {
  file: string;
  field: string;
  message: string;
  severity: 'error' | 'warning';
}

interface ValidationResult {
  file: string;
  valid: boolean;
  errors: ValidationError[];
  frontmatter: Partial<AgentFrontmatter> | null;
}

const REQUIRED_FIELDS = ['name', 'description', 'tools', 'model', 'permissionMode', 'skills'];
const VALID_MODELS = ['claude-sonnet-4-5', 'claude-sonnet-4-0', 'claude-3-5-sonnet'];
const VALID_PERMISSION_MODES = ['auto', 'require'];
const MAX_DESCRIPTION_LENGTH = 150;

const VALID_CLAUDE_TOOLS = [
  'Read',
  'Write',
  'Edit',
  'Glob',
  'Grep',
  'Bash',
  'TodoWrite',
  'WebFetch',
  'WebSearch',
  'NotebookEdit',
  'AskUserQuestion',
];

const VALID_MCP_TOOLS = [
  'drift_detection',
  'pattern_standardize',
  'monorepo_manage',
  'governance_report',
  'dependency_analyze',
  'test_baseline',
  'claude_config',
];

function extractFrontmatter(content: string): { frontmatter: string | null; body: string } {
  const frontmatterRegex = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/;
  const match = content.match(frontmatterRegex);

  if (match) {
    return {
      frontmatter: match[1],
      body: match[2],
    };
  }

  return {
    frontmatter: null,
    body: content,
  };
}

function parseFrontmatter(yamlContent: string): Partial<AgentFrontmatter> | null {
  try {
    return yaml.parse(yamlContent) as Partial<AgentFrontmatter>;
  } catch {
    return null;
  }
}

function validateFrontmatter(
  file: string,
  frontmatter: Partial<AgentFrontmatter> | null
): ValidationError[] {
  const errors: ValidationError[] = [];
  const fileName = path.basename(file, '.md');

  if (!frontmatter) {
    errors.push({
      file,
      field: 'frontmatter',
      message: 'Missing or invalid YAML frontmatter',
      severity: 'error',
    });
    return errors;
  }

  // Check required fields
  for (const field of REQUIRED_FIELDS) {
    if (!(field in frontmatter) || frontmatter[field as keyof AgentFrontmatter] === undefined) {
      errors.push({
        file,
        field,
        message: `Missing required field: ${field}`,
        severity: 'error',
      });
    }
  }

  // Validate name
  if (frontmatter.name) {
    if (!/^[a-z][a-z0-9-]*$/.test(frontmatter.name)) {
      errors.push({
        file,
        field: 'name',
        message: 'Name must be lowercase kebab-case (e.g., "coder", "pr-manager")',
        severity: 'error',
      });
    }
    if (frontmatter.name !== fileName) {
      errors.push({
        file,
        field: 'name',
        message: `Name "${frontmatter.name}" does not match filename "${fileName}"`,
        severity: 'warning',
      });
    }
  }

  // Validate description
  if (frontmatter.description) {
    if (frontmatter.description.length > MAX_DESCRIPTION_LENGTH) {
      errors.push({
        file,
        field: 'description',
        message: `Description exceeds ${MAX_DESCRIPTION_LENGTH} characters (${frontmatter.description.length})`,
        severity: 'warning',
      });
    }
    if (!/^[A-Z]/.test(frontmatter.description)) {
      errors.push({
        file,
        field: 'description',
        message: 'Description should start with a capital letter',
        severity: 'warning',
      });
    }
  }

  // Validate tools
  if (frontmatter.tools) {
    if (!Array.isArray(frontmatter.tools)) {
      errors.push({
        file,
        field: 'tools',
        message: 'Tools must be an array',
        severity: 'error',
      });
    } else {
      const allValidTools = [...VALID_CLAUDE_TOOLS, ...VALID_MCP_TOOLS];
      for (const tool of frontmatter.tools) {
        if (!allValidTools.includes(tool)) {
          errors.push({
            file,
            field: 'tools',
            message: `Unknown tool: "${tool}"`,
            severity: 'warning',
          });
        }
      }
    }
  }

  // Validate model
  if (frontmatter.model && !VALID_MODELS.includes(frontmatter.model)) {
    errors.push({
      file,
      field: 'model',
      message: `Invalid model: "${frontmatter.model}". Expected one of: ${VALID_MODELS.join(', ')}`,
      severity: 'error',
    });
  }

  // Validate permissionMode
  if (frontmatter.permissionMode && !VALID_PERMISSION_MODES.includes(frontmatter.permissionMode)) {
    errors.push({
      file,
      field: 'permissionMode',
      message: `Invalid permissionMode: "${frontmatter.permissionMode}". Expected one of: ${VALID_PERMISSION_MODES.join(', ')}`,
      severity: 'error',
    });
  }

  // Validate skills
  if (frontmatter.skills) {
    if (!Array.isArray(frontmatter.skills)) {
      errors.push({
        file,
        field: 'skills',
        message: 'Skills must be an array',
        severity: 'error',
      });
    } else if (frontmatter.skills.length === 0) {
      errors.push({
        file,
        field: 'skills',
        message: 'Skills array should not be empty',
        severity: 'warning',
      });
    } else {
      for (const skill of frontmatter.skills) {
        if (!/^[a-z][a-z0-9-]*$/.test(skill)) {
          errors.push({
            file,
            field: 'skills',
            message: `Invalid skill format: "${skill}". Should be lowercase kebab-case`,
            severity: 'warning',
          });
        }
      }
    }
  }

  return errors;
}

function findAgentFiles(baseDir: string): string[] {
  const files: string[] = [];

  function walk(dir: string): void {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        files.push(fullPath);
      }
    }
  }

  if (fs.existsSync(baseDir)) {
    walk(baseDir);
  }

  return files;
}

function validateFile(filePath: string): ValidationResult {
  const content = fs.readFileSync(filePath, 'utf-8');
  const { frontmatter: rawFrontmatter } = extractFrontmatter(content);
  const frontmatter = rawFrontmatter ? parseFrontmatter(rawFrontmatter) : null;
  const errors = validateFrontmatter(filePath, frontmatter);

  return {
    file: filePath,
    valid: errors.filter(e => e.severity === 'error').length === 0,
    errors,
    frontmatter,
  };
}

function printResults(results: ValidationResult[]): void {
  console.log('\n=== Agent Frontmatter Validation Results ===\n');

  let totalErrors = 0;
  let totalWarnings = 0;
  let validFiles = 0;

  for (const result of results) {
    const relativePath = path.relative(process.cwd(), result.file);
    const errors = result.errors.filter(e => e.severity === 'error');
    const warnings = result.errors.filter(e => e.severity === 'warning');

    totalErrors += errors.length;
    totalWarnings += warnings.length;

    if (result.valid) {
      validFiles++;
      console.log(`[PASS] ${relativePath}`);
    } else {
      console.log(`[FAIL] ${relativePath}`);
    }

    for (const error of errors) {
      console.log(`  ERROR: [${error.field}] ${error.message}`);
    }
    for (const warning of warnings) {
      console.log(`  WARNING: [${warning.field}] ${warning.message}`);
    }

    if (result.errors.length > 0) {
      console.log('');
    }
  }

  console.log('\n=== Summary ===');
  console.log(`Total files: ${results.length}`);
  console.log(`Valid files: ${validFiles}`);
  console.log(`Invalid files: ${results.length - validFiles}`);
  console.log(`Total errors: ${totalErrors}`);
  console.log(`Total warnings: ${totalWarnings}`);
  console.log('');

  if (totalErrors > 0) {
    console.log('Validation FAILED - please fix errors before committing.\n');
    process.exit(1);
  } else if (totalWarnings > 0) {
    console.log('Validation PASSED with warnings.\n');
  } else {
    console.log('Validation PASSED - all agent frontmatter is valid.\n');
  }
}

function main(): void {
  const args = process.argv.slice(2);
  const showHelp = args.includes('--help') || args.includes('-h');

  if (showHelp) {
    console.log(`
Agent Frontmatter Validation Script

Validates that all agent markdown files have required frontmatter fields.

Usage:
  npx ts-node scripts/validate-agent-frontmatter.ts [options]

Options:
  --help, -h    Show this help message
  --json        Output results as JSON

Required frontmatter fields:
  - name: Agent identifier (lowercase kebab-case)
  - description: Action-oriented description (<150 chars)
  - tools: Array of Claude Code and/or MCP tools
  - model: Model identifier (e.g., claude-sonnet-4-5)
  - permissionMode: "auto" or "require"
  - skills: Array of skill identifiers
    `);
    return;
  }

  const agentsDir = path.join(process.cwd(), 'templates', '.claude', 'agents');

  if (!fs.existsSync(agentsDir)) {
    console.error(`Error: Agents directory not found: ${agentsDir}`);
    process.exit(1);
  }

  const files = findAgentFiles(agentsDir);

  if (files.length === 0) {
    console.log('No agent markdown files found.');
    return;
  }

  const results = files.map(validateFile);

  if (args.includes('--json')) {
    console.log(JSON.stringify(results, null, 2));
  } else {
    printResults(results);
  }
}

main();
