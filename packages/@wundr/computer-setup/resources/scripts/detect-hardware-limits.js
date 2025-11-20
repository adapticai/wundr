#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Hardware-Adaptive V8 Memory Configuration
 *
 * Dynamically calculates optimal Node.js/V8 memory limits based on system specs.
 * Works across M4 Mac Mini (16-32GB), Mac Studio (64GB+), and future hardware.
 *
 * @module detect-hardware-limits
 */

import { execSync } from 'child_process';
import { writeFileSync } from 'fs';
import os from 'os';
import { join } from 'path';

/**
 * @typedef {Object} HardwareSpecs
 * @property {number} totalRamGB
 * @property {number} totalRamMB
 * @property {number} physicalCores
 * @property {number} logicalCores
 * @property {string} platform
 * @property {string} arch
 * @property {string} cpuModel
 */

/**
 * @typedef {Object} V8Limits
 * @property {number} maxOldSpaceSizeMB
 * @property {number} maxSemiSpaceSizeMB
 * @property {number} v8PoolSize
 * @property {string} nodeOptions
 * @property {string} v8Flags
 * @property {number} allocatedPercentage
 */

/**
 * Detects system hardware specifications
 * @returns {HardwareSpecs}
 */
function detectHardware() {
  const totalRamBytes = os.totalmem();
  const totalRamGB = Math.floor(totalRamBytes / 1024 ** 3);
  const totalRamMB = Math.floor(totalRamBytes / 1024 ** 2);
  const physicalCores = os.cpus().length;

  const logicalCores = physicalCores;
  const cpuModel = os.cpus()[0]?.model || 'Unknown';

  // On macOS, get accurate core counts
  if (os.platform() === 'darwin') {
    try {
      const physicalCoreCount = parseInt(
        execSync('sysctl -n hw.physicalcpu', { encoding: 'utf8' }).trim()
      );
      const logicalCoreCount = parseInt(
        execSync('sysctl -n hw.ncpu', { encoding: 'utf8' }).trim()
      );

      return {
        totalRamGB,
        totalRamMB,
        physicalCores: physicalCoreCount,
        logicalCores: logicalCoreCount,
        platform: os.platform(),
        arch: os.arch(),
        cpuModel,
      };
    } catch (_error) {
      // Fallback if sysctl fails
      console.warn('Warning: Could not read macOS sysctl, using os.cpus()');
    }
  }

  return {
    totalRamGB,
    totalRamMB,
    physicalCores,
    logicalCores,
    platform: os.platform(),
    arch: os.arch(),
    cpuModel,
  };
}

/**
 * Calculates optimal V8 memory limits based on available RAM
 *
 * Strategy:
 * - Mac Mini (16-32GB): Use 65% of RAM for heap
 * - Mac Studio (64GB+): Use 70% of RAM for heap
 * - Always leave minimum 4GB for OS and other processes
 * - Semi-space: 3% of total RAM (or max 2GB for efficiency)
 * - Thread pool: Physical cores (max 16 to prevent over-threading)
 * @param {HardwareSpecs} specs
 * @returns {V8Limits}
 */
function calculateV8Limits(specs) {
  const { totalRamGB, totalRamMB, physicalCores } = specs;

  // Determine allocation strategy based on total RAM
  let heapPercentage;
  let minOsReserveGB;

  if (totalRamGB >= 64) {
    // Mac Studio or better: Aggressive allocation
    heapPercentage = 0.7; // 70%
    minOsReserveGB = 8;
  } else if (totalRamGB >= 32) {
    // High-spec Mac Mini
    heapPercentage = 0.65; // 65%
    minOsReserveGB = 6;
  } else if (totalRamGB >= 16) {
    // Base Mac Mini
    heapPercentage = 0.6; // 60%
    minOsReserveGB = 4;
  } else {
    // Lower spec machines (fallback)
    heapPercentage = 0.5; // 50%
    minOsReserveGB = 2;
  }

  // Calculate max old space (main heap)
  const maxHeapGB = Math.floor(totalRamGB * heapPercentage);
  const safeMaxHeapGB = Math.max(2, totalRamGB - minOsReserveGB); // Never exceed total - reserve
  const finalMaxHeapGB = Math.min(maxHeapGB, safeMaxHeapGB);
  const maxOldSpaceSizeMB = finalMaxHeapGB * 1024;

  // Calculate semi-space (young generation)
  // Rule: 3% of total RAM, capped at 2GB for GC efficiency
  const semiSpaceRawMB = Math.floor(totalRamMB * 0.03);
  const maxSemiSpaceSizeMB = Math.min(semiSpaceRawMB, 2048);

  // Calculate V8 thread pool size
  // Use physical cores, capped at 16 (diminishing returns beyond that)
  const v8PoolSize = Math.min(physicalCores, 16);

  // Build NODE_OPTIONS string
  const nodeOptions = `--max-old-space-size=${maxOldSpaceSizeMB} --max-semi-space-size=${maxSemiSpaceSizeMB}`;

  // V8 flags for text-heavy LLM workloads
  const v8Flags = '--thin-strings --lazy';

  return {
    maxOldSpaceSizeMB,
    maxSemiSpaceSizeMB,
    v8PoolSize,
    nodeOptions,
    v8Flags,
    allocatedPercentage: Math.round((finalMaxHeapGB / totalRamGB) * 100),
  };
}

