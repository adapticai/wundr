import type {
  FilteredOutput,
  Redaction,
  SensitiveDataPattern,
  Severity,
} from './types';

/**
 * Default sensitive data patterns for common data types
 */
const DEFAULT_SENSITIVE_PATTERNS: SensitiveDataPattern[] = [
  {
    id: 'credit-card',
    name: 'Credit Card Number',
    pattern: '\\b(?:\\d{4}[- ]?){3}\\d{4}\\b',
    replacement: '[REDACTED:CREDIT_CARD]',
    enabled: true,
    severity: 'critical',
  },
  {
    id: 'ssn',
    name: 'Social Security Number',
    pattern: '\\b\\d{3}-\\d{2}-\\d{4}\\b',
    replacement: '[REDACTED:SSN]',
    enabled: true,
    severity: 'critical',
  },
  {
    id: 'email',
    name: 'Email Address',
    pattern: '\\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Z|a-z]{2,}\\b',
    replacement: '[REDACTED:EMAIL]',
    enabled: true,
    severity: 'medium',
  },
  {
    id: 'phone-us',
    name: 'US Phone Number',
    pattern: '\\b(?:\\+1[- ]?)?\\(?\\d{3}\\)?[- ]?\\d{3}[- ]?\\d{4}\\b',
    replacement: '[REDACTED:PHONE]',
    enabled: true,
    severity: 'medium',
  },
  {
    id: 'api-key',
    name: 'API Key',
    pattern:
      '\\b(?:api[_-]?key|apikey|api_secret)[\\s:=]+["\']?([a-zA-Z0-9_-]{20,})["\']?',
    replacement: '[REDACTED:API_KEY]',
    enabled: true,
    severity: 'critical',
  },
  {
    id: 'aws-access-key',
    name: 'AWS Access Key',
    pattern: '\\bAKIA[0-9A-Z]{16}\\b',
    replacement: '[REDACTED:AWS_KEY]',
    enabled: true,
    severity: 'critical',
  },
  {
    id: 'aws-secret-key',
    name: 'AWS Secret Key',
    pattern: '\\b[A-Za-z0-9/+=]{40}\\b',
    replacement: '[REDACTED:AWS_SECRET]',
    enabled: false, // High false positive rate, disabled by default
    severity: 'critical',
  },
  {
    id: 'private-key',
    name: 'Private Key',
    pattern: '-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----',
    replacement: '[REDACTED:PRIVATE_KEY]',
    enabled: true,
    severity: 'critical',
  },
  {
    id: 'jwt-token',
    name: 'JWT Token',
    pattern: '\\beyJ[A-Za-z0-9_-]*\\.eyJ[A-Za-z0-9_-]*\\.[A-Za-z0-9_-]*\\b',
    replacement: '[REDACTED:JWT]',
    enabled: true,
    severity: 'high',
  },
  {
    id: 'password-field',
    name: 'Password in Config',
    pattern: '(?:password|passwd|pwd)[\\s:=]+["\']?([^"\'\\s]{4,})["\']?',
    replacement: '[REDACTED:PASSWORD]',
    enabled: true,
    severity: 'critical',
  },
  {
    id: 'ip-address',
    name: 'IP Address',
    pattern: '\\b(?:\\d{1,3}\\.){3}\\d{1,3}\\b',
    replacement: '[REDACTED:IP]',
    enabled: false, // Often needed, disabled by default
    severity: 'low',
  },
  {
    id: 'mac-address',
    name: 'MAC Address',
    pattern: '\\b(?:[0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}\\b',
    replacement: '[REDACTED:MAC]',
    enabled: false,
    severity: 'low',
  },
  {
    id: 'github-token',
    name: 'GitHub Token',
    pattern: '\\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{36,}\\b',
    replacement: '[REDACTED:GITHUB_TOKEN]',
    enabled: true,
    severity: 'critical',
  },
  {
    id: 'slack-token',
    name: 'Slack Token',
    pattern: '\\bxox[baprs]-[0-9]{10,13}-[0-9]{10,13}[a-zA-Z0-9-]*\\b',
    replacement: '[REDACTED:SLACK_TOKEN]',
    enabled: true,
    severity: 'critical',
  },
];

/**
 * OutputFilter filters sensitive data from output content.
 *
 * This pattern prevents accidental exposure of sensitive information
 * in AI-generated responses or logged content.
 *
 * @example
 * ```typescript
 * const filter = new OutputFilter();
 *
 * const output = 'User email is john@example.com and card is 4111-1111-1111-1111';
 * const filtered = filter.filter(output);
 *
 * console.log(filtered.content);
 * // Output: 'User email is [REDACTED:EMAIL] and card is [REDACTED:CREDIT_CARD]'
 * ```
 */
export class OutputFilter {
  private patterns: SensitiveDataPattern[];
  private customPatterns: SensitiveDataPattern[] = [];
  private compiledPatterns: Map<string, RegExp> = new Map();

