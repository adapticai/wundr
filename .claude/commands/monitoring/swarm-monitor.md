# swarm-monitor

Real-time swarm monitoring.

## Usage

```bash
npx ruflo swarm monitor [options]
```

## Options

- `--interval <ms>` - Update interval
- `--metrics` - Show detailed metrics
- `--export` - Export monitoring data

## Examples

```bash
# Start monitoring
npx ruflo swarm monitor

# Custom interval
npx ruflo swarm monitor --interval 5000

# With metrics
npx ruflo swarm monitor --metrics
```
