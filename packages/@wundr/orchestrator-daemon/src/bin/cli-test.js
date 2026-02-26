#!/usr/bin/env node

/**
 * Standalone CLI test to verify argument parsing and help
 */

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    port: 8787,
    host: '127.0.0.1',
    verbose: false,
    maxSessions: 100,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case '--help':
      case '-h':
        return 'help';

      case '--port':
      case '-p':
        if (i + 1 >= args.length) {
          console.error('Error: --port requires a value');
          process.exit(1);
        }
        const port = parseInt(args[++i], 10);
        if (isNaN(port) || port < 1 || port > 65535) {
          console.error('Error: Invalid port number');
          process.exit(1);
        }
        options.port = port;
        break;

      case '--host':
        if (i + 1 >= args.length) {
          console.error('Error: --host requires a value');
          process.exit(1);
        }
        options.host = args[++i];
        break;

      case '--verbose':
      case '-v':
        options.verbose = true;
        break;

      case '--config':
      case '-c':
        if (i + 1 >= args.length) {
          console.error('Error: --config requires a file path');
          process.exit(1);
        }
        options.config = args[++i];
        break;

      case '--max-sessions':
        if (i + 1 >= args.length) {
          console.error('Error: --max-sessions requires a value');
          process.exit(1);
        }
        const maxSessions = parseInt(args[++i], 10);
        if (isNaN(maxSessions) || maxSessions < 1) {
          console.error('Error: Invalid max-sessions value');
          process.exit(1);
        }
        options.maxSessions = maxSessions;
        break;

      default:
        console.error(`Error: Unknown option: ${arg}`);
        return 'help';
    }
  }

  return options;
}

function showHelp() {
  console.log(`
Orchestrator Daemon - Agent orchestration and session management

USAGE:
  orchestrator-daemon [OPTIONS]

OPTIONS:
  -p, --port <number>          Server port (default: 8787)
  -h, --host <string>          Server host (default: 127.0.0.1)
  -v, --verbose                Enable verbose logging
  -c, --config <path>          Path to config file (JSON)
      --max-sessions <number>  Maximum concurrent sessions (default: 100)
      --help                   Show this help message

ENVIRONMENT VARIABLES:
  ORCHESTRATOR_DAEMON_PORT     Server port
  ORCHESTRATOR_DAEMON_HOST     Server host
  ORCHESTRATOR_MAX_SESSIONS    Maximum sessions
  ORCHESTRATOR_VERBOSE         Enable verbose mode (true/false)

EXAMPLES:
  # Start with default settings
  orchestrator-daemon

  # Start on custom port
  orchestrator-daemon --port 9090

  # Start with verbose logging
  orchestrator-daemon --verbose

  # Load from config file
  orchestrator-daemon --config ./config.json

  # Override all settings
  orchestrator-daemon -p 9090 -h 0.0.0.0 -v --max-sessions 200

For more information, visit: https://wundr.io
`);
}

function printBanner(config) {
  const border = '═'.repeat(60);
  console.log(`\n╔${border}╗`);
  console.log(
    '║' + ' '.repeat(15) + 'ORCHESTRATOR DAEMON' + ' '.repeat(26) + '║'
  );
  console.log(`╠${border}╣`);
  console.log(`║  Version: 1.0.6${' '.repeat(43)}║`);
  console.log(
    `║  Host: ${config.host}${' '.repeat(60 - 9 - config.host.length)}║`
  );
  console.log(
    `║  Port: ${config.port}${' '.repeat(60 - 9 - config.port.toString().length)}║`
  );
  console.log(
    `║  Max Sessions: ${config.maxSessions}${' '.repeat(60 - 17 - config.maxSessions.toString().length)}║`
  );
  console.log(
    `║  Verbose: ${config.verbose ? 'enabled' : 'disabled'}${' '.repeat(60 - 12 - (config.verbose ? 7 : 8))}║`
  );
  console.log(`╚${border}╝\n`);
}

// Test the CLI
const result = parseArgs();

if (result === 'help') {
  showHelp();
} else {
  console.log('✓ CLI parsing successful!\n');
  printBanner(result);
  console.log('Parsed configuration:');
  console.log(JSON.stringify(result, null, 2));
}
