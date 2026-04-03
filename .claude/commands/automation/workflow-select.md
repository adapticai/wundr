# workflow-select

Automatically select optimal workflow based on task type.

## Usage

```bash
npx ruflo automation workflow-select [options]
```

## Options

- `--task <description>` - Task description
- `--constraints <list>` - Workflow constraints
- `--preview` - Preview without executing

## Examples

```bash
# Select workflow for task
npx ruflo automation workflow-select --task "Deploy to production"

# With constraints
npx ruflo automation workflow-select --constraints "no-downtime,rollback"

# Preview mode
npx ruflo automation workflow-select --task "Database migration" --preview
```
