# memory-search

Search through stored memory.

## Usage

```bash
npx ruflo memory search [options]
```

## Options

- `--query <text>` - Search query
- `--pattern <regex>` - Pattern matching
- `--limit <n>` - Result limit

## Examples

```bash
# Search memory
npx ruflo memory search --query "authentication"

# Pattern search
npx ruflo memory search --pattern "api-.*"

# Limited results
npx ruflo memory search --query "config" --limit 10
```
