/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable import/no-unresolved */
/**
 * PTY Controller for automated Claude CLI approval
 * Implements the "Yes-Claude" pattern for safe, automated Y/N prompt handling
 */

import { EventEmitter } from 'events';
import * as os from 'os';

import * as pty from 'node-pty';

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface PTYControllerConfig {
  /** Safety heuristics for automatic decision making */
  safetyHeuristics: SafetyHeuristics;
  /** Guardian callback for escalated decisions */
  guardianCallback?: (data: EscalationData) => Promise<'approve' | 'reject'>;
  /** Shell to use (defaults to platform-appropriate shell) */
  shell?: string;
  /** Environment variables to pass to the PTY */
  env?: Record<string, string>;
  /** Timeout for guardian escalation in ms (default: 300000 - 5 minutes) */
  escalationTimeout?: number;
  /** Enable verbose logging */
  verbose?: boolean;
}

export interface SafetyHeuristics {
  /** Patterns that are safe to auto-approve */
  autoApprovePatterns: ApprovalPattern[];
  /** Patterns that should always be rejected */
  alwaysRejectPatterns: ApprovalPattern[];
  /** Patterns that require human/guardian review */
  escalationPatterns: ApprovalPattern[];
}

export interface ApprovalPattern {
  /** Pattern name for logging/debugging */
  name: string;
  /** Regex pattern to match against prompt text */
  pattern: RegExp;
  /** Optional description of what this pattern matches */
  description?: string;
}

export interface SessionStatus {
  /** Unique session identifier */
  sessionId: string;
  /** Current state of the session */
  state:
    | 'idle'
    | 'running'
    | 'awaiting_decision'
    | 'escalated'
    | 'terminated'
    | 'error';
  /** Worktree path for this session */
  worktreePath: string;
  /** Number of prompts auto-approved */
  autoApprovedCount: number;
  /** Number of prompts rejected */
  rejectedCount: number;
  /** Number of prompts escalated */
  escalatedCount: number;
  /** Session start time */
  startTime: Date;
  /** Last activity timestamp */
  lastActivity: Date;
  /** Current pending prompt if any */
  pendingPrompt?: string;
  /** Error message if in error state */
  errorMessage?: string;
}

export interface EscalationData {
  /** The prompt text that triggered escalation */
  prompt: string;
  /** Which pattern triggered the escalation */
  matchedPattern: string;
  /** Session context */
  sessionId: string;
  /** Worktree path */
  worktreePath: string;
  /** Timestamp */
  timestamp: Date;
  /** Recent output buffer for context */
  recentOutput: string;
}

export interface PTYControllerEvents {
  output: (data: string) => void;
  approval: (
    prompt: string,
    decision: 'approve' | 'reject' | 'escalate'
  ) => void;
  escalation: (data: EscalationData) => void;
  'session-start': (sessionId: string) => void;
  'session-end': (sessionId: string, reason: string) => void;
  error: (error: Error) => void;
}

// ============================================================================
// Default Safety Heuristics
// ============================================================================

