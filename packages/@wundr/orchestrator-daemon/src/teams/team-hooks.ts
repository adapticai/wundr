/**
 * Team Hooks - Quality gate handlers for Agent Teams
 *
 * Implements TeammateIdle and TaskCompleted hook handlers that fire on
 * teammate lifecycle events. Hooks can be shell commands, Node scripts,
 * or in-process functions.
 *
 * Exit code semantics (matching Claude Code):
 *   0 = allow (proceed normally)
 *   1 = error (log and proceed)
 *   2 = reject with feedback (keep teammate working / reject task completion)
 *
 * The hooks module wires itself into SharedTaskList and Mailbox via
 * their callback injection APIs, keeping the modules loosely coupled.
 */

import { spawn } from 'child_process';

import { EventEmitter } from 'eventemitter3';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type HookType = 'TeammateIdle' | 'TaskCompleted';

/**
 * Exit code semantics:
 *   0 = allow
 *   1 = error (log, proceed)
 *   2 = reject with feedback
 */
export type HookExitCode = 0 | 1 | 2;

/**
 * Execution mode for the hook.
 * - 'command': Shell command executed via child_process.spawn
 * - 'function': In-process TypeScript/JavaScript function
 */
export type HookExecutionMode = 'command' | 'function';

export interface HookConfig {
  readonly type: HookType;
  readonly mode: HookExecutionMode;
  /** Shell command to execute (when mode is 'command'). */
  readonly command?: string;
  /** In-process function to execute (when mode is 'function'). */
  readonly handler?: HookHandlerFn;
  /** Timeout in ms before the hook is killed. Default: 30000 */
  readonly timeout: number;
  readonly enabled: boolean;
}

export interface HookResult {
  readonly exitCode: HookExitCode;
  readonly stdout: string;
  readonly stderr: string;
  readonly duration: number;
  readonly timedOut: boolean;
}

export interface TeammateIdleHookContext {
  readonly teamId: string;
  readonly memberId: string;
  readonly memberName: string;
  readonly completedTaskIds: string[];
  readonly remainingTasks: number;
  readonly idleSince: Date;
}

export interface TaskCompletedHookContext {
  readonly teamId: string;
  readonly taskId: string;
  readonly taskTitle: string;
  readonly completedBy: string;
  readonly memberName: string;
  readonly duration: number;
  readonly dependentTaskIds: string[];
}

/**
 * In-process hook handler function signature.
 * Should return exit code and optional feedback message.
 */
export type HookHandlerFn = (
  context: TeammateIdleHookContext | TaskCompletedHookContext,
) => Promise<{ exitCode: HookExitCode; feedback?: string }>;

export interface TeamHooksEvents {
  'hook:registered': (teamId: string, config: HookConfig) => void;
  'hook:executed': (teamId: string, type: HookType, result: HookResult) => void;
  'hook:error': (teamId: string, type: HookType, error: Error) => void;
  'hook:removed': (teamId: string, type: HookType) => void;
}

// ---------------------------------------------------------------------------
// Team Hooks Manager
// ---------------------------------------------------------------------------

export class TeamHooks extends EventEmitter<TeamHooksEvents> {
  /**
   * Registered hooks per team, keyed by teamId -> HookType -> HookConfig.
   */
  private readonly hooks: Map<string, Map<HookType, HookConfig>> = new Map();

  // -------------------------------------------------------------------------
  // Registration
  // -------------------------------------------------------------------------

  /**
   * Register a hook for a team.
   * Only one hook per type per team is allowed; re-registering replaces the previous.
   */
  registerHook(teamId: string, config: HookConfig): void {
    let teamHooks = this.hooks.get(teamId);
    if (!teamHooks) {
      teamHooks = new Map();
      this.hooks.set(teamId, teamHooks);
    }

    teamHooks.set(config.type, config);
    this.emit('hook:registered', teamId, config);
  }

  /**
   * Remove a hook registration.
   */
  removeHook(teamId: string, hookType: HookType): boolean {
    const teamHooks = this.hooks.get(teamId);
    if (!teamHooks) {
return false;
}

    const removed = teamHooks.delete(hookType);
    if (removed) {
      this.emit('hook:removed', teamId, hookType);
    }

    if (teamHooks.size === 0) {
      this.hooks.delete(teamId);
    }

    return removed;
  }

