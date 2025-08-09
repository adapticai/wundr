import chalk from 'chalk';

export class Logger {
  private verbose: boolean = false;
  private quiet: boolean = false;

  setVerbose(verbose: boolean): void {
    this.verbose = verbose;
  }

  setQuiet(quiet: boolean): void {
    this.quiet = quiet;
  }

  info(message: string | unknown): void {
    if (!this.quiet) {
      console.log(message);
    }
  }

  success(message: string): void {
    if (!this.quiet) {
      console.log(chalk.green(`✅ ${  message}`));
    }
  }

  warn(message: string): void {
    if (!this.quiet) {
      console.warn(chalk.yellow(`⚠️  ${  message}`));
    }
  }

  error(message: string | unknown, error?: Error | unknown): void {
    console.error(chalk.red(`❌ ${  message}`));
    if (error && this.verbose) {
      const errorMessage = error instanceof Error ? error.stack : String(error);
      console.error(chalk.red(errorMessage));
    }
  }

  debug(message: string): void {
    if (this.verbose) {
      console.log(chalk.gray(`[DEBUG] ${  message}`));
    }
  }

  log(message: string): void {
    this.info(message);
  }
}

export const logger = new Logger();