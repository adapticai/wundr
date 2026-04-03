# agent-metrics

View agent performance metrics.

## Usage

```bash
npx ruflo agent metrics [options]
```

## Options

- `--agent-id <id>` - Specific agent
- `--period <time>` - Time period
- `--format <type>` - Output format

## Examples

```bash
# All agents metrics
npx ruflo agent metrics

# Specific agent
npx ruflo agent metrics --agent-id agent-001

# Last hour
npx ruflo agent metrics --period 1h
```