  /**
   * Creates a new OutputFilter instance
   *
   * @param customPatterns - Additional patterns to include
   * @param useDefaults - Whether to include default patterns
   */
  constructor(customPatterns: SensitiveDataPattern[] = [], useDefaults = true) {
    this.patterns = useDefaults ? [...DEFAULT_SENSITIVE_PATTERNS] : [];
    this.customPatterns = customPatterns;
    this.compilePatterns();
  }

  /**
   * Filters sensitive data from content
   *
   * @param content - The content to filter
   * @param options - Filtering options
   * @returns Filtered output with redaction details
   */
  filter(content: string, options: FilterOptions = {}): FilteredOutput {
    const startTime = Date.now();
    const redactions: Redaction[] = [];
    let filteredContent = content;
    let patternsChecked = 0;

    const allPatterns = this.getAllPatterns();
    const enabledPatterns = options.patterns
      ? allPatterns.filter(p => options.patterns?.includes(p.id))
      : allPatterns.filter(p => p.enabled);

    // Apply severity filter
    const minSeverity = options.minSeverity ?? 'low';
    const filteredPatterns = enabledPatterns.filter(
      p => this.severityRank(p.severity) >= this.severityRank(minSeverity),
    );

    for (const pattern of filteredPatterns) {
      patternsChecked++;
      const regex = this.getCompiledPattern(pattern);

      if (!regex) {
        continue;
      }

      let match: RegExpExecArray | null;
      const originalContent = filteredContent;

      // Reset regex state for global matching
      regex.lastIndex = 0;

      while ((match = regex.exec(originalContent)) !== null) {
        redactions.push({
          type: pattern.id,
          position: match.index,
          originalLength: match[0].length,
          replacement: pattern.replacement,
          severity: pattern.severity,
        });
      }

      // Replace all occurrences
      filteredContent = filteredContent.replace(regex, pattern.replacement);
    }

    // Sort redactions by position
    redactions.sort((a, b) => a.position - b.position);

    const processingTimeMs = Date.now() - startTime;
    const charactersRemoved =
      content.length -
      filteredContent.length +
      redactions.reduce((sum, r) => sum + r.replacement.length, 0);

    return {
      content: filteredContent,
      original: content,
      filtered: redactions.length > 0,
      redactions,
      stats: {
        patternsChecked,
        redactionsMade: redactions.length,
        charactersRemoved: Math.max(0, charactersRemoved),
        processingTimeMs,
      },
    };
  }

  /**
   * Checks if content contains sensitive data without filtering
   *
   * @param content - The content to check
   * @returns Detection result
   */
  detect(content: string): DetectionResult {
    const findings: DetectedSensitiveData[] = [];

    for (const pattern of this.getAllPatterns().filter(p => p.enabled)) {
      const regex = this.getCompiledPattern(pattern);
      if (!regex) {
        continue;
      }

      let match: RegExpExecArray | null;
      regex.lastIndex = 0;

      while ((match = regex.exec(content)) !== null) {
        findings.push({
          type: pattern.id,
          name: pattern.name,
          position: match.index,
          length: match[0].length,
          severity: pattern.severity,
          preview: this.createPreview(content, match.index, match[0].length),
        });
      }
    }

    return {
      hasSensitiveData: findings.length > 0,
      findings,
      summary: this.createDetectionSummary(findings),
    };
  }

  /**
   * Adds a custom pattern
   *
   * @param pattern - The pattern to add
   */
  addPattern(pattern: SensitiveDataPattern): void {
    this.customPatterns.push(pattern);
    this.compilePattern(pattern);
  }

  /**
   * Removes a pattern by ID
   *
   * @param patternId - The ID of the pattern to remove
   * @returns True if the pattern was removed
   */
  removePattern(patternId: string): boolean {
    const index = this.customPatterns.findIndex(p => p.id === patternId);
    if (index !== -1) {
      this.customPatterns.splice(index, 1);
      this.compiledPatterns.delete(patternId);
      return true;
    }
    return false;
  }

  /**
   * Enables or disables a pattern
   *
   * @param patternId - The ID of the pattern
   * @param enabled - Whether to enable the pattern
   * @returns True if the pattern was found
   */
  setPatternEnabled(patternId: string, enabled: boolean): boolean {
    const pattern = this.getAllPatterns().find(p => p.id === patternId);
    if (pattern) {
      pattern.enabled = enabled;
      return true;
    }
    return false;
  }

  /**
   * Gets all configured patterns
   *
   * @returns Array of patterns
   */
  getPatterns(): SensitiveDataPattern[] {
    return this.getAllPatterns();
  }

  /**
   * Gets enabled patterns only
   *
   * @returns Array of enabled patterns
   */
  getEnabledPatterns(): SensitiveDataPattern[] {
    return this.getAllPatterns().filter(p => p.enabled);
  }

