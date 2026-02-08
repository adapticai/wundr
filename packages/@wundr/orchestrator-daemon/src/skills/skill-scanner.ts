/**
 * Skill Security Scanner
 *
 * Scans skill directories and source files for potentially malicious patterns.
 * Ported from OpenClaw's skill-scanner with Wundr-specific additions for
 * SKILL.md body content scanning (prompt injection detection).
 *
 * Scan Categories:
 * - Critical: Blocks skill loading (shell invocations, dynamic code, mining, credential theft)
 * - Warning: Logged but allowed (exfiltration patterns, obfuscation, unusual network)
 * - Info: Informational findings
 *
 * @module skills/skill-scanner
 */

import * as fs from 'fs/promises';
import * as path from 'path';

import type {
  SkillScanFinding,
  SkillScanOptions,
  SkillScanSeverity,
  SkillScanSummary,
} from './types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SCANNABLE_EXTENSIONS = new Set([
  '.js', '.ts', '.mjs', '.cjs', '.mts', '.cts', '.jsx', '.tsx',
]);

const DEFAULT_MAX_SCAN_FILES = 500;
const DEFAULT_MAX_FILE_BYTES = 1024 * 1024; // 1MB
const EVIDENCE_MAX_LENGTH = 120;

const IGNORED_DIRS = new Set(['.git', 'node_modules', 'dist', '.next', '__pycache__']);

// ---------------------------------------------------------------------------
// Rule Definitions
// ---------------------------------------------------------------------------

interface LineRule {
  ruleId: string;
  severity: SkillScanSeverity;
  message: string;
  pattern: RegExp;
  /** If set, the rule only fires when the full source also matches this pattern */
  requiresContext?: RegExp;
}

interface SourceRule {
  ruleId: string;
  severity: SkillScanSeverity;
  message: string;
  /** Primary pattern tested against the full source */
  pattern: RegExp;
  /** Secondary context pattern; both must match for the rule to fire */
  requiresContext?: RegExp;
}

/**
 * Line-level rules. Each pattern is tested per-line, with an optional
 * full-source context requirement.
 *
 * NOTE: These RegExp patterns match dangerous code in SCANNED files.
 * The scanner itself does not invoke any of these APIs.
 */