  /**
   * Get all registered hooks for a team.
   */
  getRegisteredHooks(teamId: string): HookConfig[] {
    const teamHooks = this.hooks.get(teamId);
    if (!teamHooks) {
return [];
}
    return Array.from(teamHooks.values());
  }

  /**
   * Check if a specific hook type is registered and enabled for a team.
   */
  hasHook(teamId: string, hookType: HookType): boolean {
    const teamHooks = this.hooks.get(teamId);
    if (!teamHooks) {
return false;
}
    const config = teamHooks.get(hookType);
    return config !== undefined && config.enabled;
  }

  /**
   * Remove all hooks for a team (used during team cleanup).
   */
  clearHooks(teamId: string): void {
    this.hooks.delete(teamId);
  }

  // -------------------------------------------------------------------------
  // Execution
  // -------------------------------------------------------------------------

  /**
   * Execute the TeammateIdle hook for a team.
   *
   * @returns { keepWorking: true, feedback } if hook exit code is 2,
   *          { keepWorking: false } otherwise.
   */
  async executeTeammateIdleHook(
    context: TeammateIdleHookContext,
  ): Promise<{ keepWorking: boolean; feedback?: string }> {
    const config = this.getHookConfig(context.teamId, 'TeammateIdle');
    if (!config) {
      return { keepWorking: false };
    }

    const envVars = this.buildTeammateIdleEnv(context);
    const result = await this.executeHook(context.teamId, config, envVars, context);

    this.emit('hook:executed', context.teamId, 'TeammateIdle', result);

    if (result.exitCode === 2) {
      const feedback = result.stdout.trim() || 'Continue working on remaining tasks.';
      return { keepWorking: true, feedback };
    }

    if (result.exitCode === 1 || result.timedOut) {
      // Log error but allow idle
      return { keepWorking: false };
    }

    return { keepWorking: false };
  }

  /**
   * Execute the TaskCompleted hook for a team.
   *
   * @returns { allowed: true } if hook allows completion,
   *          { allowed: false, feedback } if hook rejects (exit code 2).
   */
  async executeTaskCompletedHook(
    context: TaskCompletedHookContext,
  ): Promise<{ allowed: boolean; feedback?: string }> {
    const config = this.getHookConfig(context.teamId, 'TaskCompleted');
    if (!config) {
      return { allowed: true };
    }

    const envVars = this.buildTaskCompletedEnv(context);
    const result = await this.executeHook(context.teamId, config, envVars, context);

    this.emit('hook:executed', context.teamId, 'TaskCompleted', result);

    if (result.exitCode === 2) {
      const feedback = result.stdout.trim() || 'Task completion rejected. Please review and retry.';
      return { allowed: false, feedback };
    }

    if (result.exitCode === 1 || result.timedOut) {
      // Log error but allow completion
      return { allowed: true };
    }

    return { allowed: true };
  }

  // -------------------------------------------------------------------------
  // Callback Factories
  // -------------------------------------------------------------------------

  /**
   * Create a TaskCompletedHookFn callback suitable for injection into SharedTaskList.
   * This bridges the TeamHooks system with the SharedTaskList's hook callback API.
   */
  createTaskCompletedCallback(memberNameLookup: (memberId: string) => string) {
    return async (hookContext: {
      teamId: string;
      taskId: string;
      taskTitle: string;
      completedBy: string;
      duration: number;
      dependentTaskIds: string[];
    }) => {
      const context: TaskCompletedHookContext = {
        ...hookContext,
        memberName: memberNameLookup(hookContext.completedBy),
      };
      return this.executeTaskCompletedHook(context);
    };
  }

  /**
   * Create a TeammateIdleHookFn callback suitable for injection into Mailbox.
   * This bridges the TeamHooks system with the Mailbox's idle hook callback API.
   */
  createTeammateIdleCallback() {
    return async (hookContext: TeammateIdleHookContext) => {
      return this.executeTeammateIdleHook(hookContext);
    };
  }

  // -------------------------------------------------------------------------
  // Internal
  // -------------------------------------------------------------------------

  private getHookConfig(teamId: string, hookType: HookType): HookConfig | null {
    const teamHooks = this.hooks.get(teamId);
    if (!teamHooks) {
return null;
}

    const config = teamHooks.get(hookType);
    if (!config || !config.enabled) {
return null;
}

    return config;
  }

