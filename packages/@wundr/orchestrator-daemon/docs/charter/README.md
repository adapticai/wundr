# Orchestrator Charter

The Orchestrator Charter defines the identity, capabilities, responsibilities, resource limits, and operational settings for an orchestrator instance.

## Overview

A charter is a YAML configuration file that governs how an orchestrator behaves. It includes:

- **Identity**: Name, description, and personality
- **Capabilities**: What the orchestrator can do
- **Responsibilities**: What the orchestrator should manage
- **Resource Limits**: Constraints on sessions, tokens, and concurrent tasks
- **Safety Heuristics**: Rules for auto-approval, confirmation, rejection, and escalation
- **Operational Settings**: Model configuration, temperature, retries, and timeouts

## Usage

### Loading a Charter

```typescript
import { loadCharter, loadCharterFromFile, getDefaultCharter } from '@wundr.io/orchestrator-daemon/charter';

// Load with defaults
const charter = await loadCharter();

// Load from file with environment overrides
const charter = await loadCharter('./my-charter.yaml');

// Load from file without environment overrides
const charter = await loadCharter('./my-charter.yaml', { useEnvOverrides: false });

// Load and validate a complete charter file
const charter = await loadCharterFromFile('./complete-charter.yaml');

// Get the default charter
const defaultCharter = getDefaultCharter();
```

### Creating a Charter

```typescript
import { saveCharter } from '@wundr.io/orchestrator-daemon/charter';

const charter = {
  name: 'my-orchestrator',
  role: 'Tier1-Orchestrator',
  tier: 1,
  identity: {
    name: 'My Custom Orchestrator',
    description: 'A specialized orchestrator for my use case',
    personality: 'Efficient and detail-oriented',
  },
  capabilities: ['task_analysis', 'code_review'],
  responsibilities: ['triage_requests', 'manage_session_lifecycle'],
  resourceLimits: {
    maxSessions: 5,
    maxTokensPerSession: 50000,
    maxConcurrentTasks: 3,
    tokenBudget: {
      hourly: 250000,
      daily: 2500000,
    },
  },
  safetyHeuristics: {
    autoApprove: ['Read file operations'],
    requireConfirmation: ['File modifications'],
    alwaysReject: ['rm -rf /'],
    escalate: ['Production deployments'],
  },
  operationalSettings: {
    defaultModel: 'gpt-4o-mini',
    temperature: 0.7,
    maxRetries: 3,
    timeoutMs: 300000,
  },
};

await saveCharter(charter, './my-charter.yaml');
```

## Charter File Format

### Complete Charter

```yaml
name: orchestrator-supervisor
role: Tier1-Orchestrator
tier: 1

identity:
  name: "Wundr Orchestrator"
  description: "AI orchestrator for managing development tasks and workflows"
  personality: "Professional, efficient, and helpful"

capabilities:
  - task_analysis
  - code_review
  - file_operations
  - bash_execution
  - web_research
  - documentation

responsibilities:
  - triage_requests
  - manage_session_lifecycle
  - allocate_token_budget
  - coordinate_subagents

resourceLimits:
  maxSessions: 10
  maxTokensPerSession: 100000
  maxConcurrentTasks: 5
  tokenBudget:
    hourly: 500000
    daily: 5000000

safetyHeuristics:
  autoApprove:
    - "Read file operations"
    - "Code analysis"
    - "Documentation generation"
  requireConfirmation:
    - "File modifications"
    - "Database operations"
  alwaysReject:
    - "rm -rf /"
    - "Destructive operations without backup"
  escalate:
    - "Production deployments"
    - "Security-sensitive operations"

operationalSettings:
  defaultModel: "gpt-4o-mini"
  temperature: 0.7
  maxRetries: 3
  timeoutMs: 300000
```

### Partial Charter (Overrides)

You can create partial charter files that override only specific values:

```yaml
# custom-charter.yaml
name: my-custom-orchestrator
tier: 2
resourceLimits:
  maxSessions: 20
operationalSettings:
  defaultModel: "gpt-4o"
```

When loaded with `loadCharter('./custom-charter.yaml')`, this will merge with the defaults, keeping all other values.

## Environment Variable Overrides

The charter loader supports environment variable overrides for common settings:

