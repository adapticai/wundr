# neural-train

Train neural patterns from operations.

## Usage

```bash
npx ruflo training neural-train [options]
```

## Options

- `--data <source>` - Training data source
- `--model <name>` - Target model
- `--epochs <n>` - Training epochs

## Examples

```bash
# Train from recent ops
npx ruflo training neural-train --data recent

# Specific model
npx ruflo training neural-train --model task-predictor

# Custom epochs
npx ruflo training neural-train --epochs 100
```