  /**
   * Execute a hook based on its execution mode.
   */
  private async executeHook(
    teamId: string,
    config: HookConfig,
    envVars: Record<string, string>,
    context: TeammateIdleHookContext | TaskCompletedHookContext,
  ): Promise<HookResult> {
    try {
      if (config.mode === 'function' && config.handler) {
        return await this.executeInProcessHook(config, context);
      }

      if (config.mode === 'command' && config.command) {
        return await this.executeCommandHook(config, envVars);
      }

      // Misconfigured hook
      return {
        exitCode: 1,
        stdout: '',
        stderr: 'Hook misconfigured: no command or handler provided',
        duration: 0,
        timedOut: false,
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.emit('hook:error', teamId, config.type, err);

      return {
        exitCode: 1,
        stdout: '',
        stderr: err.message,
        duration: 0,
        timedOut: false,
      };
    }
  }

  /**
   * Execute an in-process function hook.
   */
  private async executeInProcessHook(
    config: HookConfig,
    context: TeammateIdleHookContext | TaskCompletedHookContext,
  ): Promise<HookResult> {
    const startTime = Date.now();

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Hook timed out')), config.timeout);
    });

    try {
      const result = await Promise.race([
        config.handler!(context),
        timeoutPromise,
      ]);

      return {
        exitCode: result.exitCode,
        stdout: result.feedback ?? '',
        stderr: '',
        duration: Date.now() - startTime,
        timedOut: false,
      };
    } catch (error) {
      const isTimeout = error instanceof Error && error.message === 'Hook timed out';
      return {
        exitCode: 1,
        stdout: '',
        stderr: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime,
        timedOut: isTimeout,
      };
    }
  }

  /**
   * Execute a shell command hook via child_process.spawn.
   * Environment variables are passed to provide hook context.
   */
  private executeCommandHook(
    config: HookConfig,
    envVars: Record<string, string>,
  ): Promise<HookResult> {
    return new Promise<HookResult>(resolve => {
      const startTime = Date.now();
      let stdout = '';
      let stderr = '';
      let timedOut = false;
      let settled = false;

      const command = config.command!;
      const parts = command.split(/\s+/);
      const cmd = parts[0] ?? '';
      const args = parts.slice(1);

      const child = spawn(cmd, args, {
        env: { ...process.env, ...envVars },
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: config.timeout,
      });

      const timeoutHandle = setTimeout(() => {
        timedOut = true;
        child.kill('SIGTERM');
      }, config.timeout);

      child.stdout?.on('data', (data: Buffer) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      const finish = (exitCode: number) => {
        if (settled) {
return;
}
        settled = true;
        clearTimeout(timeoutHandle);

        const validExitCode: HookExitCode =
          exitCode === 0 ? 0 : exitCode === 2 ? 2 : 1;

        resolve({
          exitCode: validExitCode,
          stdout,
          stderr,
          duration: Date.now() - startTime,
          timedOut,
        });
      };

      child.on('close', (code: number | null) => {
        finish(code ?? 1);
      });

      child.on('error', (error: Error) => {
        stderr += error.message;
        finish(1);
      });
    });
  }

  // -------------------------------------------------------------------------
  // Environment Variable Builders
  // -------------------------------------------------------------------------

  private buildTeammateIdleEnv(context: TeammateIdleHookContext): Record<string, string> {
    return {
      WUNDR_HOOK_TYPE: 'TeammateIdle',
      WUNDR_TEAM_ID: context.teamId,
      WUNDR_MEMBER_ID: context.memberId,
      WUNDR_MEMBER_NAME: context.memberName,
      WUNDR_COMPLETED_TASKS: context.completedTaskIds.join(','),
      WUNDR_REMAINING_TASKS: String(context.remainingTasks),
      WUNDR_IDLE_SINCE: context.idleSince.toISOString(),
    };
  }

  private buildTaskCompletedEnv(context: TaskCompletedHookContext): Record<string, string> {
    return {
      WUNDR_HOOK_TYPE: 'TaskCompleted',
      WUNDR_TEAM_ID: context.teamId,
      WUNDR_TASK_ID: context.taskId,
      WUNDR_TASK_TITLE: context.taskTitle,
      WUNDR_COMPLETED_BY: context.completedBy,
      WUNDR_MEMBER_NAME: context.memberName,
      WUNDR_TASK_DURATION: String(context.duration),
      WUNDR_DEPENDENT_TASKS: context.dependentTaskIds.join(','),
    };
  }
}