  /**
   * Creates a filtered output stream handler
   *
   * @param onChunk - Callback for filtered chunks
   * @returns Stream handler function
   */
  createStreamFilter(
    onChunk: (filtered: string, hadRedactions: boolean) => void,
  ): (chunk: string) => void {
    let buffer = '';
    const maxBufferSize = 1000;

    return (chunk: string) => {
      buffer += chunk;

      // Only process when buffer is large enough to catch patterns
      if (buffer.length >= maxBufferSize) {
        const toProcess = buffer.slice(0, -100); // Keep some overlap
        buffer = buffer.slice(-100);

        const filtered = this.filter(toProcess);
        onChunk(filtered.content, filtered.filtered);
      }
    };
  }

  /**
   * Flushes the stream filter buffer
   *
   * @param flush - Callback to flush remaining content
   * @returns Function to get final filtered content
   */
  createStreamFlush(
    onFlush: (filtered: string, hadRedactions: boolean) => void,
  ): (remainingBuffer: string) => void {
    return (remainingBuffer: string) => {
      if (remainingBuffer.length > 0) {
        const filtered = this.filter(remainingBuffer);
        onFlush(filtered.content, filtered.filtered);
      }
    };
  }

  private getAllPatterns(): SensitiveDataPattern[] {
    return [...this.patterns, ...this.customPatterns];
  }

  private compilePatterns(): void {
    for (const pattern of this.getAllPatterns()) {
      this.compilePattern(pattern);
    }
  }

  private compilePattern(pattern: SensitiveDataPattern): void {
    try {
      const regex = new RegExp(pattern.pattern, 'gi');
      this.compiledPatterns.set(pattern.id, regex);
    } catch (error) {
      console.warn(`Failed to compile pattern "${pattern.id}": ${error}`);
    }
  }

  private getCompiledPattern(
    pattern: SensitiveDataPattern,
  ): RegExp | undefined {
    return this.compiledPatterns.get(pattern.id);
  }

  private severityRank(severity: Severity): number {
    const ranks: Record<Severity, number> = {
      low: 1,
      medium: 2,
      high: 3,
      critical: 4,
    };
    return ranks[severity];
  }

  private createPreview(
    content: string,
    position: number,
    length: number,
  ): string {
    const previewLength = 20;
    const start = Math.max(0, position - previewLength);
    const end = Math.min(content.length, position + length + previewLength);

    let preview = content.slice(start, end);

    if (start > 0) {
      preview = '...' + preview;
    }
    if (end < content.length) {
      preview = preview + '...';
    }

    return preview;
  }

  private createDetectionSummary(
    findings: DetectedSensitiveData[],
  ): DetectionSummary {
    const byType: Record<string, number> = {};
    const bySeverity: Record<Severity, number> = {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0,
    };

    for (const finding of findings) {
      byType[finding.type] = (byType[finding.type] ?? 0) + 1;
      bySeverity[finding.severity]++;
    }

    return {
      totalFindings: findings.length,
      byType,
      bySeverity,
    };
  }
}

/**
 * Options for filtering
 */
export interface FilterOptions {
  /**
   * Specific pattern IDs to apply (all enabled if not specified)
   */
  patterns?: string[];

  /**
   * Minimum severity level to filter
   */
  minSeverity?: Severity;
}

/**
 * Result of sensitive data detection
 */
export interface DetectionResult {
  /**
   * Whether sensitive data was detected
   */
  hasSensitiveData: boolean;

  /**
   * Individual findings
   */
  findings: DetectedSensitiveData[];

  /**
   * Summary of findings
   */
  summary: DetectionSummary;
}

/**
 * A detected piece of sensitive data
 */
export interface DetectedSensitiveData {
  /**
   * Pattern ID that matched
   */
  type: string;

  /**
   * Human-readable name
   */
  name: string;

  /**
   * Position in content
   */
  position: number;

  /**
   * Length of matched content
   */
  length: number;

  /**
   * Severity level
   */
  severity: Severity;

  /**
   * Preview of surrounding content
   */
  preview: string;
}

/**
 * Summary of detection results
 */
export interface DetectionSummary {
  /**
   * Total number of findings
   */
  totalFindings: number;

  /**
   * Findings grouped by type
   */
  byType: Record<string, number>;

  /**
   * Findings grouped by severity
   */
  bySeverity: Record<Severity, number>;
}

/**
 * Creates a pre-configured output filter for common use cases
 *
 * @param preset - The preset configuration
 * @returns Configured OutputFilter
 */
export function createOutputFilter(
  preset: 'strict' | 'standard' | 'minimal',
): OutputFilter {
  const filter = new OutputFilter();

  switch (preset) {
    case 'strict':
      // Enable all patterns
      for (const pattern of filter.getPatterns()) {
        filter.setPatternEnabled(pattern.id, true);
      }
      break;

    case 'minimal':
      // Only critical patterns
      for (const pattern of filter.getPatterns()) {
        filter.setPatternEnabled(pattern.id, pattern.severity === 'critical');
      }
      break;

    case 'standard':
    default:
      // Use default enabled states
      break;
  }

  return filter;
}
