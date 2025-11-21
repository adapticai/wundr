# Wundr MCP Tools JSON Schemas

This directory contains JSON Schema definitions for all Wundr MCP tools. These schemas can be used for:

- Input validation
- IDE autocompletion
- Documentation generation
- API client generation

## Schema Index

| Schema File | Tool Name | Description |
|-------------|-----------|-------------|
| [drift-detection.schema.json](./drift-detection.schema.json) | `drift_detection` | Detect code drift against baselines |
| [pattern-standardize.schema.json](./pattern-standardize.schema.json) | `pattern_standardize` | Apply code pattern fixes |
| [monorepo-manage.schema.json](./monorepo-manage.schema.json) | `monorepo_manage` | Manage monorepo structure |
| [governance-report.schema.json](./governance-report.schema.json) | `governance_report` | Generate compliance reports |
| [dependency-analyze.schema.json](./dependency-analyze.schema.json) | `dependency_analyze` | Analyze project dependencies |
| [test-baseline.schema.json](./test-baseline.schema.json) | `test_baseline` | Manage test coverage baselines |
| [claude-config.schema.json](./claude-config.schema.json) | `claude_config` | Generate Claude Code configuration |

## Schema Version

All schemas follow JSON Schema Draft-07 specification.

**Base URI**: `https://wundr.dev/schemas/mcp-tools/`

## Usage

### Validation with ajv

```javascript
const Ajv = require('ajv');
const ajv = new Ajv();

const schema = require('./drift-detection.schema.json');
const validate = ajv.compile(schema);

const input = {
  action: 'detect',
  baselineVersion: 'main-abc123'
};

if (validate(input)) {
  console.log('Valid input');
} else {
  console.log('Invalid:', validate.errors);
}
```

### TypeScript Types Generation

```bash
# Using json-schema-to-typescript
npx json-schema-to-typescript schemas/*.json -o types/
```

### IDE Integration

Add to your `.vscode/settings.json`:

```json
{
  "json.schemas": [
    {
      "fileMatch": ["**/wundr-*.json"],
      "url": "./packages/@wundr/mcp-server/docs/schemas/drift-detection.schema.json"
    }
  ]
}
```

## Schema Structure

Each schema includes:

1. **Input Schema** - Properties required for tool invocation
2. **Response Definitions** - Expected output structures
3. **Examples** - Sample inputs for testing

### Common Properties

All tools share these response properties:

```json
{
  "success": true,
  "action": "action-name",
  "message": "Human-readable result message"
}
```

## Validation Examples

### drift_detection

```json
// Valid inputs
{ "action": "create-baseline" }
{ "action": "detect" }
{ "action": "detect", "baselineVersion": "release-1.0-abc123" }
{ "action": "list-baselines" }
{ "action": "trends" }

// Invalid inputs
{ "action": "invalid" }  // Unknown action
{ "baselineVersion": "abc" }  // Missing required action
```

### pattern_standardize

```json
// Valid inputs
{ "action": "run" }
{ "action": "run", "dryRun": true }
{ "action": "run", "rules": ["import-ordering"] }
{ "action": "review" }
{ "action": "check" }

// Invalid inputs
{ "action": "run", "rules": ["unknown-rule"] }  // Invalid rule
```

### monorepo_manage

```json
// Valid inputs
{ "action": "init" }
{ "action": "add-package", "packageName": "auth-utils" }
{ "action": "add-package", "packageName": "dashboard", "packageType": "app" }
{ "action": "check-deps" }

// Invalid inputs
{ "action": "add-package" }  // Missing required packageName
{ "action": "plan" }  // Missing required analysisReport
```

### governance_report

```json
// Valid inputs
{ "reportType": "weekly" }
{ "reportType": "compliance", "format": "json" }
{ "reportType": "quality", "period": "30d" }

// Invalid inputs
{ "reportType": "invalid" }  // Unknown report type
{ "format": "json" }  // Missing required reportType
```

### dependency_analyze

```json
// Valid inputs
{ "scope": "all" }
{ "scope": "circular", "target": "src" }
{ "scope": "unused" }
{ "scope": "external" }
{ "scope": "all", "outputFormat": "graph" }

// Invalid inputs
{ "scope": "invalid" }  // Unknown scope
```

### test_baseline

```json
// Valid inputs
{ "action": "create" }
{ "action": "create", "testType": "unit", "threshold": 90 }
{ "action": "compare", "testType": "all" }
{ "action": "update" }

// Invalid inputs
{ "action": "create", "threshold": 150 }  // Threshold > 100
```

### claude_config

```json
// Valid inputs
{ "configType": "all" }
{ "configType": "claude-md", "features": ["governance"] }
{ "configType": "hooks", "features": ["auto-governance"] }
{ "configType": "conventions", "features": ["strict-mode"] }

// Invalid inputs
{ "configType": "invalid" }  // Unknown config type
```

## Contributing

When adding new tools or modifying existing ones:

1. Update the corresponding schema file
2. Add examples to the schema
3. Update this README
4. Run validation tests

---

*Wundr MCP Tools Schemas v1.0.0*
