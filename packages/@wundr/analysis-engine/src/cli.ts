#!/usr/bin/env node
/**
 * Analysis Engine CLI - Command line interface for code analysis
 */

import * as path from 'path';

import chalk from 'chalk';
import { program } from 'commander';
import * as fs from 'fs-extra';
import ora from 'ora';

import packageJson from '../package.json';

import { AnalysisEngine, analyzeProjectWithProgress } from './index';

import type { AnalysisConfig, AnalysisProgressEvent } from './types';

// Package info

program
  .name('wundr-analyze')
  .description(
    'Advanced code analysis engine with AST parsing, duplicate detection, and complexity metrics',
  )
  .version(packageJson.version);

program
  .command('analyze [directory]')
  .description('Analyze a codebase for duplicates, complexity, and code smells')
  .option(
    '-o, --output <directory>',
    'Output directory for reports',
    './analysis-output',
  )
  .option(
    '-f, --format <formats>',
    'Output formats: json,html,markdown,csv',
    'json,html',
  )
  .option('--include-tests', 'Include test files in analysis', false)
  .option(
    '--exclude <patterns>',
    'Additional exclude patterns (comma-separated)',
  )
  .option(
    '--max-complexity <number>',
    'Maximum cyclomatic complexity threshold',
    '10',
  )
  .option(
    '--min-similarity <number>',
    'Minimum similarity for duplicate detection',
    '0.8',
  )
  .option('--concurrency <number>', 'Maximum concurrent file processing', '10')
  .option('--enable-ai', 'Enable AI-powered analysis features', false)
  .option('--verbose', 'Enable verbose output', false)
  .action(async (directory, options) => {
    const targetDir = path.resolve(directory || process.cwd());

    console.log(chalk.blue.bold('🔍 Wundr Analysis Engine'));
    console.log(chalk.gray(`Analyzing: ${targetDir}`));
    console.log(chalk.gray(`Version: ${packageJson.version}\n`));

    // Validate target directory
    if (!(await fs.pathExists(targetDir))) {
      console.error(chalk.red(`❌ Directory not found: ${targetDir}`));
      process.exit(1);
    }

    // Parse configuration
    const config: Partial<AnalysisConfig> = {
      targetDir,
      outputFormats: options.format.split(',').map((f: string) => f.trim()),
      includeTests: options.includeTests,
      enableAIAnalysis: options.enableAi,
      performance: {
        maxConcurrency: parseInt(options.concurrency),
        chunkSize: 100,
        enableCaching: true,
      },
      thresholds: {
        complexity: {
          cyclomatic: parseInt(options.maxComplexity),
          cognitive: parseInt(options.maxComplexity) * 1.5,
        },
        duplicates: {
          minSimilarity: parseFloat(options.minSimilarity),
        },
        fileSize: {
          maxLines: 500,
        },
      },
    };

    // Add exclude patterns
    if (options.exclude) {
      config.excludePatterns = [
        ...(config.excludePatterns || []),
        ...options.exclude.split(',').map((p: string) => p.trim()),
      ];
    }

    // Set output directory
    if (options.output) {
      (config as AnalysisConfig & { outputDir?: string }).outputDir = path.resolve(options.output);
    }

    // Progress tracking
    const spinner = ora();
    let currentPhase = '';
    let processed = 0;
    let total = 0;

    const progressCallback = (event: AnalysisProgressEvent) => {
      switch (event.type) {
        case 'phase':
          currentPhase = event.message || '';
          if (options.verbose) {
            spinner.text = chalk.cyan(currentPhase);
            if (!spinner.isSpinning) {
spinner.start();
}
          }
          break;

        case 'progress':
          if (event.total && event.progress !== undefined) {
            processed = event.progress;
            total = event.total;
            if (options.verbose) {
              const percent = Math.round((processed / total) * 100);
              spinner.text = chalk.cyan(
                `${currentPhase} (${processed}/${total} - ${percent}%)`,
              );
            }
          }
          break;

        case 'complete':
          if (spinner.isSpinning) {
spinner.succeed(chalk.green(event.message || 'Analysis completed'));
}
          break;

        case 'error':
          if (spinner.isSpinning) {
spinner.fail(chalk.red(event.message || 'Analysis failed'));
}
          break;
      }
    };

    try {
      const startTime = Date.now();

      if (options.verbose) {
        spinner.start('Starting analysis...');
      } else {
        console.log('⏳ Running analysis...');
      }

      const report = await analyzeProjectWithProgress(
        targetDir,
        progressCallback,
        config,
      );

      const duration = Date.now() - startTime;

      // Display results summary
      console.log('\n📊 ' + chalk.bold('Analysis Summary'));
      console.log(chalk.gray('─'.repeat(50)));

      console.log(
        `${chalk.green('✓')} Files analyzed: ${chalk.bold(report.summary.totalFiles)}`,
      );
      console.log(
        `${chalk.green('✓')} Entities found: ${chalk.bold(report.summary.totalEntities)}`,
      );
      console.log(
        `${chalk.yellow('⚠')} Duplicate clusters: ${chalk.bold(report.summary.duplicateClusters)}`,
      );
      console.log(
        `${chalk.yellow('⚠')} Circular dependencies: ${chalk.bold(report.summary.circularDependencies)}`,
      );
      console.log(
        `${chalk.blue('ℹ')} Unused exports: ${chalk.bold(report.summary.unusedExports)}`,
      );
      console.log(
        `${chalk.red('✗')} Code smells: ${chalk.bold(report.summary.codeSmells)}`,
      );

      console.log('\n🎯 ' + chalk.bold('Quality Metrics'));
      console.log(chalk.gray('─'.repeat(50)));
      console.log(
        `Average complexity: ${chalk.bold(report.summary.averageComplexity.toFixed(1))}`,
      );
      console.log(
        `Maintainability index: ${chalk.bold(report.summary.maintainabilityIndex.toFixed(1))}/100`,
      );
      console.log(
        `Technical debt: ${chalk.bold(report.summary.technicalDebt.estimatedHours.toFixed(1))} hours`,
      );
      console.log(
        `Quality score: ${chalk.bold(report.summary.technicalDebt.score)}/100`,
      );

      console.log('\n⚡ ' + chalk.bold('Performance'));
      console.log(chalk.gray('─'.repeat(50)));
      console.log(`Analysis time: ${chalk.bold(formatDuration(duration))}`);
      console.log(
        `Files/second: ${chalk.bold(report.performance.filesPerSecond)}`,
      );
      console.log(
        `Memory peak: ${chalk.bold(formatBytes(report.performance.memoryUsage.peak))}`,
      );
      console.log(`Cache hits: ${chalk.bold(report.performance.cacheHits)}`);

      // Display top recommendations
      if (report.recommendations.length > 0) {
        console.log('\n💡 ' + chalk.bold('Top Recommendations'));
        console.log(chalk.gray('─'.repeat(50)));

        report.recommendations.slice(0, 5).forEach((rec, index) => {
          const priority =
            rec.priority === 'critical'
              ? chalk.red('CRITICAL')
              : rec.priority === 'high'
                ? chalk.yellow('HIGH')
                : rec.priority === 'medium'
                  ? chalk.blue('MEDIUM')
                  : chalk.gray('LOW');

          console.log(`${index + 1}. [${priority}] ${rec.title}`);
          console.log(`   ${chalk.gray(rec.description)}`);
          if (rec.estimatedTimeHours) {
            console.log(
              `   ${chalk.gray(`Estimated effort: ${rec.estimatedTimeHours}h`)}`,
            );
          }
        });

        if (report.recommendations.length > 5) {
          console.log(
            `\n   ${chalk.gray(`... and ${report.recommendations.length - 5} more recommendations`)}`,
          );
        }
      }

      // Output location
      console.log('\n📁 ' + chalk.bold('Reports Generated'));
      console.log(chalk.gray('─'.repeat(50)));
      const outputDir = (config as AnalysisConfig & { outputDir?: string }).outputDir || './analysis-output';
      console.log(`Reports saved to: ${chalk.bold(outputDir)}`);

      config.outputFormats?.forEach(format => {
        console.log(`  • latest.${format}`);
      });

      console.log('\n' + chalk.green('✅ Analysis completed successfully!'));

      // Exit with appropriate code
      const hasIssues =
        report.summary.duplicateClusters > 0 ||
        report.summary.circularDependencies > 0 ||
        report.summary.codeSmells > 0;

      process.exit(hasIssues ? 1 : 0);
    } catch (error) {
      console.error('\n' + chalk.red('❌ Analysis failed:'));
      console.error(chalk.red((error as Error).message));

      if (options.verbose && error instanceof Error && error.stack) {
        console.error('\n' + chalk.gray('Stack trace:'));
        console.error(chalk.gray(error.stack));
      }

      process.exit(1);
    }
  });

