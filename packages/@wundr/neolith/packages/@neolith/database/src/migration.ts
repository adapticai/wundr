/**
 * Database Migration Service
 *
 * Provides functions for managing Prisma migrations programmatically.
 * Uses child_process to execute Prisma CLI commands.
 */

import { exec, execSync, ExecException } from 'child_process';
import { promisify } from 'util';
import { existsSync, readdirSync, readFileSync } from 'fs';
import { join, dirname } from 'path';

const execAsync = promisify(exec);

/**
 * Get the path to the prisma directory
 */
function getPrismaDir(): string {
  // Try to find prisma directory relative to this file
  const possiblePaths: string[] = [
    join(dirname(__dirname), 'prisma'),
    join(process.cwd(), 'prisma'),
    join(process.cwd(), 'packages/@genesis/database/prisma'),
  ];

  for (const p of possiblePaths) {
    if (existsSync(join(p, 'schema.prisma'))) {
      return p;
    }
  }

  // Default fallback - return first path (always defined since array is non-empty)
  return possiblePaths[0] as string;
}

/**
 * Execute a Prisma CLI command
 */
async function executePrismaCommand(
  command: string,
  options: { timeout?: number } = {}
): Promise<{ stdout: string; stderr: string }> {
  const prismaDir = getPrismaDir();
  const schemaPath = join(prismaDir, 'schema.prisma');
  const fullCommand = `npx prisma ${command} --schema="${schemaPath}"`;

  try {
    const result = await execAsync(fullCommand, {
      timeout: options.timeout ?? 120000, // 2 minute default timeout
      env: {
        ...process.env,
        PRISMA_HIDE_UPDATE_MESSAGE: '1',
      },
      cwd: dirname(prismaDir),
    });
    return result;
  } catch (error) {
    const execError = error as ExecException & {
      stdout?: string;
      stderr?: string;
    };
    throw new MigrationError(
      `Prisma command failed: ${command}`,
      execError.stderr ?? execError.message,
      execError.stdout ?? ''
    );
  }
}

/**
 * Custom error class for migration failures
 */
export class MigrationError extends Error {
  constructor(
    message: string,
    public readonly stderr: string,
    public readonly stdout: string
  ) {
    super(message);
    this.name = 'MigrationError';
  }
}

/**
 * Migration status result
 */
export interface MigrationStatus {
  /** Migrations that have not been applied yet */
  pending: string[];
  /** Migrations that have been successfully applied */
  applied: string[];
  /** Migrations that failed to apply */
  failed: string[];
}

/**
 * Run pending Prisma migrations
 *
 * In development: Uses `prisma migrate dev` which creates and applies migrations
 * In production: Uses `prisma migrate deploy` which only applies existing migrations
 *
 * @param options - Migration options
 * @param options.name - Optional name for the migration (dev only)
 * @param options.skipGenerate - Skip running prisma generate after migration
 * @throws {MigrationError} If migration fails
 */
export async function runMigrations(
  options: { name?: string; skipGenerate?: boolean } = {}
): Promise<void> {
  const isDev = process.env.NODE_ENV !== 'production';

  if (isDev) {
    // In development, use migrate dev
    let command = 'migrate dev';
    if (options.name) {
      command += ` --name "${options.name}"`;
    }
    if (options.skipGenerate) {
      command += ' --skip-generate';
    }
    await executePrismaCommand(command);
  } else {
    // In production, use migrate deploy
    await executePrismaCommand('migrate deploy');
  }
}

/**
 * Reset and recreate the database
 *
 * WARNING: This will delete all data in the database!
 * Only use in development environments.
 *
 * @param options - Reset options
 * @param options.force - Skip confirmation prompt
 * @param options.skipSeed - Skip running seed after reset
 * @throws {MigrationError} If reset fails
 * @throws {Error} If called in production
 */
export async function resetDatabase(
  options: { force?: boolean; skipSeed?: boolean } = {}
): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'Database reset is not allowed in production. This operation would delete all data.'
    );
  }

  let command = 'migrate reset';
  if (options.force) {
    command += ' --force';
  }
  if (options.skipSeed) {
    command += ' --skip-seed';
  }

  await executePrismaCommand(command, { timeout: 300000 }); // 5 minute timeout for reset
}

/**
 * Run database seeders
 *
 * Executes the seed script defined in package.json prisma.seed configuration.
 *
 * @throws {MigrationError} If seeding fails
 */
export async function seedDatabase(): Promise<void> {
  await executePrismaCommand('db seed');
}

