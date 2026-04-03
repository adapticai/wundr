# smart-spawn

Intelligently spawn agents based on workload analysis.

## Usage

```bash
npx ruflo automation smart-spawn [options]
```

## Options

- `--analyze` - Analyze before spawning
- `--threshold <n>` - Spawn threshold
- `--topology <type>` - Preferred topology

## Examples

```bash
# Smart spawn with analysis
npx ruflo automation smart-spawn --analyze

# Set spawn threshold
npx ruflo automation smart-spawn --threshold 5

# Force topology
npx ruflo automation smart-spawn --topology hierarchical
```