| Environment Variable | Charter Field | Type |
|---------------------|---------------|------|
| `ORCHESTRATOR_NAME` | `name` | string |
| `ORCHESTRATOR_TIER` | `tier` | number (1-3) |
| `ORCHESTRATOR_MAX_SESSIONS` | `resourceLimits.maxSessions` | number |
| `ORCHESTRATOR_MAX_TOKENS` | `resourceLimits.maxTokensPerSession` | number |
| `ORCHESTRATOR_MAX_CONCURRENT` | `resourceLimits.maxConcurrentTasks` | number |
| `ORCHESTRATOR_MODEL` | `operationalSettings.defaultModel` | string |
| `ORCHESTRATOR_TEMPERATURE` | `operationalSettings.temperature` | number (0-2) |
| `ORCHESTRATOR_TIMEOUT_MS` | `operationalSettings.timeoutMs` | number |

### Example

```bash
export ORCHESTRATOR_NAME="production-orchestrator"
export ORCHESTRATOR_TIER="3"
export ORCHESTRATOR_MAX_SESSIONS="50"
export ORCHESTRATOR_MODEL="gpt-4o"

# These will override the file values
const charter = await loadCharter('./my-charter.yaml');
```

To disable environment overrides:

```typescript
const charter = await loadCharter('./my-charter.yaml', { useEnvOverrides: false });
```

## Charter Tiers

Orchestrators are organized into three tiers:

- **Tier 1**: Top-level orchestrators that coordinate other orchestrators
- **Tier 2**: Mid-level orchestrators that manage specific domains or tasks
- **Tier 3**: Low-level orchestrators that execute specific operations

## Validation

All charters are validated using Zod schemas. The loader will:

1. Load the file as partial configuration
2. Merge with defaults
3. Apply environment overrides (if enabled)
4. Validate the complete charter
5. Throw an error if validation fails

### Validation Example

```typescript
import { validateCharter } from '@wundr.io/orchestrator-daemon/charter';

try {
  const charter = validateCharter(someObject);
  console.log('Charter is valid');
} catch (error) {
  console.error('Charter validation failed:', error.message);
}
```

## Default Template

A default charter template is available at:
```
packages/@wundr/orchestrator-daemon/templates/orchestrator-charter.yaml
```

You can copy this template as a starting point for your custom charters.

## Best Practices

1. **Start with defaults**: Use the default charter and override only what you need
2. **Use partial files**: Keep charter files minimal by only specifying overrides
3. **Environment overrides**: Use environment variables for deployment-specific settings
4. **Validate early**: Always validate charters before using them
5. **Version control**: Keep charter files in version control
6. **Document changes**: Add comments to charter files explaining customizations
7. **Test charters**: Test charter configurations in development before production

## API Reference

### Functions

#### `loadCharter(filePath?, options?): Promise<Charter>`

Load a charter with defaults, file overrides, and environment overrides.

**Parameters:**
- `filePath` (optional): Path to charter YAML file
- `options.useEnvOverrides` (optional): Enable environment variable overrides (default: true)

**Returns:** A validated `Charter` object

#### `loadCharterFromFile(filePath): Promise<Charter>`

Load and validate a complete charter from a file.

**Parameters:**
- `filePath`: Path to charter YAML file

**Returns:** A validated `Charter` object

#### `getDefaultCharter(): Charter`

Get the default charter configuration.

**Returns:** A copy of the default `Charter` object

#### `validateCharter(charter): Charter`

Validate a charter object against the schema.

**Parameters:**
- `charter`: Charter object to validate

**Returns:** The validated `Charter` object

**Throws:** Error if validation fails

#### `saveCharter(charter, filePath): Promise<void>`

Save a charter to a YAML file.

**Parameters:**
- `charter`: Charter object to save
- `filePath`: Path where the charter should be saved

## Types

See [`src/charter/types.ts`](../../src/charter/types.ts) for complete type definitions.

### Main Types

- `Charter`: Complete charter configuration
- `CharterIdentity`: Orchestrator identity information
- `CharterResourceLimits`: Resource constraints
- `CharterSafetyHeuristics`: Safety rules and policies
- `CharterOperationalSettings`: Runtime configuration
