/**
 * Skill Validator
 *
 * Validates skill definitions for correctness and completeness before
 * registration. Checks frontmatter fields, tool availability, model
 * availability, dependency existence, and structural integrity.
 *
 * @module skills/skill-validator
 */

import * as fs from 'fs';

import type {
  Skill,
  SkillEntry,
  SkillsConfig,
  SkillValidationIssue,
  SkillValidationResult,
  SkillValidationSeverity,
} from './types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_SKILL_NAME_LENGTH = 64;
const SKILL_NAME_PATTERN = /^[a-z0-9][a-z0-9_-]*$/;
const MAX_DESCRIPTION_LENGTH = 500;
const MAX_BODY_LENGTH = 100_000; // 100KB

// ---------------------------------------------------------------------------
// Validator
// ---------------------------------------------------------------------------

/**
 * Validate a single skill entry against all rules.
 *
 * @param entry - The skill entry to validate
 * @param config - Skills configuration (for available tools/models)
 * @param registeredNames - Set of all registered skill names (for dep checks)
 * @returns Validation result with all found issues
 */
export function validateSkill(
  entry: SkillEntry,
  config?: SkillsConfig,
  registeredNames?: Set<string>,
): SkillValidationResult {
  const issues: SkillValidationIssue[] = [];
  const skill = entry.skill;

  // Name validation
  validateName(skill, issues);

  // Description validation
  validateDescription(skill, issues);

  // Body validation
  validateBody(skill, issues);

  // Tools validation
  validateTools(skill, config, issues);

  // Model validation
  validateModel(skill, config, issues);

  // Dependency validation
  validateDependencies(skill, registeredNames, issues);

  // Context validation
  validateContext(skill, issues);

  // File existence
  validateFileExists(skill, issues);

  // Version format
  validateVersion(skill, issues);

  const hasErrors = issues.some(i => i.severity === 'error');

  return {
    skillName: skill.name,
    valid: !hasErrors,
    issues,
  };
}

/**
 * Validate all entries in a collection.
 *
 * @param entries - All entries to validate
 * @param config - Skills configuration
 * @returns Array of validation results, one per skill
 */
export function validateAllSkills(
  entries: SkillEntry[],
  config?: SkillsConfig,
): SkillValidationResult[] {
  const registeredNames = new Set(entries.map(e => e.skill.name));

  return entries.map(entry =>
    validateSkill(entry, config, registeredNames),
  );
}

/**
 * Format validation results into a human-readable report.
 */