program
  .command('init')
  .description('Initialize analysis configuration file')
  .option('-f, --force', 'Overwrite existing configuration', false)
  .action(async options => {
    const configPath = path.join(process.cwd(), 'wundr-analysis.config.json');

    if ((await fs.pathExists(configPath)) && !options.force) {
      console.log(
        chalk.yellow(
          '⚠️ Configuration file already exists. Use --force to overwrite.',
        ),
      );
      return;
    }

    const defaultConfig = {
      targetDir: '.',
      excludeDirs: ['node_modules', 'dist', 'build', 'coverage', '.git'],
      includePatterns: ['**/*.{ts,tsx,js,jsx}'],
      excludePatterns: [
        '**/*.{test,spec}.{ts,tsx,js,jsx}',
        '**/__tests__/**/*',
      ],
      includeTests: false,
      enableAIAnalysis: false,
      outputFormats: ['json', 'html'],
      performance: {
        maxConcurrency: 10,
        chunkSize: 100,
        enableCaching: true,
      },
      thresholds: {
        complexity: {
          cyclomatic: 10,
          cognitive: 15,
        },
        duplicates: {
          minSimilarity: 0.8,
        },
        fileSize: {
          maxLines: 500,
        },
      },
    };

    await fs.writeJson(configPath, defaultConfig, { spaces: 2 });
    console.log(
      chalk.green('✅ Configuration file created: ') + chalk.bold(configPath),
    );
    console.log('Edit the file to customize your analysis settings.');
  });

