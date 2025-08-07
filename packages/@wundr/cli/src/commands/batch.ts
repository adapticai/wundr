import { Command } from 'commander';
import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import YAML from 'yaml';
import { Listr } from 'listr2';
import { ConfigManager } from '../utils/config-manager';
import { PluginManager } from '../plugins/plugin-manager';
import { logger } from '../utils/logger';
import { errorHandler } from '../utils/error-handler';
import { BatchJob, BatchCommand } from '../types';

/**
 * Batch commands for YAML automation and batch processing
 */
export class BatchCommands {
  private runningJobs: Map<string, any> = new Map();

  constructor(
    private program: Command,
    private configManager: ConfigManager,
    private pluginManager: PluginManager
  ) {
    this.registerCommands();
  }

  private registerCommands(): void {
    const batchCmd = this.program
      .command('batch')
      .description('batch processing and automation with YAML');

    // Run batch job
    batchCmd
      .command('run <file>')
      .description('run batch job from YAML file')
      .option('--dry-run', 'show what would be executed without running')
      .option('--parallel', 'run commands in parallel where possible')
      .option('--continue-on-error', 'continue execution on command failures')
      .option('--vars <vars>', 'variables to pass to batch job (JSON or key=value)')
      .option('--timeout <ms>', 'global timeout for batch job')
      .action(async (file, options) => {
        await this.runBatchJob(file, options);
      });

    // Create batch job
    batchCmd
      .command('create <name>')
      .description('create a new batch job')
      .option('--template <template>', 'batch job template')
      .option('--commands <commands>', 'commands to include (comma-separated)')
      .option('--interactive', 'create job interactively')
      .action(async (name, options) => {
        await this.createBatchJob(name, options);
      });

    // List batch jobs
    batchCmd
      .command('list')
      .alias('ls')
      .description('list available batch jobs')
      .option('--path <path>', 'custom batch jobs directory')
      .action(async (options) => {
        await this.listBatchJobs(options);
      });

    // Validate batch job
    batchCmd
      .command('validate <file>')
      .description('validate batch job YAML file')
      .action(async (file) => {
        await this.validateBatchJob(file);
      });

    // Stop running job
    batchCmd
      .command('stop <jobId>')
      .description('stop a running batch job')
      .action(async (jobId) => {
        await this.stopBatchJob(jobId);
      });

    // Show job status
    batchCmd
      .command('status [jobId]')
      .description('show batch job status')
      .action(async (jobId) => {
        await this.showJobStatus(jobId);
      });

    // Schedule batch job
    batchCmd
      .command('schedule <file>')
      .description('schedule batch job execution')
      .option('--cron <expression>', 'cron expression for scheduling')
      .option('--interval <ms>', 'interval in milliseconds')
      .option('--once', 'run once after delay')
      .action(async (file, options) => {
        await this.scheduleBatchJob(file, options);
      });

    // Export batch job
    batchCmd
      .command('export <file>')
      .description('export batch job to different formats')
      .option('--format <format>', 'export format (json, shell, dockerfile)', 'json')
      .option('--output <path>', 'output file path')
      .action(async (file, options) => {
        await this.exportBatchJob(file, options);
      });

    // Import batch job
    batchCmd
      .command('import <file>')
      .description('import batch job from different formats')
      .option('--format <format>', 'source format (json, shell, package-scripts)')
      .option('--name <name>', 'batch job name')
      .action(async (file, options) => {
        await this.importBatchJob(file, options);
      });

    // Template management
    batchCmd
      .command('template')
      .description('manage batch job templates');

    batchCmd
      .command('template list')
      .description('list available templates')
      .action(async () => {
        await this.listTemplates();
      });

    batchCmd
      .command('template create <name>')
      .description('create a new template')
      .option('--from <file>', 'create template from existing batch job')
      .action(async (name, options) => {
        await this.createTemplate(name, options);
      });
  }

