# memory-persist

Persist memory across sessions.

## Usage

```bash
npx ruflo memory persist [options]
```

## Options

- `--export <file>` - Export to file
- `--import <file>` - Import from file
- `--compress` - Compress memory data

## Examples

```bash
# Export memory
npx ruflo memory persist --export memory-backup.json

# Import memory
npx ruflo memory persist --import memory-backup.json

# Compressed export
npx ruflo memory persist --export memory.gz --compress
```
