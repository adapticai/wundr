# Orchestrator Daemon CLI

Command-line interface for the Orchestrator Daemon with proper argument parsing, configuration validation, and graceful shutdown handling.

## Installation

```bash
npm install -g @wundr.io/orchestrator-daemon
```

## Usage

```bash
orchestrator-daemon [OPTIONS]
```

## Command-Line Options

| Option | Short | Description | Default |
|--------|-------|-------------|---------|
| `--port` | `-p` | Server port | `8787` |
| `--host` | `-h` | Server host | `127.0.0.1` |
| `--verbose` | `-v` | Enable verbose logging | `false` |
| `--config` | `-c` | Path to config file (JSON) | - |
| `--max-sessions` | - | Maximum concurrent sessions | `100` |
| `--help` | - | Show help message | - |

## Environment Variables

The daemon supports the following environment variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `ORCHESTRATOR_DAEMON_PORT` | Server port | `8787` |
| `ORCHESTRATOR_DAEMON_HOST` | Server host | `127.0.0.1` |
| `ORCHESTRATOR_MAX_SESSIONS` | Maximum sessions | `100` |
| `ORCHESTRATOR_VERBOSE` | Enable verbose mode | `false` |

### Loading Environment Variables

Create a `.env` file in your project directory:

```bash
# Copy the example file
cp node_modules/@wundr.io/orchestrator-daemon/.env.example .env

# Edit with your values
nano .env
```

The CLI automatically loads `.env` files from the current working directory.

## Configuration File

You can use a JSON configuration file for more complex setups:

```json
{
  "name": "orchestrator-daemon",
  "port": 8787,
  "host": "127.0.0.1",
  "maxSessions": 100,
  "heartbeatInterval": 30000,
  "shutdownTimeout": 10000,
  "verbose": false
}
```

Load it with:

```bash
orchestrator-daemon --config ./config.json
```

### Configuration Priority

Configuration is merged in the following order (higher priority overwrites lower):

1. Default values (lowest priority)
2. Config file (if provided)
3. Environment variables
4. Command-line arguments (highest priority)

## Examples

### Start with Default Settings

```bash
orchestrator-daemon
```

Output:
```
╔════════════════════════════════════════════════════════════╗
║               ORCHESTRATOR DAEMON                          ║
╠════════════════════════════════════════════════════════════╣
║  Version: 1.0.6                                           ║
║  Host: 127.0.0.1                                          ║
║  Port: 8787                                               ║
║  Max Sessions: 100                                        ║
║  Verbose: disabled                                        ║
╚════════════════════════════════════════════════════════════╝

✓ Orchestrator Daemon is running
  Press Ctrl+C to stop
```

### Start on Custom Port

```bash
orchestrator-daemon --port 9090
```

### Start with Verbose Logging

```bash
orchestrator-daemon --verbose
```

or using short form:

```bash
orchestrator-daemon -v
```

### Load from Config File

```bash
orchestrator-daemon --config ./config.json
```

### Override All Settings

```bash
orchestrator-daemon -p 9090 -h 0.0.0.0 -v --max-sessions 200
```

### Production Deployment

```bash
# Accept connections from any interface
orchestrator-daemon --host 0.0.0.0 --port 8787 --max-sessions 500
```

### Development with Verbose Logging

```bash
orchestrator-daemon -v -p 8080
```

## Graceful Shutdown

The daemon handles shutdown signals gracefully:

- **SIGTERM**: Graceful shutdown (stops accepting new sessions, completes active ones)
- **SIGINT** (Ctrl+C): Graceful shutdown
- **Second signal**: Force shutdown

Shutdown process:

1. Stop accepting new WebSocket connections
2. Stop all active sessions
3. Close WebSocket server
4. Exit with code 0 (success) or 1 (error)

Shutdown timeout can be configured:

```json
{
  "shutdownTimeout": 10000
}
```

or via CLI (requires config file):

```bash
orchestrator-daemon --config ./config.json
```

## Validation

The CLI validates all configuration before starting:

- Port must be between 1 and 65535
- Host must not be empty
- Max sessions must be at least 1
- Heartbeat interval must be at least 1000ms
- Shutdown timeout must be non-negative

Invalid configuration will print an error and exit with code 1.

## Error Handling

The daemon handles the following error scenarios:

- **Module not found**: Displays helpful message to run `npm run build`
- **Invalid arguments**: Shows error and help message
- **Configuration errors**: Displays validation errors
- **Startup failure**: Prints error and exits with code 1
- **Uncaught exceptions**: Triggers graceful shutdown
- **Unhandled rejections**: Triggers graceful shutdown

## Development

### Running from Source

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Run the CLI
npm start
```

or for development with auto-rebuild:

```bash
# Watch mode
npm run dev

# In another terminal
node bin/orchestrator-daemon.js
```

### Using ts-node (Development)

If TypeScript is not compiled, the CLI will attempt to use `ts-node`:

```bash
# Install ts-node
npm install --save-dev ts-node

# Run directly
node bin/orchestrator-daemon.js
```

## WebSocket Server

Once started, the daemon exposes a WebSocket server at:

```
ws://<host>:<port>
```

Example: `ws://127.0.0.1:8787`

### Testing the Connection

```bash
# Using wscat
npm install -g wscat
wscat -c ws://127.0.0.1:8787

# Or using websocat
websocat ws://127.0.0.1:8787
```

## Health Checks

The daemon performs periodic health checks (default: every 30 seconds) and logs system status when verbose mode is enabled.

## Troubleshooting

### "CLI not built" Error

```bash
npm run build
```

### Port Already in Use

```bash
# Use a different port
orchestrator-daemon --port 8788
```

### Module Not Found

```bash
# Reinstall dependencies
rm -rf node_modules
npm install
npm run build
```

### Permission Denied

```bash
# Make the bin file executable
chmod +x bin/orchestrator-daemon.js
```

## License

MIT

## Support

For issues and questions:
- GitHub: https://github.com/adapticai/wundr
- Documentation: https://wundr.io