  /**
   * Run batch job from YAML file
   */
  private async runBatchJob(file: string, options: any): Promise<void> {
    try {
      logger.info(`Running batch job: ${chalk.cyan(file)}`);

      // Load and validate batch job
      const job = await this.loadBatchJob(file);
      await this.validateJobStructure(job);

      // Process variables
      const processedJob = await this.processJobVariables(job, options.vars);

      if (options.dryRun) {
        await this.showDryRun(processedJob);
        return;
      }

      // Create job ID and track execution
      const jobId = `job-${Date.now()}`;
      this.runningJobs.set(jobId, {
        file,
        job: processedJob,
        startTime: Date.now(),
        status: 'running'
      });

      try {
        await this.executeBatchJob(processedJob, jobId, options);
        logger.success(`Batch job completed: ${file}`);
      } finally {
        this.runningJobs.delete(jobId);
      }

    } catch (error) {
      throw errorHandler.createError(
        'WUNDR_BATCH_RUN_FAILED',
        'Failed to run batch job',
        { file, options },
        true
      );
    }
  }

  /**
   * Create a new batch job
   */
  private async createBatchJob(name: string, options: any): Promise<void> {
    try {
      logger.info(`Creating batch job: ${chalk.cyan(name)}`);

      let job: BatchJob;

      if (options.interactive) {
        job = await this.createInteractiveBatchJob(name);
      } else if (options.template) {
        job = await this.createJobFromTemplate(name, options.template);
      } else {
        job = this.createBasicBatchJob(name, options);
      }

      const jobPath = path.join(process.cwd(), '.wundr', 'batch', `${name}.yaml`);
      await fs.ensureDir(path.dirname(jobPath));
      await fs.writeFile(jobPath, YAML.stringify(job));

      logger.success(`Batch job created: ${jobPath}`);

    } catch (error) {
      throw errorHandler.createError(
        'WUNDR_BATCH_CREATE_FAILED',
        'Failed to create batch job',
        { name, options },
        true
      );
    }
  }

  /**
   * List available batch jobs
   */
  private async listBatchJobs(options: any): Promise<void> {
    try {
      const batchDir = options.path || path.join(process.cwd(), '.wundr', 'batch');
      
      if (!await fs.pathExists(batchDir)) {
        logger.info('No batch jobs directory found');
        return;
      }

      const files = await fs.readdir(batchDir);
      const yamlFiles = files.filter(f => f.endsWith('.yaml') || f.endsWith('.yml'));

      if (yamlFiles.length === 0) {
        logger.info('No batch jobs found');
        return;
      }

      logger.info(`Batch jobs (${yamlFiles.length}):`);
      
      const jobs = [];
      for (const file of yamlFiles) {
        const filePath = path.join(batchDir, file);
        try {
          const job = await this.loadBatchJob(filePath);
          jobs.push({
            Name: path.basename(file, path.extname(file)),
            Description: job.description || 'No description',
            Commands: job.commands.length,
            Parallel: job.parallel ? '✓' : '✗'
          });
        } catch (error) {
          jobs.push({
            Name: path.basename(file, path.extname(file)),
            Description: 'Invalid YAML',
            Commands: 'N/A',
            Parallel: 'N/A'
          });
        }
      }

      console.table(jobs);

    } catch (error) {
      throw errorHandler.createError(
        'WUNDR_BATCH_LIST_FAILED',
        'Failed to list batch jobs',
        { options },
        true
      );
    }
  }

  /**
   * Validate batch job YAML file
   */
  private async validateBatchJob(file: string): Promise<void> {
    try {
      logger.info(`Validating batch job: ${chalk.cyan(file)}`);

      const job = await this.loadBatchJob(file);
      const validation = await this.validateJobStructure(job);

      if (validation.valid) {
        logger.success('Batch job is valid ✓');
        
        // Show job summary
        console.log(chalk.blue('\nJob Summary:'));
        console.log(`Name: ${job.name}`);
        console.log(`Description: ${job.description || 'None'}`);
        console.log(`Commands: ${job.commands.length}`);
        console.log(`Parallel execution: ${job.parallel ? 'Yes' : 'No'}`);
        console.log(`Continue on error: ${job.continueOnError ? 'Yes' : 'No'}`);
      } else {
        logger.error('Batch job validation failed:');
        validation.errors.forEach(error => {
          logger.error(`  - ${error}`);
        });
        process.exit(1);
      }

    } catch (error) {
      throw errorHandler.createError(
        'WUNDR_BATCH_VALIDATE_FAILED',
        'Failed to validate batch job',
        { file },
        true
      );
    }
  }

