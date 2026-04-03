# workflow-execute

Execute saved workflows.

## Usage

```bash
npx ruflo workflow execute [options]
```

## Options

- `--name <name>` - Workflow name
- `--params <json>` - Workflow parameters
- `--dry-run` - Preview execution

## Examples

```bash
# Execute workflow
npx ruflo workflow execute --name "deploy-api"

# With parameters
npx ruflo workflow execute --name "test-suite" --params '{"env": "staging"}'

# Dry run
npx ruflo workflow execute --name "deploy-api" --dry-run
```