/**
 * Push schema changes directly to the database
 *
 * This is useful for rapid prototyping but does not create migration files.
 * Use `runMigrations` for production-ready migrations.
 *
 * @param options - Push options
 * @param options.acceptDataLoss - Accept potential data loss from schema changes
 * @param options.skipGenerate - Skip running prisma generate after push
 * @throws {MigrationError} If push fails
 */
export async function pushSchema(
  options: { acceptDataLoss?: boolean; skipGenerate?: boolean } = {}
): Promise<void> {
  let command = 'db push';
  if (options.acceptDataLoss) {
    command += ' --accept-data-loss';
  }
  if (options.skipGenerate) {
    command += ' --skip-generate';
  }

  await executePrismaCommand(command);
}

/**
 * Check the status of database migrations
 *
 * @returns Migration status with pending, applied, and failed migrations
 */
export async function getMigrationStatus(): Promise<MigrationStatus> {
  const status: MigrationStatus = {
    pending: [],
    applied: [],
    failed: [],
  };

  const prismaDir = getPrismaDir();
  const migrationsDir = join(prismaDir, 'migrations');

  // Get list of migration directories from filesystem
  const localMigrations = new Set<string>();
  if (existsSync(migrationsDir)) {
    const entries = readdirSync(migrationsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory() && entry.name !== 'migration_lock.toml') {
        localMigrations.add(entry.name);
      }
    }
  }

  // Try to get migration status from Prisma
  try {
    const { stdout } = await executePrismaCommand('migrate status');

    // Parse the output to determine migration status
    const lines = stdout.split('\n');

    for (const line of lines) {
      // Check for applied migrations
      if (line.includes('applied') || line.includes('Applied')) {
        const match = line.match(/(\d{14}_\w+)/);
        if (match && match[1]) {
          status.applied.push(match[1]);
          localMigrations.delete(match[1]);
        }
      }
      // Check for pending migrations
      if (line.includes('pending') || line.includes('Pending')) {
        const match = line.match(/(\d{14}_\w+)/);
        if (match && match[1]) {
          status.pending.push(match[1]);
          localMigrations.delete(match[1]);
        }
      }
      // Check for failed migrations
      if (line.includes('failed') || line.includes('Failed')) {
        const match = line.match(/(\d{14}_\w+)/);
        if (match && match[1]) {
          status.failed.push(match[1]);
          localMigrations.delete(match[1]);
        }
      }
    }

    // Any remaining local migrations that weren't matched are pending
    for (const migration of localMigrations) {
      if (
        !status.applied.includes(migration) &&
        !status.failed.includes(migration)
      ) {
        status.pending.push(migration);
      }
    }
  } catch (error) {
    // If we can't connect to the database, all local migrations are pending
    for (const migration of localMigrations) {
      status.pending.push(migration);
    }
  }

  // Sort migrations chronologically
  status.pending.sort();
  status.applied.sort();
  status.failed.sort();

  return status;
}

/**
 * Generate Prisma client from schema
 *
 * @throws {MigrationError} If generation fails
 */
export async function generateClient(): Promise<void> {
  await executePrismaCommand('generate');
}

/**
 * Validate the Prisma schema
 *
 * @returns True if schema is valid
 * @throws {MigrationError} If validation fails with details
 */
export async function validateSchema(): Promise<boolean> {
  try {
    await executePrismaCommand('validate');
    return true;
  } catch (error) {
    if (error instanceof MigrationError) {
      throw error;
    }
    return false;
  }
}

/**
 * Format the Prisma schema file
 *
 * @throws {MigrationError} If formatting fails
 */
export async function formatSchema(): Promise<void> {
  await executePrismaCommand('format');
}

/**
 * Create a new migration without applying it
 *
 * @param name - Name of the migration
 * @returns Path to the created migration directory
 * @throws {MigrationError} If migration creation fails
 * @throws {Error} If called in production
 */
export async function createMigration(name: string): Promise<string> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Creating migrations is not allowed in production.');
  }

  const { stdout } = await executePrismaCommand(
    `migrate dev --name "${name}" --create-only`
  );

  // Extract migration path from output
  const match = stdout.match(/migrations[/\\](\d{14}_\w+)/);
  if (match && match[1]) {
    const prismaDir = getPrismaDir();
    return join(prismaDir, 'migrations', match[1]);
  }

  return '';
}

/**
 * Check if there are pending schema changes not yet in a migration
 *
 * @returns True if schema has changes not reflected in migrations
 */
export async function hasPendingSchemaChanges(): Promise<boolean> {
  try {
    const { stdout } = await executePrismaCommand(
      'migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --exit-code'
    );
    return false; // No diff means no pending changes
  } catch {
    return true; // Diff found means pending changes
  }
}
