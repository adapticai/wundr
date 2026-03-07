/**
 * Health Check Client
 *
 * Makes an HTTP request to the daemon's /health endpoint and returns
 * structured health data. Exits 0 for healthy, 1 for unhealthy or unreachable.
 */

import * as http from 'http';

export interface HealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime?: number;
  activeSessions?: number;
  version?: string;
  [key: string]: unknown;
}

export interface HealthCheckResult {
  healthy: boolean;
  statusCode?: number;
  data?: HealthResponse;
  error?: string;
  latencyMs: number;
}

/**
 * Perform a single HTTP health check against the daemon's /health endpoint.
 */
export async function checkHealth(
  host: string,
  port: number,
  timeoutMs: number = 5000
): Promise<HealthCheckResult> {
  const start = Date.now();

  return new Promise(resolve => {
    const req = http.get(
      {
        hostname: host === '0.0.0.0' ? '127.0.0.1' : host,
        port,
        path: '/health',
        timeout: timeoutMs,
        headers: { Accept: 'application/json' },
      },
      res => {
        let body = '';
        res.on('data', chunk => {
          body += chunk;
        });
        res.on('end', () => {
          const latencyMs = Date.now() - start;
          const statusCode = res.statusCode ?? 0;

          if (statusCode < 200 || statusCode >= 300) {
            resolve({
              healthy: false,
              statusCode,
              error: `HTTP ${statusCode}`,
              latencyMs,
            });
            return;
          }

          try {
            const data = JSON.parse(body) as HealthResponse;
            const healthy =
              data.status === 'healthy' || data.status === 'degraded';
            resolve({ healthy, statusCode, data, latencyMs });
          } catch {
            resolve({
              healthy: false,
              statusCode,
              error: `Invalid JSON response: ${body.slice(0, 100)}`,
              latencyMs,
            });
          }
        });
      }
    );

    req.on('timeout', () => {
      req.destroy();
      resolve({
        healthy: false,
        error: `Connection timed out after ${timeoutMs}ms`,
        latencyMs: Date.now() - start,
      });
    });

    req.on('error', err => {
      resolve({
        healthy: false,
        error: err.message,
        latencyMs: Date.now() - start,
      });
    });
  });
}

/**
 * Run a health check with retries and print results to stdout/stderr.
 * Returns the HealthCheckResult from the last attempt.
 */
export async function runHealthCheck(options: {
  host?: string;
  port?: number;
  timeoutMs?: number;
  retries?: number;
  retryDelayMs?: number;
  verbose?: boolean;
  json?: boolean;
}): Promise<HealthCheckResult> {
  const host = options.host ?? '127.0.0.1';
  const port = options.port ?? 8787;
  const timeoutMs = options.timeoutMs ?? 5000;
  const retries = options.retries ?? 3;
  const retryDelayMs = options.retryDelayMs ?? 2000;
  const verbose = options.verbose ?? false;
  const json = options.json ?? false;

  let lastResult: HealthCheckResult = {
    healthy: false,
    error: 'No attempts made',
    latencyMs: 0,
  };

  for (let attempt = 1; attempt <= retries; attempt++) {
    if (attempt > 1) {
      if (!json) {
        process.stderr.write(`Retry ${attempt}/${retries}...\n`);
      }
      await new Promise(r => setTimeout(r, retryDelayMs));
    }

    lastResult = await checkHealth(host, port, timeoutMs);

    if (lastResult.healthy) {
      if (json) {
        process.stdout.write(
          JSON.stringify(
            {
              healthy: true,
              latencyMs: lastResult.latencyMs,
              statusCode: lastResult.statusCode,
              data: lastResult.data,
            },
            null,
            2
          ) + '\n'
        );
      } else {
        process.stdout.write(
          `Health check passed (${lastResult.latencyMs}ms)\n`
        );
        if (verbose && lastResult.data) {
          process.stdout.write(JSON.stringify(lastResult.data, null, 2) + '\n');
        }
      }
      return lastResult;
    }

    if (!json) {
      process.stderr.write(
        `Attempt ${attempt}/${retries} failed: ${lastResult.error ?? `HTTP ${lastResult.statusCode}`}\n`
      );
    }
  }

  // All retries exhausted
  if (json) {
    process.stderr.write(
      JSON.stringify(
        {
          healthy: false,
          error: lastResult.error,
          statusCode: lastResult.statusCode,
          latencyMs: lastResult.latencyMs,
        },
        null,
        2
      ) + '\n'
    );
  } else {
    process.stderr.write(
      `Health check failed after ${retries} attempt(s): ${lastResult.error ?? `HTTP ${lastResult.statusCode}`}\n`
    );
    process.stderr.write(`Endpoint: http://${host}:${port}/health\n`);
  }

  return lastResult;
}

/**
 * CLI entry point — called when this module is run directly.
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);

  const host =
    args.find(a => a.startsWith('--host='))?.split('=')[1] ?? '127.0.0.1';
  const port = parseInt(
    args.find(a => a.startsWith('--port='))?.split('=')[1] ?? '8787',
    10
  );
  const timeout = parseInt(
    args.find(a => a.startsWith('--timeout='))?.split('=')[1] ?? '5000',
    10
  );
  const retries = parseInt(
    args.find(a => a.startsWith('--retries='))?.split('=')[1] ?? '3',
    10
  );
  const verbose = args.includes('--verbose') || args.includes('-v');
  const json = args.includes('--json');

  const result = await runHealthCheck({
    host,
    port,
    timeoutMs: timeout,
    retries,
    verbose,
    json,
  });

  process.exit(result.healthy ? 0 : 1);
}

// Run when invoked directly (not imported as a module)
if (require.main === module) {
  main().catch(err => {
    process.stderr.write(`Unexpected error: ${err.message}\n`);
    process.exit(1);
  });
}
