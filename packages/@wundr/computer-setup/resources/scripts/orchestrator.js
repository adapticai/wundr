#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Hub-and-Spoke Claude Code Orchestrator
 *
 * Fault-tolerant, hardware-adaptive orchestration system for massive concurrency.
 * Spawns isolated claude-code processes with automatic retry and backoff.
 *
 * Features:
 * - Hardware-adaptive concurrency limits
 * - Process isolation (cascade failure prevention)
 * - Exponential backoff for rate limit handling
 * - Progress tracking and comprehensive logging
 * - Graceful shutdown on SIGINT/SIGTERM
 *
 * @module orchestrator
 */

import { spawn } from 'child_process';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

import pLimit from 'p-limit';

import { detectHardware, calculateV8Limits } from './detect-hardware-limits.js';

/**
 * @typedef {Object} Task
 * @property {string} id
 * @property {string} prompt
 * @property {number} [priority]
 * @property {number} [maxRetries]
 * @property {number} [timeout]
 */

/**
 * @typedef {Object} TaskResult
 * @property {string} taskId
 * @property {boolean} success
 * @property {string} [output]
 * @property {string} [error]
 * @property {number} attempts
 * @property {number} duration
 * @property {Date} timestamp
 */

/**
 * @typedef {Object} OrchestratorConfig
 * @property {Task[]} tasks
 * @property {number} [concurrency] - If not provided, calculated from hardware
 * @property {number} [defaultTimeout] - Default: 10 minutes
 * @property {number} [defaultMaxRetries] - Default: 3
 * @property {string} [outputDir]
 * @property {boolean} [dangerouslySkipPermissions]
 * @property {string} [claudeCodePath]
 */

/**
 * @typedef {Object} OrchestratorStats
 * @property {number} totalTasks
 * @property {number} completed
 * @property {number} failed
 * @property {number} inProgress
 * @property {Date} startTime
 * @property {Date} [endTime]
 * @property {TaskResult[]} results
 */

/**
 * Calculates optimal concurrency based on hardware specs and API tier
 * @returns {number}
 */
function calculateOptimalConcurrency() {
  const specs = detectHardware();
  const limits = calculateV8Limits(specs);

  // Base concurrency on available cores and RAM
  // Rule: 1 concurrent task per 2GB of allocated heap, capped by cores
  const heapGB = limits.maxOldSpaceSizeMB / 1024;
  const ramBasedConcurrency = Math.floor(heapGB / 2);
  const coreBasedConcurrency = specs.physicalCores;

  // Use the minimum to avoid over-subscription
  const safeConcurrency = Math.min(ramBasedConcurrency, coreBasedConcurrency);

  // Apply reasonable bounds: min 2, max 50 (API tier 4 limit)
  return Math.max(2, Math.min(safeConcurrency, 50));
}

/**
 * Exponential backoff calculator
 * @param {number} attempt
 * @returns {number}
 */
function calculateBackoff(attempt) {
  const baseDelay = 1000; // 1 second
  const maxDelay = 60000; // 60 seconds
  const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
  // Add jitter to prevent thundering herd
  return delay + Math.random() * 1000;
}

/**
 * Executes a single task with retry logic
 * @param {Task} task
 * @param {OrchestratorConfig} config
 * @param {string} nodeOptions
 * @returns {Promise<TaskResult>}
 */
async function executeTask(task, config, nodeOptions) {
  const startTime = Date.now();
  const maxRetries = task.maxRetries ?? config.defaultMaxRetries ?? 3;
  const timeout = task.timeout ?? config.defaultTimeout ?? 600000; // 10 min
  const claudePath = config.claudeCodePath ?? 'claude';

  /** @type {Error | undefined} */
  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      const backoffMs = calculateBackoff(attempt - 1);
      console.log(
        `[${task.id}] Retry ${attempt}/${maxRetries} after ${backoffMs}ms backoff`
      );
      await new Promise(resolve => setTimeout(resolve, backoffMs));
    }

    try {
      const output = await new Promise((resolve, reject) => {
        const args = ['-p', task.prompt];

        if (config.dangerouslySkipPermissions) {
          args.unshift('--dangerously-skip-permissions');
        }

        // Spawn isolated process with inherited memory limits
        const child = spawn(claudePath, args, {
          env: {
            ...process.env,
            NODE_OPTIONS: nodeOptions,
            CLAUDE_TASK_ID: task.id,
          },
          timeout,
          stdio: ['pipe', 'pipe', 'pipe'],
        });

        let stdout = '';
        let stderr = '';

        child.stdout?.on('data', data => {
          const chunk = data.toString();
          stdout += chunk;
          // Stream output for visibility
          process.stdout.write(`[${task.id}] ${chunk}`);
        });

        child.stderr?.on('data', data => {
          const chunk = data.toString();
          stderr += chunk;
          process.stderr.write(`[${task.id}] ${chunk}`);
        });

        child.on('error', error => {
          reject(new Error(`Process spawn failed: ${error.message}`));
        });

        child.on('close', code => {
          if (code === 0) {
            resolve(stdout);
          } else if (code === 429) {
            reject(new Error('Rate limit exceeded (HTTP 429)'));
          } else {
            reject(
              new Error(`Process exited with code ${code}\nStderr: ${stderr}`)
            );
          }
        });

        // Timeout handler
        setTimeout(() => {
          child.kill('SIGTERM');
          reject(new Error(`Task timeout after ${timeout}ms`));
        }, timeout);
      });

      // Success
      const duration = Date.now() - startTime;
      return {
        taskId: task.id,
        success: true,
        output,
        attempts: attempt + 1,
        duration,
        timestamp: new Date(),
      };
    } catch (error) {
      lastError = error;
      console.error(
        `[${task.id}] Attempt ${attempt + 1} failed: ${lastError?.message || error}`
      );

      // Don't retry on certain errors
      if (lastError?.message?.includes('timeout') && attempt >= 1) {
        break; // Timeouts are unlikely to succeed on retry
      }
    }
  }

  // All retries exhausted
  const duration = Date.now() - startTime;
  return {
    taskId: task.id,
    success: false,
    error: lastError?.message ?? 'Unknown error',
    attempts: maxRetries + 1,
    duration,
    timestamp: new Date(),
  };
}