program
  .command('benchmark')
  .description('Run performance benchmark on sample codebase')
  .option('--size <size>', 'Benchmark size: small, medium, large', 'medium')
  .action(async options => {
    console.log(chalk.blue('🚀 Running performance benchmark...'));
    console.log(chalk.gray(`Benchmark size: ${options.size}\n`));

    try {
      // Create benchmark project
      const benchmarkDir = await createBenchmarkProject(options.size);

      const startTime = Date.now();
      const engine = new AnalysisEngine({ targetDir: benchmarkDir });

      let _filesProcessed = 0;
      engine.setProgressCallback(event => {
        if (event.type === 'progress' && event.progress !== undefined) {
          _filesProcessed = event.progress;
        }
      });

      const report = await engine.analyze();
      const duration = Date.now() - startTime;

      console.log(chalk.green('✅ Benchmark completed!'));
      console.log('\n📊 ' + chalk.bold('Results'));
      console.log(chalk.gray('─'.repeat(40)));
      console.log(`Files processed: ${chalk.bold(report.summary.totalFiles)}`);
      console.log(
        `Entities analyzed: ${chalk.bold(report.summary.totalEntities)}`,
      );
      console.log(`Total time: ${chalk.bold(formatDuration(duration))}`);
      console.log(
        `Files/second: ${chalk.bold(report.performance.filesPerSecond)}`,
      );
      console.log(
        `Entities/second: ${chalk.bold(report.performance.entitiesPerSecond)}`,
      );
      console.log(
        `Memory peak: ${chalk.bold(formatBytes(report.performance.memoryUsage.peak))}`,
      );

      // Cleanup benchmark directory
      await fs.remove(benchmarkDir);
    } catch (error) {
      console.error(
        chalk.red('❌ Benchmark failed:'),
        (error as Error).message,
      );
      process.exit(1);
    }
  });

