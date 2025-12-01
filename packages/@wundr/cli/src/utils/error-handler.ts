import chalk from 'chalk';

import { logger } from './logger';

import type { WundrError } from '../types';

/**
 * Centralized error handling system
 */
class ErrorHandler {
  private errorCodes: Map<string, string> = new Map([
    ['ENOENT', 'File or directory not found'],
    ['EACCES', 'Permission denied'],
    ['EEXIST', 'File or directory already exists'],
    ['ENOTDIR', 'Not a directory'],
    ['EISDIR', 'Is a directory'],
    ['EMFILE', 'Too many open files'],
    ['ENOTFOUND', 'Command or resource not found'],
    ['WUNDR_CONFIG_INVALID', 'Invalid configuration file'],
    ['WUNDR_PLUGIN_LOAD_FAILED', 'Failed to load plugin'],
    ['WUNDR_COMMAND_FAILED', 'Command execution failed'],
    ['WUNDR_ANALYSIS_FAILED', 'Analysis operation failed'],
    ['WUNDR_NETWORK_ERROR', 'Network operation failed'],
  ]);

  /**
   * Handle various types of errors with appropriate formatting
   */
  handle(error: Error | WundrError): void {
    const wundrError = error as WundrError;

    // Log the raw error in debug mode
    logger.debug('Raw error:', error);

    if (this.isKnownError(wundrError)) {
      this.handleKnownError(wundrError);
    } else if (this.isSystemError(error)) {
      this.handleSystemError(error);
    } else {
      this.handleUnknownError(error);
    }
  }

  /**
   * Check if error is a known Wundr error
   */
  private isKnownError(error: WundrError): boolean {
    return !!error.code && error.code.startsWith('WUNDR_');
  }

  /**
   * Check if error is a system/Node.js error
   */
  private isSystemError(error: Error): boolean {
    return 'code' in error && typeof (error as any).code === 'string';
  }

  /**
   * Handle known Wundr errors
   */
  private handleKnownError(error: WundrError): void {
    const description =
      this.errorCodes.get(error.code || '') || 'Unknown error';

    console.error(chalk.red('✖ Wundr Error'));
    console.error(chalk.red(`  Code: ${error.code}`));
    console.error(chalk.red(`  Message: ${error.message}`));
    console.error(chalk.gray(`  Description: ${description}`));

    if (error.context) {
      console.error(chalk.gray('  Context:'));
      Object.entries(error.context).forEach(([key, value]) => {
        console.error(chalk.gray(`    ${key}: ${value}`));
      });
    }

    if (error.recoverable) {
      console.error(chalk.yellow('\n💡 This error might be recoverable. Try:'));
      this.suggestRecoveryActions(error.code || '');
    }
  }

  /**
   * Handle system errors
   */
  private handleSystemError(error: any): void {
    const description = this.errorCodes.get(error.code) || 'System error';

    console.error(chalk.red('✖ System Error'));
    console.error(chalk.red(`  Code: ${error.code}`));
    console.error(chalk.red(`  Message: ${error.message}`));
    console.error(chalk.gray(`  Description: ${description}`));

    if (error.path) {
      console.error(chalk.gray(`  Path: ${error.path}`));
    }

    if (error.syscall) {
      console.error(chalk.gray(`  System Call: ${error.syscall}`));
    }
  }

  /**
   * Handle unknown errors
   */
  private handleUnknownError(error: Error): void {
    console.error(chalk.red('✖ Unexpected Error'));
    console.error(chalk.red(`  Message: ${error.message}`));

    if (error.stack) {
      console.error(chalk.gray('  Stack Trace:'));
      error.stack.split('\n').forEach(line => {
        console.error(chalk.gray(`    ${line}`));
      });
    }

    console.error(chalk.yellow('\n💡 This appears to be an unexpected error.'));
    console.error(
      chalk.yellow('   Please report this issue with the above details.')
    );
  }

  /**
   * Suggest recovery actions based on error code
   */
  private suggestRecoveryActions(code: string): void {
    const suggestions: Record<string, string[]> = {
      WUNDR_CONFIG_INVALID: [
        '• Check your wundr.config.json syntax',
        '• Run `wundr init` to create a new configuration',
        '• Validate your configuration with `wundr config validate`',
      ],
      WUNDR_PLUGIN_LOAD_FAILED: [
        '• Check if the plugin is properly installed',
        '• Verify plugin compatibility with current Wundr version',
        '• Run `wundr plugins list` to see available plugins',
      ],
      WUNDR_COMMAND_FAILED: [
        '• Check command syntax and arguments',
        '• Verify you have necessary permissions',
        '• Run with --verbose for more details',
      ],
      ENOENT: [
        '• Verify the file or directory path',
        "• Check if you're in the correct directory",
        '• Run `wundr init` if in a new project',
      ],
      EACCES: [
        '• Check file permissions',
        '• Run with appropriate user privileges',
        '• Verify directory access rights',
      ],
    };

    const actions = suggestions[code];
    if (actions) {
      actions.forEach(action => {
        console.error(chalk.yellow(action));
      });
    }
  }

  /**
   * Create a standardized Wundr error
   */
  createError(
    code: string,
    message: string,
    context?: Record<string, any>,
    recoverable = false
  ): WundrError {
    const error = new Error(message) as WundrError;
    error.code = code;
    error.context = context;
    error.recoverable = recoverable;
    return error;
  }

  /**
   * Wrap async operations with error handling
   */
  async wrap<T>(operation: () => Promise<T>, context?: string): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (context) {
        logger.error(`Error in ${context}:`, error);
      }
      throw error;
    }
  }
}

export const errorHandler = new ErrorHandler();
