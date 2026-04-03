# performance-report

Generate comprehensive performance reports for swarm operations.

## Usage

```bash
npx ruflo analysis performance-report [options]
```

## Options

- `--format <type>` - Report format (json, html, markdown)
- `--include-metrics` - Include detailed metrics
- `--compare <id>` - Compare with previous swarm

## Examples

```bash
# Generate HTML report
npx ruflo analysis performance-report --format html

# Compare swarms
npx ruflo analysis performance-report --compare swarm-123

# Full metrics report
npx ruflo analysis performance-report --include-metrics --format markdown
```