export function formatValidationReport(results: SkillValidationResult[]): string {
  const lines: string[] = [];
  const failCount = results.filter(r => !r.valid).length;
  const warnCount = results.filter(r =>
    r.valid && r.issues.some(i => i.severity === 'warning'),
  ).length;

  lines.push(`Skill Validation: ${results.length} skills checked`);
  lines.push(`  Passed: ${results.length - failCount}`);
  if (failCount > 0) {
lines.push(`  Failed: ${failCount}`);
}
  if (warnCount > 0) {
lines.push(`  Warnings: ${warnCount}`);
}

  for (const result of results) {
    if (result.issues.length === 0) {
continue;
}

    lines.push('');
    const status = result.valid ? 'WARN' : 'FAIL';
    lines.push(`  [${status}] ${result.skillName}:`);

    for (const issue of result.issues) {
      const sev = issue.severity.toUpperCase().padEnd(7);
      const field = issue.field ? ` (${issue.field})` : '';
      lines.push(`    [${sev}] ${issue.message}${field}`);
    }
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Individual Validators
// ---------------------------------------------------------------------------

function addIssue(
  issues: SkillValidationIssue[],
  severity: SkillValidationSeverity,
  rule: string,
  message: string,
  field?: string,
): void {
  issues.push({ rule, severity, message, field });
}

function validateName(skill: Skill, issues: SkillValidationIssue[]): void {
  if (!skill.name) {
    addIssue(issues, 'error', 'name-required', 'Skill name is required', 'name');
    return;
  }

  if (skill.name.length > MAX_SKILL_NAME_LENGTH) {
    addIssue(
      issues, 'warning', 'name-too-long',
      `Skill name exceeds ${MAX_SKILL_NAME_LENGTH} characters`,
      'name',
    );
  }

  if (!SKILL_NAME_PATTERN.test(skill.name)) {
    addIssue(
      issues, 'warning', 'name-format',
      'Skill name should use lowercase alphanumeric characters and hyphens',
      'name',
    );
  }
}

function validateDescription(skill: Skill, issues: SkillValidationIssue[]): void {
  if (!skill.description) {
    addIssue(issues, 'error', 'description-required', 'Skill description is required', 'description');
    return;
  }

  if (skill.description.length > MAX_DESCRIPTION_LENGTH) {
    addIssue(
      issues, 'warning', 'description-too-long',
      `Description exceeds ${MAX_DESCRIPTION_LENGTH} characters`,
      'description',
    );
  }
}

function validateBody(skill: Skill, issues: SkillValidationIssue[]): void {
  if (!skill.body || skill.body.trim().length === 0) {
    addIssue(issues, 'warning', 'body-empty', 'Skill body (instructions) is empty', 'body');
  }

  if (skill.body && skill.body.length > MAX_BODY_LENGTH) {
    addIssue(
      issues, 'warning', 'body-too-large',
      `Skill body exceeds ${MAX_BODY_LENGTH} characters`,
      'body',
    );
  }
}

function validateTools(
  skill: Skill,
  config: SkillsConfig | undefined,
  issues: SkillValidationIssue[],
): void {
  const availableTools = config?.availableTools;
  if (!availableTools || availableTools.length === 0) {
return;
}

  const toolSet = new Set(availableTools);

  // Check required tools
  const requiredTools = skill.frontmatter.tools ?? [];
  for (const tool of requiredTools) {
    if (!toolSet.has(tool)) {
      addIssue(
        issues, 'warning', 'tool-unavailable',
        `Required tool "${tool}" is not in the available tools list`,
        'tools',
      );
    }
  }

  // Check allowed tools
  const allowedTools = skill.frontmatter.allowedTools ?? [];
  for (const tool of allowedTools) {
    if (!toolSet.has(tool)) {
      addIssue(
        issues, 'info', 'allowed-tool-unavailable',
        `Allowed tool "${tool}" is not in the available tools list`,
        'allowedTools',
      );
    }
  }
}

function validateModel(
  skill: Skill,
  config: SkillsConfig | undefined,
  issues: SkillValidationIssue[],
): void {
  const model = skill.frontmatter.model;
  if (!model) {
return;
}

  const availableModels = config?.availableModels;
  if (!availableModels || availableModels.length === 0) {
return;
}

  if (!availableModels.includes(model)) {
    addIssue(
      issues, 'warning', 'model-unavailable',
      `Model "${model}" is not in the available models list`,
      'model',
    );
  }
}

function validateDependencies(
  skill: Skill,
  registeredNames: Set<string> | undefined,
  issues: SkillValidationIssue[],
): void {
  const deps = skill.frontmatter.dependencies;
  if (!deps || deps.length === 0) {
return;
}
  if (!registeredNames) {
return;
}

  for (const dep of deps) {
    if (!registeredNames.has(dep)) {
      addIssue(
        issues, 'warning', 'dependency-missing',
        `Dependency "${dep}" is not a registered skill`,
        'dependencies',
      );
    }

    if (dep === skill.name) {
      addIssue(
        issues, 'error', 'self-dependency',
        'Skill cannot depend on itself',
        'dependencies',
      );
    }
  }
}

function validateContext(skill: Skill, issues: SkillValidationIssue[]): void {
  const context = skill.frontmatter.context;
  if (context && context !== 'inline' && context !== 'fork') {
    addIssue(
      issues, 'error', 'invalid-context',
      `Invalid context "${context}": must be "inline" or "fork"`,
      'context',
    );
  }
}

function validateFileExists(skill: Skill, issues: SkillValidationIssue[]): void {
  if (!fs.existsSync(skill.filePath)) {
    addIssue(
      issues, 'error', 'file-missing',
      `Skill file does not exist: ${skill.filePath}`,
      'filePath',
    );
  }
}

function validateVersion(skill: Skill, issues: SkillValidationIssue[]): void {
  const version = skill.frontmatter.version;
  if (!version) {
return;
}

  // Simple semver check (major.minor.patch with optional pre-release)
  const semverPattern = /^\d+\.\d+\.\d+(-[a-zA-Z0-9.]+)?$/;
  if (!semverPattern.test(version)) {
    addIssue(
      issues, 'info', 'version-format',
      `Version "${version}" does not follow semver format (x.y.z)`,
      'version',
    );
  }
}