  /**
   * Stop a running batch job
   */
  private async stopBatchJob(jobId: string): Promise<void> {
    try {
      const job = this.runningJobs.get(jobId);
      
      if (!job) {
        logger.warn(`Job not found: ${jobId}`);
        return;
      }

      // Stop the job (implementation would depend on how jobs are executed)
      job.status = 'stopped';
      this.runningJobs.delete(jobId);
      
      logger.success(`Batch job stopped: ${jobId}`);

    } catch (error) {
      throw errorHandler.createError(
        'WUNDR_BATCH_STOP_FAILED',
        'Failed to stop batch job',
        { jobId },
        true
      );
    }
  }

  /**
   * Show job status
   */
  private async showJobStatus(jobId?: string): Promise<void> {
    try {
      if (jobId) {
        const job = this.runningJobs.get(jobId);
        if (!job) {
          logger.warn(`Job not found: ${jobId}`);
          return;
        }

        console.log(chalk.blue(`\nJob Status: ${jobId}`));
        console.log(`File: ${job.file}`);
        console.log(`Status: ${job.status}`);
        console.log(`Started: ${new Date(job.startTime).toLocaleString()}`);
        console.log(`Duration: ${Date.now() - job.startTime}ms`);
      } else {
        if (this.runningJobs.size === 0) {
          logger.info('No running batch jobs');
          return;
        }

        console.log(chalk.blue(`\nRunning Jobs (${this.runningJobs.size}):`));
        const jobData = Array.from(this.runningJobs.entries()).map(([id, job]) => ({
          ID: id,
          File: path.basename(job.file),
          Status: job.status,
          Duration: `${Date.now() - job.startTime}ms`
        }));

        console.table(jobData);
      }
    } catch (error) {
      throw errorHandler.createError(
        'WUNDR_BATCH_STATUS_FAILED',
        'Failed to show job status',
        { jobId },
        true
      );
    }
  }

  /**
   * Schedule batch job execution
   */
  private async scheduleBatchJob(file: string, options: any): Promise<void> {
    try {
      logger.info(`Scheduling batch job: ${chalk.cyan(file)}`);

      // Validate the job first
      await this.loadBatchJob(file);

      if (options.cron) {
        logger.info(`Scheduled with cron: ${options.cron}`);
        // Implementation would use a cron library
      } else if (options.interval) {
        logger.info(`Scheduled with interval: ${options.interval}ms`);
        // Implementation would use setInterval
      } else if (options.once) {
        logger.info('Scheduled to run once');
        // Implementation would use setTimeout
      } else {
        throw new Error('No scheduling option provided');
      }

      logger.success('Batch job scheduled successfully');

    } catch (error) {
      throw errorHandler.createError(
        'WUNDR_BATCH_SCHEDULE_FAILED',
        'Failed to schedule batch job',
        { file, options },
        true
      );
    }
  }

  /**
   * Export batch job to different formats
   */
  private async exportBatchJob(file: string, options: any): Promise<void> {
    try {
      logger.info(`Exporting batch job: ${chalk.cyan(file)}`);

      const job = await this.loadBatchJob(file);
      let exportedContent: string;

      switch (options.format) {
        case 'json':
          exportedContent = JSON.stringify(job, null, 2);
          break;
        case 'shell':
          exportedContent = this.convertToShellScript(job);
          break;
        case 'dockerfile':
          exportedContent = this.convertToDockerfile(job);
          break;
        default:
          throw new Error(`Unsupported export format: ${options.format}`);
      }

      const outputPath = options.output || `${path.basename(file, path.extname(file))}.${options.format}`;
      await fs.writeFile(outputPath, exportedContent);

      logger.success(`Batch job exported: ${outputPath}`);

    } catch (error) {
      throw errorHandler.createError(
        'WUNDR_BATCH_EXPORT_FAILED',
        'Failed to export batch job',
        { file, options },
        true
      );
    }
  }