// Utility functions
function formatDuration(ms: number): string {
  if (ms < 1000) {
return `${ms}ms`;
}
  const seconds = ms / 1000;
  if (seconds < 60) {
return `${seconds.toFixed(1)}s`;
}
  const minutes = seconds / 60;
  return `${Math.floor(minutes)}m ${Math.floor(seconds % 60)}s`;
}

function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

async function createBenchmarkProject(size: string): Promise<string> {
  const benchmarkDir = path.join(process.cwd(), `.benchmark-${Date.now()}`);
  await fs.ensureDir(benchmarkDir);

  const fileCounts = {
    small: 10,
    medium: 50,
    large: 200,
  };

  const fileCount =
    fileCounts[size as keyof typeof fileCounts] || fileCounts.medium;

  // Generate sample TypeScript files
  for (let i = 0; i < fileCount; i++) {
    const content = generateSampleCode(i);
    await fs.writeFile(path.join(benchmarkDir, `file${i}.ts`), content);
  }

  // Add package.json and tsconfig.json
  await fs.writeJson(path.join(benchmarkDir, 'package.json'), {
    name: 'benchmark-project',
    version: '1.0.0',
    main: 'index.js',
  });

  await fs.writeJson(path.join(benchmarkDir, 'tsconfig.json'), {
    compilerOptions: {
      target: 'ES2020',
      module: 'commonjs',
      lib: ['ES2020'],
      outDir: './dist',
      rootDir: './src',
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
      forceConsistentCasingInFileNames: true,
    },
    include: ['**/*.ts'],
    exclude: ['node_modules', 'dist'],
  });

  return benchmarkDir;
}

function generateSampleCode(index: number): string {
  return `// Generated file ${index}
export interface Entity${index} {
  id: number;
  name: string;
  value: string;
  created: Date;
}

export class Service${index} {
  private items: Entity${index}[] = [];
  
  constructor(private config: any) {}
  
  async create(entity: Entity${index}): Promise<Entity${index}> {
    if (!entity.name) {
      throw new Error('Name is required');
    }
    
    if (!entity.value) {
      throw new Error('Value is required');
    }
    
    const existing = this.items.find(item => item.name === entity.name);
    if (existing) {
      throw new Error('Entity already exists');
    }
    
    const created = {
      ...entity,
      id: this.items.length + 1,
      created: new Date()
    };
    
    this.items.push(created);
    return created;
  }
  
  async findById(id: number): Promise<Entity${index} | null> {
    return this.items.find(item => item.id === id) || null;
  }
  
  async findByName(name: string): Promise<Entity${index} | null> {
    return this.items.find(item => item.name === name) || null;
  }
  
  async update(id: number, updates: Partial<Entity${index}>): Promise<Entity${index}> {
    const index = this.items.findIndex(item => item.id === id);
    if (index === -1) {
      throw new Error('Entity not found');
    }
    
    this.items[index] = { ...this.items[index], ...updates };
    return this.items[index];
  }
  
  async delete(id: number): Promise<boolean> {
    const index = this.items.findIndex(item => item.id === id);
    if (index === -1) {
      return false;
    }
    
    this.items.splice(index, 1);
    return true;
  }
}

export function format${index}(entity: Entity${index}): string {
  return \`\${entity.name}: \${entity.value}\`;
}
`;
}

// Parse and execute
if (require.main === module) {
  program.parse();
}