/**
 * Generates shell export commands for use in .zshrc/.bashrc
 * @param {HardwareSpecs} specs
 * @param {V8Limits} limits
 * @returns {string}
 */
function generateShellConfig(specs, limits) {
  return `# Auto-generated V8 Memory Configuration (Hardware-Adaptive)
# Generated: ${new Date().toISOString()}
# System: ${specs.cpuModel}
# RAM: ${specs.totalRamGB}GB | Cores: ${specs.physicalCores}P/${specs.logicalCores}L
# Heap Allocation: ${(limits.maxOldSpaceSizeMB / 1024).toFixed(1)}GB (${limits.allocatedPercentage}% of total RAM)

export NODE_OPTIONS="${limits.nodeOptions}"
export V8_FLAGS="${limits.v8Flags}"
export CLAUDE_V8_POOL_SIZE="${limits.v8PoolSize}"

# Usage: source this file or add to your .zshrc/.bashrc
# Example: source ~/adapticai/engine/scripts/.env.claude-memory
`;
}

/**
 * Main execution
 */
function main() {
  const outputFormat = process.argv[2] || 'human';

  const specs = detectHardware();
  const limits = calculateV8Limits(specs);

  if (outputFormat === 'json') {
    // JSON output for programmatic use
    console.log(JSON.stringify({ specs, limits }, null, 2));
    return;
  }

  if (outputFormat === 'env') {
    // Shell environment variable format
    console.log(`NODE_OPTIONS="${limits.nodeOptions}"`);
    console.log(`V8_FLAGS="${limits.v8Flags}"`);
    console.log(`CLAUDE_V8_POOL_SIZE="${limits.v8PoolSize}"`);
    return;
  }

  if (outputFormat === 'export') {
    // Shell export commands (can be sourced)
    console.log(`export NODE_OPTIONS="${limits.nodeOptions}"`);
    console.log(`export V8_FLAGS="${limits.v8Flags}"`);
    console.log(`export CLAUDE_V8_POOL_SIZE="${limits.v8PoolSize}"`);
    return;
  }

  // Human-readable output
  console.log(
    '╔══════════════════════════════════════════════════════════════╗'
  );
  console.log(
    '║  Hardware-Adaptive V8 Memory Configuration                  ║'
  );
  console.log(
    '╚══════════════════════════════════════════════════════════════╝'
  );
  console.log('');
  console.log('📊 DETECTED HARDWARE:');
  console.log(`   Platform:        ${specs.platform}/${specs.arch}`);
  console.log(`   CPU:             ${specs.cpuModel}`);
  console.log(`   Physical Cores:  ${specs.physicalCores}`);
  console.log(`   Logical Cores:   ${specs.logicalCores}`);
  console.log(`   Total RAM:       ${specs.totalRamGB} GB`);
  console.log('');
  console.log('⚙️  CALCULATED V8 LIMITS:');
  console.log(
    `   Heap Size:       ${(limits.maxOldSpaceSizeMB / 1024).toFixed(1)} GB (${limits.allocatedPercentage}% of total RAM)`
  );
  console.log(`   Semi-Space:      ${limits.maxSemiSpaceSizeMB} MB`);
  console.log(`   Thread Pool:     ${limits.v8PoolSize} threads`);
  console.log('');
  console.log('🔧 ENVIRONMENT CONFIGURATION:');
  console.log(`   export NODE_OPTIONS="${limits.nodeOptions}"`);
  console.log(`   export V8_FLAGS="${limits.v8Flags}"`);
  console.log('');
  console.log('📝 USAGE:');
  console.log('   1. Add to shell profile:');
  console.log(
    '      echo "$(node scripts/detect-hardware-limits.js export)" >> ~/.zshrc'
  );
  console.log('');
  console.log('   2. Or source dynamically:');
  console.log('      eval "$(node scripts/detect-hardware-limits.js export)"');
  console.log('');
  console.log('   3. Or save to file:');
  console.log(
    '      node scripts/detect-hardware-limits.js export > scripts/.env.claude-memory'
  );
  console.log('      source scripts/.env.claude-memory');
  console.log('');

  // Also write to a .env file for easy sourcing
  const projectRoot = join(process.cwd(), 'scripts', '.env.claude-memory');
  const shellConfig = generateShellConfig(specs, limits);

  try {
    writeFileSync(projectRoot, shellConfig, 'utf8');
    console.log(`✅ Configuration saved to: ${projectRoot}`);
    console.log('   To activate: source scripts/.env.claude-memory');
  } catch (error) {
    console.error(`❌ Failed to write config file: ${error}`);
  }
}

// Execute if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { detectHardware, calculateV8Limits, generateShellConfig };