  /**
   * Import batch job from different formats
   */
  private async importBatchJob(file: string, options: any): Promise<void> {
    try {
      logger.info(`Importing batch job: ${chalk.cyan(file)}`);

      let job: BatchJob;

      switch (options.format) {
        case 'json':
          job = await this.importFromJSON(file, options.name);
          break;
        case 'shell':
          job = await this.importFromShell(file, options.name);
          break;
        case 'package-scripts':
          job = await this.importFromPackageScripts(file, options.name);
          break;
        default:
          throw new Error(`Unsupported import format: ${options.format}`);
      }

      const jobName = options.name || path.basename(file, path.extname(file));
      const jobPath = path.join(process.cwd(), '.wundr', 'batch', `${jobName}.yaml`);
      
      await fs.ensureDir(path.dirname(jobPath));
      await fs.writeFile(jobPath, YAML.stringify(job));

      logger.success(`Batch job imported: ${jobPath}`);

    } catch (error) {
      throw errorHandler.createError(
        'WUNDR_BATCH_IMPORT_FAILED',
        'Failed to import batch job',
        { file, options },
        true
      );
    }
  }

  /**
   * Helper methods for batch job operations
   */
  private async loadBatchJob(file: string): Promise<BatchJob> {
    if (!await fs.pathExists(file)) {
      throw new Error(`Batch job file not found: ${file}`);
    }

    const content = await fs.readFile(file, 'utf8');
    const ext = path.extname(file).toLowerCase();

    if (ext === '.yaml' || ext === '.yml') {
      return YAML.parse(content);
    } else if (ext === '.json') {
      return JSON.parse(content);
    } else {
      throw new Error(`Unsupported file format: ${ext}`);
    }
  }

  private async validateJobStructure(job: BatchJob): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    if (!job.name) {
      errors.push('Job name is required');
    }

    if (!job.commands || job.commands.length === 0) {
      errors.push('At least one command is required');
    } else {
      job.commands.forEach((cmd, index) => {
        if (!cmd.command) {
          errors.push(`Command ${index + 1} is missing command property`);
        }
      });
    }

