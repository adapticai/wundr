# CLI Commands Reference

Complete reference for all Wundr command-line interface commands, options, and usage patterns.

## Global Options

These options are available for all commands:

```bash
--config <path>         # Specify configuration file
--verbose, -v           # Enable verbose output
--quiet, -q             # Suppress non-essential output
--help, -h              # Show help information
--version               # Show version information
--no-color              # Disable colored output
```

## Core Commands

### `wundr analyze`

Perform code analysis on your project.

```bash
wundr analyze [path] [options]
```

#### Arguments
- `path` - Directory or file to analyze (default: current directory)

#### Options
```bash
--patterns <patterns>     # File patterns to include (glob)
--ignore <patterns>       # Patterns to ignore
--output, -o <path>       # Output file/directory
--format <format>         # Output format: html, json, pdf, markdown
--rules <rules>           # Analysis rules to apply
--severity <level>        # Minimum severity: low, medium, high, critical
--threshold <score>       # Minimum quality threshold (0-100)
--ci                      # CI mode - exit with error if threshold not met
--watch, -w               # Watch mode - continuous analysis
--diff                    # Analyze only changed files
--cache                   # Enable result caching
--no-cache                # Disable result caching
--parallel <count>        # Number of parallel workers
--memory-limit <size>     # Memory limit (e.g., 1GB, 512MB)
--timeout <seconds>       # Analysis timeout
```

#### Examples

```bash
# Basic analysis
wundr analyze

# Analyze specific directory with custom patterns
wundr analyze ./src --patterns "**/*.{ts,tsx}" --ignore "**/*.test.*"

# Generate multiple output formats
wundr analyze --format html,json,pdf --output ./reports

# CI mode with quality threshold
wundr analyze --ci --threshold 80 --format json

# Watch mode for continuous analysis
wundr analyze --watch --format html

# Analyze only changed files
wundr analyze --diff --base-ref main

# High-performance analysis
wundr analyze --parallel 8 --cache --memory-limit 2GB
```

### `wundr fix`

Automatically fix detected issues where possible.

```bash
wundr fix [options]
```

#### Options
```bash
--auto                    # Apply fixes automatically
--interactive, -i         # Interactive fix mode
--dry-run                 # Preview fixes without applying
--severity <level>        # Fix issues of specified severity
--rules <rules>           # Fix specific rule violations
--backup                  # Create backup before fixing
--no-backup               # Skip backup creation
--confirm                 # Confirm each fix
```

#### Examples

```bash
# Preview fixes
wundr fix --dry-run

# Auto-fix with backup
wundr fix --auto --backup

# Interactive fix mode
wundr fix --interactive

# Fix only high-severity issues
wundr fix --auto --severity high

# Fix specific rules
wundr fix --auto --rules "duplicate-code,complexity"
```

### `wundr duplicates`

Analyze and manage code duplicates.

```bash
wundr duplicates [options]
```

#### Options
```bash
--interactive, -i         # Interactive duplicate resolution
--similarity <threshold>  # Similarity threshold (0.0-1.0)
--min-lines <count>       # Minimum lines for duplicate detection
--merge                   # Auto-merge similar duplicates
--report                  # Generate duplicate report
--format <format>         # Report format
```

#### Examples

```bash
# Find all duplicates
wundr duplicates

# Interactive duplicate resolution
wundr duplicates --interactive

# Find duplicates with custom threshold
wundr duplicates --similarity 0.8 --min-lines 10

# Generate duplicate report
wundr duplicates --report --format html
```

### `wundr dependencies`

Analyze project dependencies and architecture.

```bash
wundr dependencies [options]
```

#### Options
```bash
--circular                # Focus on circular dependencies
--unused                  # Find unused dependencies
--graph                   # Generate dependency graph
--format <format>         # Output format
--max-depth <depth>       # Maximum dependency depth
--include-external        # Include external dependencies
--fix                     # Auto-fix dependency issues
```

#### Examples

```bash
# Analyze all dependencies
wundr dependencies

# Find circular dependencies
wundr dependencies --circular

# Generate visual dependency graph
wundr dependencies --graph --format svg

# Find and fix unused dependencies
wundr dependencies --unused --fix
```

### `wundr issues`

List and manage detected issues.

```bash
wundr issues [options]
```

#### Options
```bash
--severity <level>        # Filter by severity
--category <category>     # Filter by category
--file <pattern>          # Filter by file pattern
--rule <rule>             # Filter by rule
--format <format>         # Output format
--sort <field>            # Sort by: severity, file, category
--limit <count>           # Limit number of results
--export                  # Export to external systems
```

#### Examples

```bash
# List all issues
wundr issues

# High-severity issues only
wundr issues --severity high

# Issues in specific files
wundr issues --file "src/components/**"

# Export issues to JSON
wundr issues --format json --export
```

## Configuration Commands

### `wundr init`

Initialize Wundr configuration in your project.

```bash
wundr init [options]
```

#### Options
```bash
--template <template>     # Use configuration template
--force                   # Overwrite existing configuration
--interactive, -i         # Interactive setup
--preset <preset>         # Use predefined preset
```

#### Examples

```bash
# Interactive initialization
wundr init --interactive

# Use React template
wundr init --template react

# Use TypeScript preset
wundr init --preset typescript
```

### `wundr config`

Manage Wundr configuration.

```bash
wundr config <command> [options]
```