/**
 * Main orchestrator execution
 * @param {OrchestratorConfig} config
 * @returns {Promise<OrchestratorStats>}
 */
export async function orchestrate(config) {
  /** @type {OrchestratorStats} */
  const stats = {
    totalTasks: config.tasks.length,
    completed: 0,
    failed: 0,
    inProgress: 0,
    startTime: new Date(),
    results: [],
  };

  // Detect hardware and calculate limits
  const specs = detectHardware();
  const limits = calculateV8Limits(specs);
  const concurrency = config.concurrency ?? calculateOptimalConcurrency();

  console.log(
    '╔══════════════════════════════════════════════════════════════╗'
  );
  console.log(
    '║  Claude Code Hub-and-Spoke Orchestrator                     ║'
  );
  console.log(
    '╚══════════════════════════════════════════════════════════════╝'
  );
  console.log('');
  console.log(
    `📊 Hardware: ${specs.totalRamGB}GB RAM, ${specs.physicalCores} cores`
  );
  console.log(
    `⚙️  V8 Limits: ${(limits.maxOldSpaceSizeMB / 1024).toFixed(1)}GB heap`
  );
  console.log(`🔀 Concurrency: ${concurrency} parallel tasks`);
  console.log(`📋 Total Tasks: ${stats.totalTasks}`);
  console.log('');

  // Create output directory
  const outputDir =
    config.outputDir ?? join(process.cwd(), '.orchestrator-output');
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  // Set up concurrency limiter
  const limit = pLimit(concurrency);

  // Set up graceful shutdown
  let shuttingDown = false;
  const shutdown = () => {
    if (!shuttingDown) {
      shuttingDown = true;
      console.log('\n\n⚠️  Graceful shutdown initiated...');
      console.log(`   Completed: ${stats.completed}/${stats.totalTasks}`);
      console.log(`   In Progress: ${stats.inProgress} (will complete)`);
      // Don't force-kill in-progress tasks
    }
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  // Execute tasks with concurrency control
  const promises = config.tasks.map((task, index) =>
    limit(async () => {
      if (shuttingDown) {
        console.log(`[${task.id}] Skipping due to shutdown`);
        return;
      }

      stats.inProgress++;
      console.log(
        `\n[${task.id}] Starting (${index + 1}/${stats.totalTasks})...`
      );

      const result = await executeTask(task, config, limits.nodeOptions);
      stats.results.push(result);

      stats.inProgress--;
      if (result.success) {
        stats.completed++;
        console.log(
          `[${task.id}] ✅ Completed in ${(result.duration / 1000).toFixed(1)}s`
        );

        // Save output to file
        const outputFile = join(outputDir, `${task.id}.txt`);
        writeFileSync(outputFile, result.output ?? '', 'utf8');
      } else {
        stats.failed++;
        console.error(
          `[${task.id}] ❌ Failed after ${result.attempts} attempts: ${result.error}`
        );

        // Save error to file
        const errorFile = join(outputDir, `${task.id}.error.txt`);
        writeFileSync(errorFile, result.error ?? 'Unknown error', 'utf8');
      }

      // Progress update
      const progress = (
        ((stats.completed + stats.failed) / stats.totalTasks) *
        100
      ).toFixed(1);
      console.log(
        `📊 Progress: ${progress}% (${stats.completed} ✅, ${stats.failed} ❌, ${stats.inProgress} 🔄)`
      );
    })
  );

  // Wait for all tasks to complete
  await Promise.all(promises);

  stats.endTime = new Date();

  // Final report
  console.log(
    '\n╔══════════════════════════════════════════════════════════════╗'
  );
  console.log(
    '║  Orchestration Complete                                     ║'
  );
  console.log(
    '╚══════════════════════════════════════════════════════════════╝'
  );
  console.log(`✅ Completed: ${stats.completed}/${stats.totalTasks}`);
  console.log(`❌ Failed: ${stats.failed}/${stats.totalTasks}`);
  console.log(
    `⏱️  Duration: ${((stats.endTime.getTime() - stats.startTime.getTime()) / 1000).toFixed(1)}s`
  );
  console.log(`📁 Output: ${outputDir}`);

  // Save final stats
  const statsFile = join(outputDir, 'orchestration-stats.json');
  writeFileSync(statsFile, JSON.stringify(stats, null, 2), 'utf8');
  console.log(`📊 Stats: ${statsFile}`);

  return stats;
}

// CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const configPath = process.argv[2];

  if (!configPath) {
    console.error('Usage: node orchestrator.js <config.json>');
    console.error('');
    console.error('Config format:');
    console.error(
      JSON.stringify(
        {
          tasks: [
            { id: 'task-1', prompt: 'Your task here' },
            { id: 'task-2', prompt: 'Another task', priority: 1 },
          ],
          concurrency: 10,
          dangerouslySkipPermissions: false,
        },
        null,
        2
      )
    );
    process.exit(1);
  }

  if (!existsSync(configPath)) {
    console.error(`Config file not found: ${configPath}`);
    process.exit(1);
  }

  const config = JSON.parse(
    await import('fs').then(fs => fs.promises.readFile(configPath, 'utf8'))
  );
  const stats = await orchestrate(config);

  process.exit(stats.failed > 0 ? 1 : 0);
}