const LINE_RULES: LineRule[] = [
  {
    ruleId: 'dangerous-shell-invocation',
    severity: 'critical',
    message: 'Shell command invocation detected via process spawning API',
    // Detects: exec(, execSync(, spawn(, spawnSync(, execFile(, execFileSync(
    pattern: /\b(exec|execSync|spawn|spawnSync|execFile|execFileSync)\s*\(/,
    // Only trigger when the file also imports the process spawning module
    requiresContext: /child_process/,
  },
  {
    ruleId: 'dynamic-code-eval',
    severity: 'critical',
    message: 'Dynamic code evaluation detected via eval',
    pattern: /\beval\s*\(/,
  },
  {
    ruleId: 'dynamic-function-constructor',
    severity: 'critical',
    message: 'Dynamic function construction detected',
    pattern: /new\s+Function\s*\(/,
  },
  {
    ruleId: 'crypto-mining',
    severity: 'critical',
    message: 'Possible crypto-mining reference detected',
    pattern: /stratum\+tcp|stratum\+ssl|coinhive|cryptonight|xmrig/i,
  },
  {
    ruleId: 'suspicious-network',
    severity: 'warn',
    message: 'WebSocket connection to non-standard port',
    pattern: /new\s+WebSocket\s*\(\s*["']wss?:\/\/[^"']*:(\d+)/,
  },
  {
    ruleId: 'suspicious-require',
    severity: 'warn',
    message: 'Dynamic require with variable path',
    pattern: /require\s*\(\s*[^"'`\s]/,
  },
];

const STANDARD_PORTS = new Set([80, 443, 8080, 8443, 3000]);

/**
 * Source-level rules. Each pattern is tested against the entire file content,
 * with optional secondary context matching.
 */
const SOURCE_RULES: SourceRule[] = [
  {
    ruleId: 'potential-exfiltration',
    severity: 'warn',
    message: 'File read combined with network send -- possible data exfiltration',
    pattern: /readFileSync|readFile/,
    requiresContext: /\bfetch\b|\bpost\b|http\.request/i,
  },
  {
    ruleId: 'obfuscated-code-hex',
    severity: 'warn',
    message: 'Hex-encoded string sequence detected (possible obfuscation)',
    pattern: /(\\x[0-9a-fA-F]{2}){6,}/,
  },
  {
    ruleId: 'obfuscated-code-base64',
    severity: 'warn',
    message: 'Large base64 payload with decode call detected (possible obfuscation)',
    pattern: /(?:atob|Buffer\.from)\s*\(\s*["'][A-Za-z0-9+/=]{200,}["']/,
  },
  {
    ruleId: 'env-harvesting',
    severity: 'critical',
    message: 'Environment variable access combined with network send -- possible credential harvesting',
    pattern: /process\.env/,
    requiresContext: /\bfetch\b|\bpost\b|http\.request/i,
  },
];

// ---------------------------------------------------------------------------
// Prompt Injection Rules (for SKILL.md body scanning)
// ---------------------------------------------------------------------------

interface BodyRule {
  ruleId: string;
  severity: SkillScanSeverity;
  message: string;
  pattern: RegExp;
}

/**
 * Rules for scanning SKILL.md Markdown body content.
 * These detect prompt injection attempts and suspicious instructions.
 */
const BODY_RULES: BodyRule[] = [
  {
    ruleId: 'prompt-injection-ignore',
    severity: 'critical',
    message: 'Prompt injection: instruction to ignore previous context',
    pattern: /ignore\s+(all\s+)?(previous|prior|above)\s+(instructions|context|rules)/i,
  },
  {
    ruleId: 'prompt-injection-system',
    severity: 'critical',
    message: 'Prompt injection: attempts to override system prompt',
    pattern: /\[?\s*system\s*\]?\s*:\s*you\s+are/i,
  },
  {
    ruleId: 'prompt-injection-roleplay',
    severity: 'warn',
    message: 'Prompt injection: role assumption instruction',
    pattern: /from\s+now\s+on\s+(you\s+are|act\s+as|pretend\s+to\s+be)/i,
  },
  {
    ruleId: 'path-traversal',
    severity: 'critical',
    message: 'Path traversal detected: attempts to access files outside skill directory',
    pattern: /!\s*(cat|read|head|tail|less|more)\s+[^\n]*\.\.\//,
  },
  {
    ruleId: 'encoded-instructions',
    severity: 'warn',
    message: 'Base64-encoded content block detected in instructions',
    pattern: /[A-Za-z0-9+/=]{200,}/,
  },
  {
    ruleId: 'hidden-command',
    severity: 'warn',
    message: 'Shell command in HTML comment or invisible characters',
    pattern: /<!--[\s\S]*?!\s*\w+[\s\S]*?-->/,
  },
];

// ---------------------------------------------------------------------------
// Core Scanner
// ---------------------------------------------------------------------------

/**
 * Check if a file extension is scannable for source code patterns.
 */
export function isScannable(filePath: string): boolean {
  return SCANNABLE_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

/**
 * Truncate evidence string for display.
 */
function truncateEvidence(evidence: string, maxLen = EVIDENCE_MAX_LENGTH): string {
  return evidence.length <= maxLen
    ? evidence
    : evidence.slice(0, maxLen) + '...';
}

/**
 * Scan a source code string for malicious patterns.
 * Returns findings for all matched rules.
 */
export function scanSource(source: string, filePath: string): SkillScanFinding[] {
  const findings: SkillScanFinding[] = [];
  const lines = source.split('\n');
  const matchedLineRules = new Set<string>();

  // Line rules: test each line, report first match per rule
  for (const rule of LINE_RULES) {
    if (matchedLineRules.has(rule.ruleId)) continue;

    // Skip rule if context requirement is not met
    if (rule.requiresContext && !rule.requiresContext.test(source)) continue;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const match = rule.pattern.exec(line);
      if (!match) continue;

      // Special handling for suspicious-network: ignore standard ports
      if (rule.ruleId === 'suspicious-network') {
        const port = parseInt(match[1], 10);
        if (STANDARD_PORTS.has(port)) continue;
      }

      findings.push({
        ruleId: rule.ruleId,
        severity: rule.severity,
        file: filePath,
        line: i + 1,
        message: rule.message,
        evidence: truncateEvidence(line.trim()),
      });
      matchedLineRules.add(rule.ruleId);
      break; // One finding per line-rule per file
    }
  }

  // Source rules: test full source, report first match per rule+message combo
  const matchedSourceRules = new Set<string>();
  for (const rule of SOURCE_RULES) {
    const ruleKey = `${rule.ruleId}::${rule.message}`;
    if (matchedSourceRules.has(ruleKey)) continue;

    if (!rule.pattern.test(source)) continue;
    if (rule.requiresContext && !rule.requiresContext.test(source)) continue;

    // Find the first matching line for evidence
    let matchLine = 1;
    let matchEvidence = source.slice(0, 120);
    for (let i = 0; i < lines.length; i++) {
      if (rule.pattern.test(lines[i])) {
        matchLine = i + 1;
        matchEvidence = lines[i].trim();
        break;
      }
    }

    findings.push({
      ruleId: rule.ruleId,
      severity: rule.severity,
      file: filePath,
      line: matchLine,
      message: rule.message,
      evidence: truncateEvidence(matchEvidence),
    });
    matchedSourceRules.add(ruleKey);
  }

  return findings;
}

/**
 * Scan SKILL.md body content for prompt injection and suspicious patterns.
 */
export function scanSkillBody(body: string, filePath: string): SkillScanFinding[] {
  const findings: SkillScanFinding[] = [];
  const lines = body.split('\n');

  for (const rule of BODY_RULES) {
    for (let i = 0; i < lines.length; i++) {
      if (rule.pattern.test(lines[i])) {
        findings.push({
          ruleId: rule.ruleId,
          severity: rule.severity,
          file: filePath,
          line: i + 1,
          message: rule.message,
          evidence: truncateEvidence(lines[i].trim()),
        });
        break; // One finding per rule per file
      }
    }
  }

  return findings;
}

// ---------------------------------------------------------------------------
// Directory Scanner
// ---------------------------------------------------------------------------

function normalizeScanOptions(opts?: SkillScanOptions): Required<SkillScanOptions> {
  return {
    includeFiles: opts?.includeFiles ?? [],
    maxFiles: Math.max(1, opts?.maxFiles ?? DEFAULT_MAX_SCAN_FILES),
    maxFileBytes: Math.max(1, opts?.maxFileBytes ?? DEFAULT_MAX_FILE_BYTES),
  };
}

/**
 * Recursively walk a directory collecting scannable files up to a limit.
 */
async function walkDirWithLimit(dirPath: string, maxFiles: number): Promise<string[]> {
  const files: string[] = [];
  const stack: string[] = [dirPath];

  while (stack.length > 0 && files.length < maxFiles) {
    const currentDir = stack.pop();
    if (!currentDir) break;

    let entries: Awaited<ReturnType<typeof fs.readdir>>;
    try {
      entries = await fs.readdir(currentDir, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (files.length >= maxFiles) break;
      if (entry.name.startsWith('.') || IGNORED_DIRS.has(entry.name)) continue;

      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
      } else if (isScannable(entry.name)) {
        files.push(fullPath);
      }
    }
  }

  return files;
}

/**
 * Read a file for scanning, respecting size limits.
 */
async function readScannableSource(
  filePath: string,
  maxFileBytes: number,
): Promise<string | null> {
  try {
    const stat = await fs.stat(filePath);
    if (!stat.isFile() || stat.size > maxFileBytes) return null;
    return await fs.readFile(filePath, 'utf-8');
  } catch {
    return null;
  }
}

/**
 * Collect all scannable files in a directory, combining forced includes
 * with recursive directory walking.
 */
async function collectScannableFiles(
  dirPath: string,
  opts: Required<SkillScanOptions>,
): Promise<string[]> {
  // First collect forced-include files
  const forcedFiles: string[] = [];
  for (const rawPath of opts.includeFiles) {
    const includePath = path.resolve(dirPath, rawPath);
    if (!isPathInside(dirPath, includePath)) continue;
    if (!isScannable(includePath)) continue;

    try {
      const stat = await fs.stat(includePath);
      if (stat.isFile()) forcedFiles.push(includePath);
    } catch {
      continue;
    }
  }

  if (forcedFiles.length >= opts.maxFiles) {
    return forcedFiles.slice(0, opts.maxFiles);
  }

  // Walk directory for remaining files
  const walkedFiles = await walkDirWithLimit(dirPath, opts.maxFiles);
  const seen = new Set(forcedFiles.map(f => path.resolve(f)));
  const result = [...forcedFiles];

  for (const file of walkedFiles) {
    if (result.length >= opts.maxFiles) break;
    const resolved = path.resolve(file);
    if (seen.has(resolved)) continue;
    result.push(file);
    seen.add(resolved);
  }

  return result;
}

/**
 * Check if a path is inside a base directory (prevents path traversal).
 */
function isPathInside(basePath: string, candidatePath: string): boolean {
  const base = path.resolve(basePath);
  const candidate = path.resolve(candidatePath);
  const rel = path.relative(base, candidate);
  return rel === '' || (!rel.startsWith(`..${path.sep}`) && rel !== '..' && !path.isAbsolute(rel));
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Scan all source files in a skill directory for malicious patterns.
 *
 * @param dirPath - Absolute path to the skill directory
 * @param opts - Scan options (file limits, forced includes)
 * @returns Array of security findings
 */
export async function scanDirectory(
  dirPath: string,
  opts?: SkillScanOptions,
): Promise<SkillScanFinding[]> {
  const scanOptions = normalizeScanOptions(opts);
  const files = await collectScannableFiles(dirPath, scanOptions);
  const allFindings: SkillScanFinding[] = [];

  for (const file of files) {
    const source = await readScannableSource(file, scanOptions.maxFileBytes);
    if (source === null) continue;
    allFindings.push(...scanSource(source, file));
  }

  return allFindings;
}

/**
 * Scan a skill directory and return a structured summary with counts.
 *
 * @param dirPath - Absolute path to the skill directory
 * @param opts - Scan options
 * @returns Summary with finding counts and details
 */
export async function scanDirectoryWithSummary(
  dirPath: string,
  opts?: SkillScanOptions,
): Promise<SkillScanSummary> {
  const scanOptions = normalizeScanOptions(opts);
  const files = await collectScannableFiles(dirPath, scanOptions);
  const allFindings: SkillScanFinding[] = [];
  let scannedFiles = 0;

  for (const file of files) {
    const source = await readScannableSource(file, scanOptions.maxFileBytes);
    if (source === null) continue;
    scannedFiles++;
    allFindings.push(...scanSource(source, file));
  }

  return {
    scannedFiles,
    critical: allFindings.filter(f => f.severity === 'critical').length,
    warn: allFindings.filter(f => f.severity === 'warn').length,
    info: allFindings.filter(f => f.severity === 'info').length,
    findings: allFindings,
  };
}

/**
 * Perform a complete security scan of a skill, including both source code
 * files and the SKILL.md body content.
 *
 * @param skillDir - Absolute path to the skill directory
 * @param skillBody - The Markdown body content of the SKILL.md
 * @param skillFilePath - Absolute path to the SKILL.md file (for reporting)
 * @param opts - Scan options
 * @returns Combined summary of all findings
 */
export async function scanSkillComplete(
  skillDir: string,
  skillBody: string,
  skillFilePath: string,
  opts?: SkillScanOptions,
): Promise<SkillScanSummary> {
  // Scan source code files
  const dirSummary = await scanDirectoryWithSummary(skillDir, opts);

  // Scan SKILL.md body
  const bodyFindings = scanSkillBody(skillBody, skillFilePath);

  // Combine results
  const allFindings = [...dirSummary.findings, ...bodyFindings];

  return {
    scannedFiles: dirSummary.scannedFiles + 1, // +1 for SKILL.md body
    critical: allFindings.filter(f => f.severity === 'critical').length,
    warn: allFindings.filter(f => f.severity === 'warn').length,
    info: allFindings.filter(f => f.severity === 'info').length,
    findings: allFindings,
  };
}

/**
 * Check if a scan summary has any critical findings that should block loading.
 */
export function hasCriticalFindings(summary: SkillScanSummary): boolean {
  return summary.critical > 0;
}

/**
 * Format scan findings as a human-readable report.
 */
export function formatScanReport(summary: SkillScanSummary): string {
  const lines: string[] = [
    `Security Scan Results:`,
    `  Files scanned: ${summary.scannedFiles}`,
    `  Critical: ${summary.critical}`,
    `  Warnings: ${summary.warn}`,
    `  Info: ${summary.info}`,
  ];

  if (summary.findings.length > 0) {
    lines.push('', 'Findings:');
    for (const finding of summary.findings) {
      const severity = finding.severity.toUpperCase().padEnd(8);
      lines.push(
        `  [${severity}] ${finding.message}`,
        `    File: ${finding.file}:${finding.line}`,
        `    Evidence: ${finding.evidence}`,
      );
    }
  }

  return lines.join('\n');
}