#### Subcommands
```bash
wundr config show                    # Show current configuration
wundr config validate               # Validate configuration
wundr config set <key> <value>      # Set configuration value
wundr config get <key>              # Get configuration value
wundr config reset                  # Reset to defaults
wundr config import <path>          # Import configuration
wundr config export <path>          # Export configuration
```

#### Examples

```bash
# Show current configuration
wundr config show

# Set complexity threshold
wundr config set analysis.complexity.threshold 15

# Validate configuration
wundr config validate
```

## Utility Commands

### `wundr serve`

Start local dashboard server.

```bash
wundr serve [options]
```

#### Options
```bash
--port <port>             # Server port (default: 3000)
--host <host>             # Server host (default: localhost)
--open                    # Open browser automatically
--data <path>             # Path to analysis data
--watch                   # Watch for data changes
```

#### Examples

```bash
# Start dashboard on default port
wundr serve

# Custom port and auto-open browser
wundr serve --port 8080 --open

# Serve specific analysis data
wundr serve --data ./reports/analysis.json
```

### `wundr cache`

Manage analysis cache.

```bash
wundr cache <command>
```

#### Subcommands
```bash
wundr cache clear                    # Clear all cache
wundr cache info                     # Show cache information
wundr cache size                     # Show cache size
wundr cache prune                    # Remove old cache entries
```

### `wundr setup`

Set up Wundr integrations and tools.

```bash
wundr setup [options]
```

#### Options
```bash
--hooks                   # Install Git hooks
--ci                      # Set up CI configuration
--vscode                  # Install VS Code settings
--eslint                  # Configure ESLint integration
--prettier                # Configure Prettier integration
```

#### Examples

```bash
# Install Git hooks
wundr setup --hooks

# Set up CI configuration
wundr setup --ci

# Configure all integrations
wundr setup --hooks --ci --vscode --eslint
```

## Reporting Commands

### `wundr report`

Generate various reports.

```bash
wundr report <type> [options]
```

#### Report Types
```bash
summary                   # Executive summary report
detailed                  # Detailed analysis report
trends                    # Trend analysis over time
comparison               # Compare multiple analyses
team                     # Team performance report
security                 # Security-focused report
```

#### Options
```bash
--format <format>         # Output format
--template <template>     # Report template
--data <path>             # Input data path
--output <path>           # Output path
--period <period>         # Time period for trends
```

#### Examples

```bash
# Generate summary report
wundr report summary --format pdf

# Trend analysis for last month
wundr report trends --period 30d

# Compare two analyses
wundr report comparison --data analysis1.json,analysis2.json
```

## Integration Commands

### `wundr git`

Git integration commands.

```bash
wundr git <command> [options]
```

#### Subcommands
```bash
wundr git hooks install              # Install Git hooks
wundr git hooks uninstall            # Remove Git hooks
wundr git analyze-commit <hash>      # Analyze specific commit
wundr git analyze-pr <number>        # Analyze pull request
wundr git blame-analysis             # Git blame with analysis data
```

### `wundr ci`

CI/CD integration helpers.

```bash
wundr ci <command> [options]
```

#### Subcommands
```bash
wundr ci init <platform>             # Initialize CI configuration
wundr ci validate                    # Validate CI setup
wundr ci report                      # Generate CI-friendly report
```

#### Examples

```bash
# Initialize GitHub Actions
wundr ci init github

# Initialize Jenkins pipeline
wundr ci init jenkins

# Generate CI report
wundr ci report --format json --threshold 75
```

## Advanced Commands

### `wundr benchmark`

Performance benchmarking and testing.

```bash
wundr benchmark [options]
```

#### Options
```bash
--iterations <count>      # Number of benchmark iterations
--profile                 # Enable profiling
--memory                  # Memory usage analysis
--compare <baseline>      # Compare with baseline
```

### `wundr validate`

Validate code against quality standards.

```bash
wundr validate [options]
```

#### Options
```bash
--standards <standard>    # Quality standards to validate
--strict                  # Strict validation mode
--report                  # Generate validation report
```

### `wundr export`

Export analysis data to external systems.

```bash
wundr export <target> [options]
```

#### Targets
```bash
jira                      # Export to Jira
github                    # Export to GitHub Issues
sonarqube                 # Export to SonarQube
csv                       # Export to CSV
database                  # Export to database
```

## Environment Variables

Configure Wundr behavior with environment variables:

```bash
WUNDR_CONFIG_PATH         # Default configuration file path
WUNDR_CACHE_DIR           # Cache directory
WUNDR_LOG_LEVEL           # Logging level: debug, info, warn, error
WUNDR_API_TOKEN           # API token for cloud features
WUNDR_MEMORY_LIMIT        # Default memory limit
WUNDR_PARALLEL_WORKERS    # Default parallel workers
WUNDR_TIMEOUT             # Default timeout
```

## Exit Codes

Wundr uses standard exit codes:

- `0` - Success
- `1` - General error
- `2` - Configuration error
- `3` - Analysis failed
- `4` - Quality threshold not met
- `5` - File not found
- `6` - Permission denied
- `7` - Network error
- `8` - Timeout

## Command Chaining

Chain multiple commands for complex workflows:

```bash
# Analysis pipeline
wundr analyze --format json | wundr report summary | wundr export github

# Fix and re-analyze
wundr fix --auto && wundr analyze --threshold 80
```

## Global Configuration

Set global defaults:

```bash
# Set global configuration
wundr config set --global analysis.complexity.threshold 15
wundr config set --global reporting.format html

# View global configuration
wundr config show --global
```

This completes the CLI commands reference. Each command supports the `--help` option for additional details and examples.