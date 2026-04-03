# parallel-execute

Execute tasks in parallel for maximum efficiency.

## Usage

```bash
npx ruflo optimization parallel-execute [options]
```

## Options

- `--tasks <file>` - Task list file
- `--max-parallel <n>` - Maximum parallel tasks
- `--strategy <type>` - Execution strategy

## Examples

```bash
# Execute task list
npx ruflo optimization parallel-execute --tasks tasks.json

# Limit parallelism
npx ruflo optimization parallel-execute --tasks tasks.json --max-parallel 5

# Custom strategy
npx ruflo optimization parallel-execute --strategy adaptive
```