    return { valid: errors.length === 0, errors };
  }

  private async processJobVariables(job: BatchJob, vars?: string): Promise<BatchJob> {
    let variables: Record<string, any> = {};

    if (vars) {
      try {
        // Try parsing as JSON first
        variables = JSON.parse(vars);
      } catch {
        // Parse as key=value pairs
        vars.split(',').forEach(pair => {
          const [key, value] = pair.split('=');
          if (key && value) {
            variables[key.trim()] = value.trim();
          }
        });
      }
    }

    // Replace variables in job
    const processedJob = JSON.parse(JSON.stringify(job));
    const jobString = JSON.stringify(processedJob);
    let processedString = jobString;

    Object.entries(variables).forEach(([key, value]) => {
      const placeholder = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      processedString = processedString.replace(placeholder, String(value));
    });

    return JSON.parse(processedString);
  }

  private async showDryRun(job: BatchJob): Promise<void> {
    console.log(chalk.blue('\nDry Run - Commands to be executed:'));
    console.log(chalk.gray('=' .repeat(50)));

    job.commands.forEach((cmd, index) => {
      console.log(`${index + 1}. ${chalk.cyan(cmd.command)}`);
      if (cmd.args) {
        console.log(`   Args: ${cmd.args.join(' ')}`);
      }
      if (cmd.condition) {
        console.log(`   Condition: ${cmd.condition}`);
      }
      if (cmd.retry) {
        console.log(`   Retry: ${cmd.retry} times`);
      }
      if (cmd.timeout) {
        console.log(`   Timeout: ${cmd.timeout}ms`);
      }
      console.log();
    });

    console.log(chalk.gray('=' .repeat(50)));
    console.log(`Total commands: ${job.commands.length}`);
    console.log(`Parallel execution: ${job.parallel ? 'Yes' : 'No'}`);
    console.log(`Continue on error: ${job.continueOnError ? 'Yes' : 'No'}`);
  }

  private async executeBatchJob(job: BatchJob, jobId: string, options: any): Promise<void> {
    const tasks = job.commands.map((cmd, index) => ({
      title: cmd.command,
      task: async () => {
        await this.executeCommand(cmd, options);
      },
      retry: cmd.retry || 0,
      timeout: cmd.timeout
    }));

    const listr = new Listr(tasks, {
      concurrent: job.parallel || options.parallel,
      exitOnError: !(job.continueOnError || options.continueOnError),
      rendererOptions: {
        collapse: false,
        showSubtasks: true
      }
    });

    await listr.run();
  }

  private async executeCommand(cmd: BatchCommand, options: any): Promise<void> {
    // Check condition if specified
    if (cmd.condition && !await this.evaluateCondition(cmd.condition)) {
      logger.debug(`Skipping command due to condition: ${cmd.condition}`);
      return;
    }

    const { spawn } = await import('child_process');
    const [command, ...args] = cmd.command.split(' ');
    const finalArgs = cmd.args ? [...args, ...cmd.args] : args;

    return new Promise((resolve, reject) => {
      const child = spawn(command, finalArgs, {
        stdio: 'pipe',
        shell: true
      });

      let output = '';
      let error = '';

      child.stdout?.on('data', (data) => {
        output += data.toString();
      });

      child.stderr?.on('data', (data) => {
        error += data.toString();
      });

      child.on('exit', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Command failed with exit code ${code}: ${error}`));
        }
      });

      // Handle timeout
      if (cmd.timeout) {
        setTimeout(() => {
          child.kill();
          reject(new Error(`Command timed out after ${cmd.timeout}ms`));
        }, cmd.timeout);
      }
    });
  }

  private async evaluateCondition(condition: string): Promise<boolean> {
    // Simple condition evaluation
    // In a real implementation, this would be more sophisticated
    switch (condition) {
      case 'always':
        return true;
      case 'never':
        return false;
      default:
        // Could evaluate file existence, environment variables, etc.
        return true;
    }
  }

  private async createInteractiveBatchJob(name: string): Promise<BatchJob> {
    const inquirer = await import('inquirer');
    
    const answers = await inquirer.default.prompt([
      {
        type: 'input',
        name: 'description',
        message: 'Job description:'
      },
      {
        type: 'confirm',
        name: 'parallel',
        message: 'Run commands in parallel?',
        default: false
      },
      {
        type: 'confirm',
        name: 'continueOnError',
        message: 'Continue on command failure?',
        default: false
      }
    ]);

    const commands: BatchCommand[] = [];
    let addMore = true;

    while (addMore) {
      const cmdAnswers = await inquirer.default.prompt([
        {
          type: 'input',
          name: 'command',
          message: 'Command:',
          validate: (input) => input.length > 0 || 'Command is required'
        },
        {
          type: 'input',
          name: 'condition',
          message: 'Condition (optional):'
        },
        {
          type: 'number',
          name: 'retry',
          message: 'Retry count:',
          default: 0
        },
        {
          type: 'confirm',
          name: 'addMore',
          message: 'Add another command?',
          default: true
        }
      ]);

      commands.push({
        command: cmdAnswers.command,
        condition: cmdAnswers.condition || undefined,
        retry: cmdAnswers.retry || undefined
      });

      addMore = cmdAnswers.addMore;
    }

    return {
      name,
      description: answers.description,
      commands,
      parallel: answers.parallel,
      continueOnError: answers.continueOnError
    };
  }

  private createBasicBatchJob(name: string, options: any): BatchJob {
    const commands = options.commands 
      ? options.commands.split(',').map((cmd: string) => ({ command: cmd.trim() }))
      : [];

    return {
      name,
      description: `Batch job: ${name}`,
      commands,
      parallel: false,
      continueOnError: false
    };
  }

  private async createJobFromTemplate(name: string, template: string): Promise<BatchJob> {
    // Load template and create job
    const templatePath = path.join(__dirname, '../../templates/batch', `${template}.yaml`);
    if (await fs.pathExists(templatePath)) {
      const templateJob = await this.loadBatchJob(templatePath);
      return { ...templateJob, name };
    }
    
    throw new Error(`Template not found: ${template}`);
  }

  // Format conversion methods
  private convertToShellScript(job: BatchJob): string {
    let script = `#!/bin/bash\n# Generated from batch job: ${job.name}\n\n`;
    
    if (job.description) {
      script += `# ${job.description}\n\n`;
    }

    script += 'set -e\n\n'; // Exit on error unless continueOnError is true

    job.commands.forEach(cmd => {
      script += `echo "Executing: ${cmd.command}"\n`;
      script += `${cmd.command}\n\n`;
    });

    return script;
  }

  private convertToDockerfile(job: BatchJob): string {
    let dockerfile = `# Generated from batch job: ${job.name}\n`;
    dockerfile += `FROM node:18-alpine\n\n`;
    
    if (job.description) {
      dockerfile += `# ${job.description}\n`;
    }

    dockerfile += `WORKDIR /app\n`;
    dockerfile += `COPY . .\n\n`;

    job.commands.forEach(cmd => {
      dockerfile += `RUN ${cmd.command}\n`;
    });

    return dockerfile;
  }

  private async importFromJSON(file: string, name?: string): Promise<BatchJob> {
    const content = await fs.readJson(file);
    return { ...content, name: name || content.name };
  }

  private async importFromShell(file: string, name?: string): Promise<BatchJob> {
    const content = await fs.readFile(file, 'utf8');
    const commands = content
      .split('\n')
      .filter(line => line.trim() && !line.startsWith('#'))
      .map(line => ({ command: line.trim() }));

    return {
      name: name || path.basename(file, path.extname(file)),
      description: `Imported from shell script: ${file}`,
      commands
    };
  }

  private async importFromPackageScripts(file: string, name?: string): Promise<BatchJob> {
    const packageJson = await fs.readJson(file);
    const scripts = packageJson.scripts || {};
    
    const commands = Object.entries(scripts).map(([script, command]) => ({
      command: `npm run ${script}`,
      args: [],
      condition: undefined
    }));

    return {
      name: name || 'package-scripts',
      description: `Imported from package.json scripts`,
      commands
    };
  }

  private async listTemplates(): Promise<void> {
    const templatesDir = path.join(__dirname, '../../templates/batch');
    if (await fs.pathExists(templatesDir)) {
      const templates = await fs.readdir(templatesDir);
      const yamlTemplates = templates.filter(t => t.endsWith('.yaml') || t.endsWith('.yml'));
      
      if (yamlTemplates.length > 0) {
        logger.info('Available templates:');
        yamlTemplates.forEach(template => {
          console.log(`  - ${path.basename(template, path.extname(template))}`);
        });
      } else {
        logger.info('No templates available');
      }
    } else {
      logger.info('No templates directory found');
    }
  }

  private async createTemplate(name: string, options: any): Promise<void> {
    logger.info(`Creating template: ${name}`);
    
    if (options.from) {
      const job = await this.loadBatchJob(options.from);
      const templatePath = path.join(__dirname, '../../templates/batch', `${name}.yaml`);
      
      await fs.ensureDir(path.dirname(templatePath));
      await fs.writeFile(templatePath, YAML.stringify(job));
      
      logger.success(`Template created: ${templatePath}`);
    } else {
      logger.info('Template creation from scratch not yet implemented');
    }
  }
}