# workflow-create

Create reusable workflow templates.

## Usage

```bash
npx ruflo workflow create [options]
```

## Options

- `--name <name>` - Workflow name
- `--from-history` - Create from history
- `--interactive` - Interactive creation

## Examples

```bash
# Create workflow
npx ruflo workflow create --name "deploy-api"

# From history
npx ruflo workflow create --name "test-suite" --from-history

# Interactive mode
npx ruflo workflow create --interactive
```