export const DEFAULT_SAFETY_HEURISTICS: SafetyHeuristics = {
  autoApprovePatterns: [
    {
      name: 'read-file',
      pattern: /read\s+(file|content|from)/i,
      description: 'Reading file contents',
    },
    {
      name: 'view-file',
      pattern: /view\s+(file|content)/i,
      description: 'Viewing file contents',
    },
    {
      name: 'list-files',
      pattern: /(list|ls|show)\s+(files|directory|folder)/i,
      description: 'Listing directory contents',
    },
    {
      name: 'run-tests',
      pattern: /run\s+(tests?|test\s+suite|npm\s+test|jest|vitest|mocha)/i,
      description: 'Running test suites',
    },
    {
      name: 'type-check',
      pattern: /(type\s*check|tsc|typescript\s+check)/i,
      description: 'Type checking',
    },
    {
      name: 'lint',
      pattern: /(lint|eslint|prettier\s+check)/i,
      description: 'Linting operations',
    },
    {
      name: 'build-check',
      pattern: /(build|compile)\s+(check|verify)/i,
      description: 'Build verification',
    },
    {
      name: 'git-status',
      pattern: /git\s+(status|log|diff|branch|show)/i,
      description: 'Git read operations',
    },
    {
      name: 'search-code',
      pattern: /(search|grep|find)\s+(code|pattern|text)/i,
      description: 'Code search operations',
    },
    {
      name: 'analyze',
      pattern: /(analyze|inspect|review)\s+(code|file|project)/i,
      description: 'Code analysis',
    },
    {
      name: 'create-file',
      pattern: /create\s+(file|new\s+file)/i,
      description: 'Creating new files',
    },
    {
      name: 'edit-file',
      pattern: /edit\s+(file|code)/i,
      description: 'Editing existing files',
    },
    {
      name: 'write-file',
      pattern: /write\s+(to\s+)?file/i,
      description: 'Writing to files',
    },
    {
      name: 'install-deps',
      pattern: /(npm|yarn|pnpm)\s+(install|add)\s+[^-]/i,
      description: 'Installing dependencies (without flags)',
    },
    {
      name: 'format-code',
      pattern: /(format|prettier)\s+(code|file)/i,
      description: 'Code formatting',
    },
  ],

  alwaysRejectPatterns: [
    {
      name: 'rm-rf',
      pattern: /rm\s+(-rf|-fr|--recursive\s+--force)/i,
      description: 'Recursive force delete',
    },
    {
      name: 'force-push',
      pattern: /git\s+push\s+(-f|--force)/i,
      description: 'Force push to remote',
    },
    {
      name: 'delete-branch-main',
      pattern: /git\s+(branch\s+-[dD]|push\s+.*:)\s*(main|master|develop)/i,
      description: 'Deleting main branches',
    },
    {
      name: 'drop-database',
      pattern: /(drop|delete)\s+(database|table|collection)/i,
      description: 'Database destructive operations',
    },
    {
      name: 'truncate-table',
      pattern: /truncate\s+table/i,
      description: 'Table truncation',
    },
    {
      name: 'chmod-777',
      pattern: /chmod\s+777/i,
      description: 'Insecure permissions',
    },
    {
      name: 'curl-pipe-bash',
      pattern: /curl.*\|\s*(ba)?sh/i,
      description: 'Remote script execution',
    },
    {
      name: 'eval-dangerous',
      pattern: /eval\s*\(/i,
      description: 'Eval execution',
    },
    {
      name: 'sudo-rm',
      pattern: /sudo\s+rm/i,
      description: 'Sudo remove operations',
    },
    {
      name: 'format-disk',
      pattern: /(mkfs|format)\s+\/dev/i,
      description: 'Disk formatting',
    },
    {
      name: 'kill-all',
      pattern: /killall|pkill\s+-9/i,
      description: 'Mass process termination',
    },
    {
      name: 'disable-security',
      pattern: /disable\s+(security|firewall|antivirus)/i,
      description: 'Disabling security features',
    },
  ],

  escalationPatterns: [
    {
      name: 'deploy',
      pattern: /(deploy|publish|release)\s+(to\s+)?(prod|production|live)/i,
      description: 'Production deployments',
    },
    {
      name: 'secrets',
      pattern: /(secret|api.?key|password|token|credential)/i,
      description: 'Operations involving secrets',
    },
    {
      name: 'env-file',
      pattern: /\.env(\.(prod|production|local))?/i,
      description: 'Environment file operations',
    },
    {
      name: 'database-migration',
      pattern: /(migrate|migration)\s+(database|db|schema)/i,
      description: 'Database migrations',
    },
    {
      name: 'git-push',
      pattern: /git\s+push\s+(origin\s+)?(main|master)/i,
      description: 'Pushing to main branches',
    },
    {
      name: 'npm-publish',
      pattern: /npm\s+publish/i,
      description: 'Publishing packages',
    },
    {
      name: 'docker-push',
      pattern: /docker\s+push/i,
      description: 'Pushing Docker images',
    },
    {
      name: 'terraform-apply',
      pattern: /terraform\s+apply/i,
      description: 'Infrastructure changes',
    },
    {
      name: 'kubectl-apply',
      pattern: /kubectl\s+(apply|delete)/i,
      description: 'Kubernetes changes',
    },
    {
      name: 'aws-cli',
      pattern: /aws\s+(s3|ec2|lambda|iam)/i,
      description: 'AWS CLI operations',
    },
    {
      name: 'billing',
      pattern: /(billing|payment|charge|subscription)/i,
      description: 'Billing-related operations',
    },
    {
      name: 'user-data',
      pattern: /(user\s+data|pii|personal\s+information)/i,
      description: 'Personal data operations',
    },
  ],
};

// ============================================================================
// PTY Controller Class
// ============================================================================

export class PTYController extends EventEmitter {
  private config: PTYControllerConfig;
  private ptyProcess: pty.IPty | null = null;
  private sessionId: string = '';
  private worktreePath: string = '';
  private status: SessionStatus | null = null;
  private outputBuffer: string = '';
  private recentOutputBuffer: string = '';
  private readonly MAX_RECENT_OUTPUT = 5000;
  private pendingEscalation: {
    resolve: (decision: 'approve' | 'reject') => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  } | null = null;

  constructor(config: PTYControllerConfig) {
    super();
    this.config = {
      escalationTimeout: 300000, // 5 minutes default
      verbose: false,
      ...config,
    };
  }

  // ============================================================================
  // Public Methods
  // ============================================================================

  /**
   * Spawns a new Claude CLI session in a PTY
   * @param worktreePath - Path to the worktree/project directory
   * @returns Session ID
   */
  async spawnSession(worktreePath: string): Promise<string> {
    if (this.ptyProcess) {
      throw new Error('Session already active. Kill existing session first.');
    }

    this.sessionId = this.generateSessionId();
    this.worktreePath = worktreePath;
    this.outputBuffer = '';
    this.recentOutputBuffer = '';

    // Initialize status
    this.status = {
      sessionId: this.sessionId,
      state: 'idle',
      worktreePath,
      autoApprovedCount: 0,
      rejectedCount: 0,
      escalatedCount: 0,
      startTime: new Date(),
      lastActivity: new Date(),
    };

    // Determine shell based on platform
    const shell = this.config.shell || this.getDefaultShell();
    const shellArgs = this.getShellArgs(shell);

    // Prepare environment
    const env = {
      ...process.env,
      ...this.config.env,
      TERM: 'xterm-256color',
      COLORTERM: 'truecolor',
    };

    try {
      // Spawn PTY process
      this.ptyProcess = pty.spawn(shell, shellArgs, {
        name: 'xterm-256color',
        cols: 120,
        rows: 40,
        cwd: worktreePath,
        env: env as Record<string, string>,
      });

      // Set up output handler
      this.ptyProcess.onData((data: string) => {
        this.handleOutput(data);
      });

      // Handle exit
      this.ptyProcess.onExit(({ exitCode, signal }) => {
        this.log(`PTY exited with code ${exitCode}, signal ${signal}`);
        this.handleSessionEnd(`exit_code_${exitCode}`);
      });

      this.status.state = 'running';
      this.emit('session-start', this.sessionId);
      this.log(`Session started: ${this.sessionId}`);

      // Start Claude CLI in the PTY
      await this.startClaudeCLI();

      return this.sessionId;
    } catch (error) {
      this.status.state = 'error';
      this.status.errorMessage =
        error instanceof Error ? error.message : String(error);
      throw error;
    }
  }

  /**
   * Terminates the PTY session
   */
  async killSession(): Promise<void> {
    if (!this.ptyProcess) {
      this.log('No active session to kill');
      return;
    }

    // Cancel any pending escalation
    if (this.pendingEscalation) {
      clearTimeout(this.pendingEscalation.timeout);
      this.pendingEscalation.reject(new Error('Session terminated'));
      this.pendingEscalation = null;
    }

    try {
      // Send SIGTERM first
      this.ptyProcess.kill();

      // Give it a moment to clean up
      await new Promise(resolve => setTimeout(resolve, 500));

      // Force kill if still running
      if (this.ptyProcess) {
        this.ptyProcess.kill('SIGKILL');
      }
    } catch (error) {
      this.log(`Error killing session: ${error}`);
    }

    this.handleSessionEnd('manual_kill');
  }

  /**
   * Gets the current session status
   */
  getSessionStatus(): SessionStatus {
    if (!this.status) {
      return {
        sessionId: '',
        state: 'terminated',
        worktreePath: '',
        autoApprovedCount: 0,
        rejectedCount: 0,
        escalatedCount: 0,
        startTime: new Date(),
        lastActivity: new Date(),
      };
    }
    return { ...this.status };
  }

  /**
   * Sends input to the PTY
   */
  sendInput(data: string): void {
    if (!this.ptyProcess) {
      throw new Error('No active session');
    }
    this.ptyProcess.write(data);
  }

  /**
   * Resizes the PTY
   */
  resize(cols: number, rows: number): void {
    if (this.ptyProcess) {
      this.ptyProcess.resize(cols, rows);
    }
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Handles output from the PTY
   */
  private handleOutput(data: string): void {
    this.outputBuffer += data;
    this.updateRecentOutput(data);

    if (this.status) {
      this.status.lastActivity = new Date();
    }

    // Emit output event for streaming
    this.emit('output', data);

    // Check if this is an approval prompt
    if (this.isApprovalPrompt(data)) {
      this.handleApprovalPrompt(data);
    }
  }

  /**
   * Updates the recent output buffer (circular buffer behavior)
   */
  private updateRecentOutput(data: string): void {
    this.recentOutputBuffer += data;
    if (this.recentOutputBuffer.length > this.MAX_RECENT_OUTPUT) {
      this.recentOutputBuffer = this.recentOutputBuffer.slice(
        -this.MAX_RECENT_OUTPUT
      );
    }
  }

  /**
   * Detects if the output contains a Y/N approval prompt
   */
  private isApprovalPrompt(data: string): boolean {
    // Common Claude CLI approval prompt patterns
    const approvalPatterns = [
      /\[Y\/n\]/i,
      /\[y\/N\]/i,
      /\(Y\/n\)/i,
      /\(y\/N\)/i,
      /\[Yes\/No\]/i,
      /\(Yes\/No\)/i,
      /Press Y to continue/i,
      /Approve\?/i,
      /Do you want to proceed\?/i,
      /Continue\?.*\[Y\/n\]/i,
      /Allow this action\?/i,
      /Confirm\?/i,
    ];

    return approvalPatterns.some(pattern => pattern.test(data));
  }

  /**
   * Handles an approval prompt by making a decision
   */
  private async handleApprovalPrompt(data: string): Promise<void> {
    if (!this.status || !this.ptyProcess) {
      return;
    }

    this.status.state = 'awaiting_decision';
    this.status.pendingPrompt = data;

    const decision = this.makeDecision(data);

    this.emit('approval', data, decision);
    this.log(`Approval prompt detected. Decision: ${decision}`);

    switch (decision) {
      case 'approve':
        this.status.autoApprovedCount++;
        this.sendApproval();
        this.status.state = 'running';
        break;

      case 'reject':
        this.status.rejectedCount++;
        this.sendRejection();
        this.status.state = 'running';
        break;

      case 'escalate':
        this.status.escalatedCount++;
        await this.escalateToGuardian(data);
        break;
    }

    this.status.pendingPrompt = undefined;
  }

  /**
   * Makes a decision based on safety heuristics
   */
  private makeDecision(prompt: string): 'approve' | 'reject' | 'escalate' {
    const { safetyHeuristics } = this.config;
    const promptLower = prompt.toLowerCase();
    const contextToCheck = this.recentOutputBuffer + '\n' + prompt;

    // Check rejection patterns first (highest priority)
    for (const pattern of safetyHeuristics.alwaysRejectPatterns) {
      if (pattern.pattern.test(contextToCheck)) {
        this.log(`Matched rejection pattern: ${pattern.name}`);
        return 'reject';
      }
    }

    // Check escalation patterns (medium priority)
    for (const pattern of safetyHeuristics.escalationPatterns) {
      if (pattern.pattern.test(contextToCheck)) {
        this.log(`Matched escalation pattern: ${pattern.name}`);
        return 'escalate';
      }
    }

    // Check approval patterns (lower priority)
    for (const pattern of safetyHeuristics.autoApprovePatterns) {
      if (pattern.pattern.test(contextToCheck)) {
        this.log(`Matched approval pattern: ${pattern.name}`);
        return 'approve';
      }
    }

    // Default: escalate if no pattern matches (fail-safe)
    this.log('No pattern matched, escalating by default');
    return 'escalate';
  }

  /**
   * Escalates a decision to the guardian
   */
  private async escalateToGuardian(data: string): Promise<void> {
    if (!this.status) {
      return;
    }

    this.status.state = 'escalated';

    const escalationData: EscalationData = {
      prompt: data,
      matchedPattern: this.findMatchedPattern(data),
      sessionId: this.sessionId,
      worktreePath: this.worktreePath,
      timestamp: new Date(),
      recentOutput: this.recentOutputBuffer,
    };

    this.emit('escalation', escalationData);

    if (this.config.guardianCallback) {
      try {
        const decision = await this.waitForGuardianDecision(escalationData);

        if (decision === 'approve') {
          this.sendApproval();
        } else {
          this.sendRejection();
        }
      } catch (error) {
        this.log(`Guardian decision error: ${error}`);
        // Default to rejection on error
        this.sendRejection();
      }
    } else {
      // No guardian callback, default to rejection
      this.log('No guardian callback configured, defaulting to rejection');
      this.sendRejection();
    }

    if (this.status) {
      this.status.state = 'running';
    }
  }

  /**
   * Waits for a guardian decision with timeout
   */
  private async waitForGuardianDecision(
    data: EscalationData
  ): Promise<'approve' | 'reject'> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingEscalation = null;
        this.log('Guardian decision timed out, defaulting to reject');
        resolve('reject');
      }, this.config.escalationTimeout);

      this.pendingEscalation = { resolve, reject, timeout };

      // Call the guardian callback
      this.config.guardianCallback!(data)
        .then(decision => {
          if (this.pendingEscalation) {
            clearTimeout(this.pendingEscalation.timeout);
            this.pendingEscalation = null;
          }
          resolve(decision);
        })
        .catch(error => {
          if (this.pendingEscalation) {
            clearTimeout(this.pendingEscalation.timeout);
            this.pendingEscalation = null;
          }
          reject(error);
        });
    });
  }

  /**
   * Finds which pattern matched the prompt
   */
  private findMatchedPattern(prompt: string): string {
    const contextToCheck = this.recentOutputBuffer + '\n' + prompt;
    const { safetyHeuristics } = this.config;

    for (const pattern of safetyHeuristics.alwaysRejectPatterns) {
      if (pattern.pattern.test(contextToCheck)) {
        return pattern.name;
      }
    }
    for (const pattern of safetyHeuristics.escalationPatterns) {
      if (pattern.pattern.test(contextToCheck)) {
        return pattern.name;
      }
    }
    for (const pattern of safetyHeuristics.autoApprovePatterns) {
      if (pattern.pattern.test(contextToCheck)) {
        return pattern.name;
      }
    }

    return 'unknown';
  }

  /**
   * Sends an approval response (Y)
   */
  private sendApproval(): void {
    if (this.ptyProcess) {
      this.ptyProcess.write('Y\n');
      this.log('Sent approval: Y');
    }
  }

  /**
   * Sends a rejection response (n)
   */
  private sendRejection(): void {
    if (this.ptyProcess) {
      this.ptyProcess.write('n\n');
      this.log('Sent rejection: n');
    }
  }

  /**
   * Starts the Claude CLI in the PTY
   */
  private async startClaudeCLI(): Promise<void> {
    // Allow shell to initialize
    await new Promise(resolve => setTimeout(resolve, 100));

    // Start Claude CLI
    if (this.ptyProcess) {
      this.ptyProcess.write('claude\n');
    }
  }

  /**
   * Handles session end
   */
  private handleSessionEnd(reason: string): void {
    if (this.status) {
      this.status.state = 'terminated';
    }

    this.emit('session-end', this.sessionId, reason);
    this.log(`Session ended: ${reason}`);

    this.ptyProcess = null;
  }

  /**
   * Gets the default shell based on platform
   */
  private getDefaultShell(): string {
    const platform = os.platform();

    switch (platform) {
      case 'darwin':
        return process.env.SHELL || '/bin/zsh';
      case 'linux':
        return process.env.SHELL || '/bin/bash';
      case 'win32':
        return process.env.COMSPEC || 'cmd.exe';
      default:
        return '/bin/sh';
    }
  }

  /**
   * Gets shell arguments based on shell type
   */
  private getShellArgs(shell: string): string[] {
    if (shell.includes('cmd.exe')) {
      return [];
    }
    if (shell.includes('powershell') || shell.includes('pwsh')) {
      return ['-NoLogo'];
    }
    // Unix shells - use login shell for proper environment
    return ['-l'];
  }

  /**
   * Generates a unique session ID
   */
  private generateSessionId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `pty-${timestamp}-${random}`;
  }

  /**
   * Logs a message if verbose mode is enabled
   */
  private log(message: string): void {
    if (this.config.verbose) {
      console.log(`[PTYController] ${message}`);
    }
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Creates a PTYController with default safety heuristics
 */
export function createPTYController(
  config?: Partial<PTYControllerConfig>
): PTYController {
  return new PTYController({
    safetyHeuristics: DEFAULT_SAFETY_HEURISTICS,
    ...config,
  });
}

/**
 * Merges custom patterns with default safety heuristics
 */
export function mergeHeuristics(
  custom: Partial<SafetyHeuristics>
): SafetyHeuristics {
  return {
    autoApprovePatterns: [
      ...DEFAULT_SAFETY_HEURISTICS.autoApprovePatterns,
      ...(custom.autoApprovePatterns || []),
    ],
    alwaysRejectPatterns: [
      ...DEFAULT_SAFETY_HEURISTICS.alwaysRejectPatterns,
      ...(custom.alwaysRejectPatterns || []),
    ],
    escalationPatterns: [
      ...DEFAULT_SAFETY_HEURISTICS.escalationPatterns,
      ...(custom.escalationPatterns || []),
    ],
  };
}

// ============================================================================
// Exports
// ============================================================================

export default PTYController;
