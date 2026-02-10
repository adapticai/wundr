/**
 * Plugin Static Code Analysis
 *
 * Scans plugin source files for dangerous patterns before any code is loaded
 * into the process. Inspired by OpenClaw's skill-scanner.ts, extended with
 * plugin-specific rules for dynamic require, prototype pollution, native
 * addons, and undeclared resource access.
 *
 * The scanner never evaluates plugin code. All detection is regex-based
 * against source text.
 */

import * as fs from 'fs/promises';
import * as path from 'path';

import type { PluginManifest } from './plugin-manifest';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ScanSeverity = 'info' | 'warn' | 'critical';

export type ScanFinding = {
  ruleId: string;
  severity: ScanSeverity;
  file: string;
  line: number;
  message: string;
  evidence: string;
};

export type ScanSummary = {
  scannedFiles: number;
  critical: number;
  warn: number;
  info: number;
  findings: ScanFinding[];
  passed: boolean;
};

export type ScanOptions = {
  /** Maximum number of files to scan. */
  maxFiles?: number;
  /** Maximum size of a single file in bytes. */
  maxFileBytes?: number;
  /** Fail if any critical findings are present (default: true). */
  failOnCritical?: boolean;
  /** Maximum number of warnings before failing (0 = unlimited). */
  maxWarnings?: number;
  /** Plugin manifest for context-aware scanning. */
  manifest?: PluginManifest;
};

// ---------------------------------------------------------------------------
// Scannable Extensions
// ---------------------------------------------------------------------------

const SCANNABLE_EXTENSIONS = new Set([
  '.js',
  '.ts',
  '.mjs',
  '.cjs',
  '.mts',
  '.cts',
  '.jsx',
  '.tsx',
]);

const DEFAULT_MAX_FILES = 500;
const DEFAULT_MAX_FILE_BYTES = 1024 * 1024; // 1 MB

function isScannable(filePath: string): boolean {
  return SCANNABLE_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

// ---------------------------------------------------------------------------
// Rule Definitions
// ---------------------------------------------------------------------------

type LineRule = {
  ruleId: string;
  severity: ScanSeverity;
  message: string;
  pattern: RegExp;
  /** If set, the rule only fires when the full source also matches this pattern. */
  requiresContext?: RegExp;
};

type SourceRule = {
  ruleId: string;
  severity: ScanSeverity;
  message: string;
  pattern: RegExp;
  requiresContext?: RegExp;
};

/**
 * LINE_RULES are tested per-line. Each rule fires at most once per file
 * (first matching line).
 */
const LINE_RULES: LineRule[] = [
  // --- Critical: Arbitrary code execution ---
  {
    ruleId: 'dangerous-exec',
    severity: 'critical',
    message: 'Shell command execution detected via child_process',
    // Detects exec(), execSync(), spawn(), spawnSync(), execFile(), execFileSync()
    // Only fires when the file also references child_process.
    pattern: /\b(exec|execSync|spawn|spawnSync|execFile|execFileSync)\s*\(/,
    requiresContext: /child_process/,
  },
  {
    ruleId: 'dynamic-code-execution',
    severity: 'critical',
    message: 'Dynamic code execution detected',
    // Detects eval(...) and new Function(...) constructor usage
    pattern: /\beval\s*\(|new\s+Function\s*\(/,
  },

  // --- Critical: Crypto mining ---
  {
    ruleId: 'crypto-mining',
    severity: 'critical',
    message: 'Possible crypto-mining reference detected',
    pattern: /stratum\+tcp|stratum\+ssl|coinhive|cryptonight|xmrig/i,
  },

  // --- Critical: Native addons ---
  {
    ruleId: 'native-addon-load',
    severity: 'critical',
    message: 'Native addon loading detected (.node binding)',
    pattern: /require\s*\(\s*['"][^'"]*\.node['"]\s*\)|process\.dlopen\s*\(/,
  },

  // --- Warn: Dynamic require ---
  {
    ruleId: 'dynamic-require',
    severity: 'warn',
    message: 'Dynamic require with non-literal argument detected',
    pattern: /\brequire\s*\(\s*[^'"]/,
  },

  // --- Warn: Process manipulation ---
  {
    ruleId: 'global-process-access',
    severity: 'warn',
    message: 'Direct process manipulation detected',
    pattern: /\bprocess\.(exit|kill|abort)\s*\(/,
  },

  // --- Warn: Prototype pollution ---
  {
    ruleId: 'prototype-pollution',
    severity: 'warn',
    message: 'Potential prototype pollution pattern detected',
    pattern: /__proto__|constructor\s*\[\s*['"]prototype['"]\s*\]|Object\.setPrototypeOf/,
  },

  // --- Warn: Suspicious network ---
  {
    ruleId: 'suspicious-network',
    severity: 'warn',
    message: 'WebSocket connection to non-standard port',
    pattern: /new\s+WebSocket\s*\(\s*["']wss?:\/\/[^"']*:(\d+)/,
  },

  // --- Warn: Global override ---
  {
    ruleId: 'global-override',
    severity: 'warn',
    message: 'Global object modification detected',
    pattern: /\bglobalThis\s*\[|global\s*\.\s*\w+\s*=|Object\.defineProperty\s*\(\s*global/,
  },

  // --- Info: Debugger statements ---
  {
    ruleId: 'debugger-statement',
    severity: 'info',
    message: 'Debugger statement found (should be removed in production)',
    pattern: /\bdebugger\b/,
  },
];

const STANDARD_PORTS = new Set([80, 443, 8080, 8443, 3000]);

/**
 * SOURCE_RULES are tested against the full file contents. They detect
 * cross-line patterns like data exfiltration (file read + network send).
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
  {
    ruleId: 'env-dump',
    severity: 'critical',
    message: 'Bulk environment variable enumeration detected',
    pattern: /JSON\.stringify\s*\(\s*process\.env\s*\)|Object\.(keys|entries|values)\s*\(\s*process\.env\s*\)/,
  },
  {
    ruleId: 'reverse-shell',
    severity: 'critical',
    message: 'Possible reverse shell pattern detected',
    pattern: /net\.Socket|net\.connect/,
    requiresContext: /child_process|\/bin\/(ba)?sh/,
  },
];

// ---------------------------------------------------------------------------
// Evidence Formatting
// ---------------------------------------------------------------------------

function truncateEvidence(evidence: string, maxLen = 120): string {
  if (evidence.length <= maxLen) {
    return evidence;
  }
  return `${evidence.slice(0, maxLen)}...`;
}

// ---------------------------------------------------------------------------
// Core Scanner
// ---------------------------------------------------------------------------

/**
 * Scan a single source string for dangerous patterns.
 */
export function scanSource(source: string, filePath: string): ScanFinding[] {
  const findings: ScanFinding[] = [];
  const lines = source.split('\n');
  const matchedLineRules = new Set<string>();

  // --- Line rules ---
  for (const rule of LINE_RULES) {
    if (matchedLineRules.has(rule.ruleId)) {
      continue;
    }

    if (rule.requiresContext && !rule.requiresContext.test(source)) {
      continue;
    }

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line) {
continue;
}

      const match = rule.pattern.exec(line);
      if (!match) {
continue;
}

      // Special handling for suspicious-network: check port
      if (rule.ruleId === 'suspicious-network') {
        const port = parseInt(match[1] ?? '0', 10);
        if (STANDARD_PORTS.has(port)) {
          continue;
        }
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

  // --- Source rules ---
  const matchedSourceRules = new Set<string>();
  for (const rule of SOURCE_RULES) {
    const ruleKey = `${rule.ruleId}::${rule.message}`;
    if (matchedSourceRules.has(ruleKey)) {
      continue;
    }

    if (!rule.pattern.test(source)) {
      continue;
    }
    if (rule.requiresContext && !rule.requiresContext.test(source)) {
      continue;
    }

    // Find the first matching line for evidence
    let matchLine = 0;
    let matchEvidence = '';
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line && rule.pattern.test(line)) {
        matchLine = i + 1;
        matchEvidence = line.trim();
        break;
      }
    }

    if (matchLine === 0) {
      matchLine = 1;
      matchEvidence = source.slice(0, 120);
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

// ---------------------------------------------------------------------------
// Manifest-Aware Rules
// ---------------------------------------------------------------------------

/**
 * Additional checks that use the manifest to detect undeclared access.
 * These run after the base scan and add findings for resource usage
 * not declared in the plugin manifest.
 */
export function scanSourceWithManifest(
  source: string,
  filePath: string,
  manifest: PluginManifest,
): ScanFinding[] {
  const findings: ScanFinding[] = [];
  const lines = source.split('\n');

  // Detect undeclared network hosts
  const declaredHosts = new Set(manifest.permissions.network.hosts.map(h => h.toLowerCase()));
  const urlPattern = /(?:https?:\/\/)([a-zA-Z0-9.-]+)/g;
  const seenHosts = new Set<string>();
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) {
continue;
}

    let match: RegExpExecArray | null;
    while ((match = urlPattern.exec(line)) !== null) {
      const host = (match[1] ?? '').toLowerCase();
      if (host && !seenHosts.has(host) && !declaredHosts.has(host) && host !== 'localhost') {
        seenHosts.add(host);
        findings.push({
          ruleId: 'undeclared-network',
          severity: 'warn',
          file: filePath,
          line: i + 1,
          message: `Network access to undeclared host "${host}" (not in manifest permissions.network.hosts)`,
          evidence: truncateEvidence(line.trim()),
        });
      }
    }
    urlPattern.lastIndex = 0;
  }

  // Detect absolute filesystem paths outside declared permissions
  const absolutePathPattern = /(?:['"`])(\/((?:usr|home|var|opt|tmp|etc)[^\s'"`,;)}\]]*))(?:['"`])/g;
  const declaredReadPaths = manifest.permissions.filesystem.read;
  const declaredWritePaths = manifest.permissions.filesystem.write;
  const allDeclaredPaths = [...declaredReadPaths, ...declaredWritePaths];
  const seenAbsPaths = new Set<string>();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) {
continue;
}

    let match: RegExpExecArray | null;
    while ((match = absolutePathPattern.exec(line)) !== null) {
      const absPath = match[1] ?? '';
      if (absPath && !seenAbsPaths.has(absPath)) {
        seenAbsPaths.add(absPath);
        const isDeclared = allDeclaredPaths.some(
          declared => absPath.startsWith(declared) || declared.startsWith(absPath),
        );
        if (!isDeclared) {
          findings.push({
            ruleId: 'fs-outside-sandbox',
            severity: 'critical',
            file: filePath,
            line: i + 1,
            message: `Filesystem access to undeclared path "${absPath}"`,
            evidence: truncateEvidence(line.trim()),
          });
        }
      }
    }
    absolutePathPattern.lastIndex = 0;
  }

  return findings;
}

// ---------------------------------------------------------------------------
// Directory Scanner
// ---------------------------------------------------------------------------

async function walkDirWithLimit(dirPath: string, maxFiles: number): Promise<string[]> {
  const files: string[] = [];
  const stack: string[] = [dirPath];

  while (stack.length > 0 && files.length < maxFiles) {
    const currentDir = stack.pop();
    if (!currentDir) {
break;
}

    // eslint-disable-next-line @typescript-eslint/consistent-type-imports
    let entries: import('fs').Dirent[];
    try {
      entries = await fs.readdir(currentDir, { withFileTypes: true, encoding: 'utf-8' });
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (files.length >= maxFiles) {
break;
}

      // Skip hidden dirs and node_modules
      if (entry.name.startsWith('.') || entry.name === 'node_modules') {
        continue;
      }

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

async function readFileIfSmall(filePath: string, maxBytes: number): Promise<string | null> {
  try {
    const stat = await fs.stat(filePath);
    if (!stat.isFile() || stat.size > maxBytes) {
      return null;
    }
    return await fs.readFile(filePath, 'utf-8');
  } catch {
    return null;
  }
}

/**
 * Scan all scannable files in a plugin directory.
 */
export async function scanPluginDirectory(
  pluginDir: string,
  options?: ScanOptions,
): Promise<ScanSummary> {
  const maxFiles = Math.max(1, options?.maxFiles ?? DEFAULT_MAX_FILES);
  const maxFileBytes = Math.max(1, options?.maxFileBytes ?? DEFAULT_MAX_FILE_BYTES);
  const failOnCritical = options?.failOnCritical ?? true;
  const maxWarnings = options?.maxWarnings ?? 0;
  const manifest = options?.manifest;

  const files = await walkDirWithLimit(pluginDir, maxFiles);
  const allFindings: ScanFinding[] = [];
  let scannedFiles = 0;

  for (const file of files) {
    const source = await readFileIfSmall(file, maxFileBytes);
    if (source === null || source === undefined) {
continue;
}

    scannedFiles++;

    // Base scan
    const baseFindings = scanSource(source, file);
    allFindings.push(...baseFindings);

    // Manifest-aware scan
    if (manifest) {
      const manifestFindings = scanSourceWithManifest(source, file, manifest);
      allFindings.push(...manifestFindings);
    }
  }

  const critical = allFindings.filter(f => f.severity === 'critical').length;
  const warn = allFindings.filter(f => f.severity === 'warn').length;
  const info = allFindings.filter(f => f.severity === 'info').length;

  let passed = true;
  if (failOnCritical && critical > 0) {
    passed = false;
  }
  if (maxWarnings > 0 && warn > maxWarnings) {
    passed = false;
  }

  return { scannedFiles, critical, warn, info, findings: allFindings, passed };
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

/**
 * Format scan findings into a human-readable report.
 */
export function formatScanReport(summary: ScanSummary): string {
  const lines: string[] = [];
  lines.push('Plugin Scan Report');
  lines.push('==================');
  lines.push(`Files scanned: ${summary.scannedFiles}`);
  lines.push(`Critical: ${summary.critical}  Warn: ${summary.warn}  Info: ${summary.info}`);
  lines.push(`Result: ${summary.passed ? 'PASSED' : 'FAILED'}`);
  lines.push('');

  if (summary.findings.length === 0) {
    lines.push('No findings.');
    return lines.join('\n');
  }

  // Group by severity
  const bySeverity = new Map<ScanSeverity, ScanFinding[]>();
  for (const f of summary.findings) {
    const group = bySeverity.get(f.severity) ?? [];
    group.push(f);
    bySeverity.set(f.severity, group);
  }

  for (const severity of ['critical', 'warn', 'info'] as ScanSeverity[]) {
    const group = bySeverity.get(severity);
    if (!group || group.length === 0) {
continue;
}

    lines.push(`--- ${severity.toUpperCase()} ---`);
    for (const f of group) {
      lines.push(`  [${f.ruleId}] ${f.file}:${f.line}`);
      lines.push(`    ${f.message}`);
      lines.push(`    Evidence: ${f.evidence}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}
