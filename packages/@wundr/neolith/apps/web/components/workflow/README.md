# Workflow Components

Comprehensive React components for workflow automation including variable management, templates, and
version control with full TypeScript support.

## Overview

This module provides a complete solution for building and managing workflow automation systems:

- **Variable Management**: Define and use variables across workflows
- **Template System**: Pre-built workflow templates for common use cases
- **Version Control**: Track, compare, and manage workflow versions with branching

## Components

### 1. VariableManager

The main component for defining and managing workflow variables.

**Features:**

- Create, edit, and delete variables
- Support for multiple variable types (string, number, boolean, array, object)
- Global and step-scoped variables
- Default value configuration
- Variable validation
- Expandable/collapsible sections
- Visual reference preview

**Usage:**

```tsx
import { VariableManager } from '@/components/workflow';

function WorkflowEditor() {
  const [variables, setVariables] = useState<ScopedWorkflowVariable[]>([]);
  const [steps] = useState([
    { id: 'step1', name: 'Send Message' },
    { id: 'step2', name: 'Create Channel' },
  ]);

  return (
    <VariableManager
      variables={variables}
      onVariablesChange={setVariables}
      availableSteps={steps}
    />
  );
}
```

### 2. VariablePicker

A dropdown component for selecting variables in step configurations.

**Features:**

- Searchable variable list
- Grouped by scope (global/step)
- Type badges and descriptions
- Filtered by current step context
- Visual type indicators

**Usage:**

```tsx
import { VariablePicker } from '@/components/workflow';

function StepConfig() {
  const [selectedVar, setSelectedVar] = useState('');

  return (
    <VariablePicker
      variables={variables}
      currentStepId='step1'
      value={selectedVar}
      onSelect={ref => setSelectedVar(ref)}
      placeholder='Select a variable'
    />
  );
}
```

### 3. VariableInput

An enhanced input component that combines text input with variable insertion.

**Features:**

- Text input with variable reference support
- Insert variables at cursor position
- Display used variables with badges
- Detect undefined variable references
- Support for multiline text
- Real-time validation

**Usage:**

```tsx
import { VariableInput } from '@/components/workflow';

function MessageConfig() {
  const [message, setMessage] = useState('');

  return (
    <VariableInput
      value={message}
      onChange={setMessage}
      variables={variables}
      currentStepId='step1'
      placeholder='Enter message...'
      multiline
    />
  );
}
```

## Variable Types

### Supported Types

| Type      | Description       | Example Default Value |
| --------- | ----------------- | --------------------- |
| `string`  | Text values       | `"Hello World"`       |
| `number`  | Numeric values    | `42`                  |
| `boolean` | True/false values | `true`                |
| `array`   | JSON arrays       | `[1, 2, 3]`           |
| `object`  | JSON objects      | `{"key": "value"}`    |

### Variable Scopes

#### Global Variables

- Available in all workflow steps
- Defined at workflow level
- Can be referenced anywhere

#### Step-Scoped Variables

- Available only in specific steps
- Defined per step
- Useful for step-specific configuration

## Variable Reference Syntax

Variables are referenced using the template syntax:

```
${variable.variableName}
```

**Examples:**

```typescript
// Simple string interpolation
'Welcome ${variable.userName}!';

// In JSON
'{"name": "${variable.userName}", "email": "${variable.userEmail}"}';

// Multiple variables
'Hello ${variable.firstName} ${variable.lastName}';

// In URLs
'https://api.example.com/users/${variable.userId}';
```

## Validation

### Variable Name Validation

- Must start with letter or underscore
- Can contain letters, numbers, underscores
- Cannot be reserved keywords (trigger, action, workflow, etc.)
- Maximum 64 characters
- Must be unique

**Valid names:**

- `userName`
- `user_email`
- `_privateVar`
- `config123`

**Invalid names:**

- `123user` (starts with number)
- `user-name` (contains hyphen)
- `trigger` (reserved keyword)

### Default Value Validation

Values are validated based on type:

```typescript
// String - any text
"hello"

// Number - must be valid finite number
42
3.14

// Boolean - must be "true" or "false"
true
false

// Array - must be valid JSON array
[1, 2, 3]
["a", "b", "c"]

// Object - must be valid JSON object
{"key": "value"}
{"nested": {"data": true}}
```

### Reference Validation

The system validates that:

- Referenced variables are defined
- Variable names match exactly
- No circular references exist
- Types are compatible (where applicable)

## Validation Utilities

### validateVariableName

Validates variable name format and uniqueness.

```typescript
import { validateVariableName } from '@/components/workflow';

const error = validateVariableName('userName', ['existingVar']);
// Returns: null if valid, error message if invalid
```

### validateVariable

Validates a complete variable definition.

```typescript
import { validateVariable } from '@/components/workflow';

const result = validateVariable(variable, existingVariables);
// Returns: { isValid: boolean, errors: ValidationError[] }
```

### validateVariableReferences

Validates variable references in text.

```typescript
import { validateVariableReferences } from '@/components/workflow';

const result = validateVariableReferences('Hello ${variable.userName}', availableVariables);
// Returns: { isValid: boolean, errors: ValidationError[] }
```

### extractVariableReferences

Extracts all variable references from text.

```typescript
import { extractVariableReferences } from '@/components/workflow';

const refs = extractVariableReferences('${variable.a} and ${variable.b}');
// Returns: ['a', 'b']
```

### replaceVariableReferences

Replaces variable references with actual values (for preview).

```typescript
import { replaceVariableReferences } from '@/components/workflow';

const preview = replaceVariableReferences('Hello ${variable.userName}', { userName: 'John' });
// Returns: 'Hello John'
```

## Type Definitions

### ScopedWorkflowVariable

```typescript
interface ScopedWorkflowVariable {
  id: string;
  name: string;
  type: VariableType; // 'string' | 'number' | 'boolean' | 'array' | 'object'
  description?: string;
  defaultValue?: string | number | boolean | unknown[] | Record<string, unknown>;
  scope: 'global' | 'step';
  stepId?: string; // Required for step-scoped variables
}
```

### VariableValidationResult

```typescript
interface VariableValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

interface ValidationError {
  field: string;
  message: string;
}
```

## Best Practices

### 1. Use Descriptive Names

```typescript
// Good
userName;
userEmail;
welcomeDelay;

// Avoid
u;
e;
d;
```

### 2. Add Descriptions

```typescript
{
  name: 'userName',
  type: 'string',
  description: 'Name of the user joining the workspace',
  // ...
}
```

### 3. Provide Default Values

```typescript
{
  name: 'welcomeDelay',
  type: 'number',
  defaultValue: 5,
  description: 'Delay in seconds before sending welcome message',
  // ...
}
```

### 4. Use Appropriate Scopes

```typescript
// Global for workflow-wide data
{
  name: 'workspaceName',
  scope: 'global',
}

// Step-scoped for step-specific data
{
  name: 'channelId',
  scope: 'step',
  stepId: 'step1',
}
```

### 5. Validate Before Use

```typescript
// Always validate variable references
const validation = validateVariableReferences(config.message, variables);
if (!validation.isValid) {
  console.error('Invalid variables:', validation.errors);
}
```

## Integration Example

Complete example of integrating variable management into a workflow editor:

```tsx
import { useState } from 'react';
import {
  VariableManager,
  VariableInput,
  validateWorkflowVariables,
  type ScopedWorkflowVariable,
} from '@/components/workflow';

function WorkflowEditor() {
  const [variables, setVariables] = useState<ScopedWorkflowVariable[]>([]);
  const [stepConfig, setStepConfig] = useState({
    message: '',
    channelId: '',
  });

  const steps = [
    { id: 'step1', name: 'Send Message' },
    { id: 'step2', name: 'Create Channel' },
  ];

  const handleSave = () => {
    // Validate variables
    const validation = validateWorkflowVariables(variables);
    if (!validation.isValid) {
      alert('Invalid variables');
      return;
    }

    // Save workflow with variables
    const workflow = {
      variables,
      steps: [
        {
          id: 'step1',
          config: stepConfig,
        },
      ],
    };

    console.log('Saving workflow:', workflow);
  };

  return (
    <div className='space-y-6'>
      {/* Variable Management */}
      <section>
        <h2>Variables</h2>
        <VariableManager
          variables={variables}
          onVariablesChange={setVariables}
          availableSteps={steps}
        />
      </section>

      {/* Step Configuration */}
      <section>
        <h2>Step 1: Send Message</h2>
        <div className='space-y-4'>
          <div>
            <label>Message</label>
            <VariableInput
              value={stepConfig.message}
              onChange={value => setStepConfig({ ...stepConfig, message: value })}
              variables={variables}
              currentStepId='step1'
              multiline
            />
          </div>
          <div>
            <label>Channel ID</label>
            <VariableInput
              value={stepConfig.channelId}
              onChange={value => setStepConfig({ ...stepConfig, channelId: value })}
              variables={variables}
              currentStepId='step1'
            />
          </div>
        </div>
      </section>

      <button onClick={handleSave}>Save Workflow</button>
    </div>
  );
}
```

## Demo Component

A comprehensive demo is available in `variable-manager-demo.tsx` showing:

- Variable management UI
- Variable usage in steps
- Preview and testing
- Validation examples

To use the demo:

```tsx
import { VariableManagerDemo } from '@/components/workflow/variable-manager-demo';

function DemoPage() {
  return <VariableManagerDemo />;
}
```

## Styling

Components use shadcn/ui design system with Tailwind CSS. All components support:

- Dark mode
- Custom className props
- Responsive design
- Accessibility features

## Accessibility

Components follow WCAG guidelines:

- Keyboard navigation
- Screen reader support
- Focus management
- ARIA labels
- Error announcements

## Performance

Optimizations include:

- React.useMemo for expensive computations
- Efficient filtering and grouping
- Debounced search inputs
- Virtual scrolling for large lists (future)

## Version Control Components

### 1. VersionHistory

Timeline-based version history with comprehensive change tracking and management.

**Features:**

- Timeline view of all workflow versions
- Version comparison (side-by-side diff)
- Restore to previous versions
- Version notes and annotations
- Draft vs Published states
- Branch management and visualization
- Version tagging
- Change type indicators (created, updated, published, branched, merged, restored, archived)

**Usage:**

```tsx
import { VersionHistory } from '@/components/workflow';

function WorkflowVersions() {
  const [versions, setVersions] = useState<WorkflowVersion[]>([]);
  const [currentVersionId, setCurrentVersionId] = useState('');

  const handleRestore = (versionId: string) => {
    // Restore workflow to this version
    console.log('Restoring to version:', versionId);
  };

  const handleCompare = (versionId1: string, versionId2: string) => {
    // Compare two versions
    console.log('Comparing:', versionId1, versionId2);
  };

  const handlePublish = (versionId: string, notes?: string) => {
    // Publish a draft version
    console.log('Publishing version:', versionId);
  };

  return (
    <VersionHistory
      workflowId='workflow-123'
      versions={versions}
      currentVersionId={currentVersionId}
      onRestore={handleRestore}
      onCompare={handleCompare}
      onPublish={handlePublish}
      onAddNotes={(versionId, notes) => {
        // Add or update version notes
      }}
    />
  );
}
```

### 2. WorkflowDiff

Visual diff viewer showing changes between two workflow versions.

**Features:**

- Side-by-side comparison
- Syntax-highlighted JSON diff
- Change categorization (metadata, trigger, actions, variables)
- Added/removed/modified indicators
- Expandable change details
- Tabbed navigation by change type
- Change statistics summary

**Usage:**

```tsx
import { WorkflowDiff } from '@/components/workflow';

function VersionComparison() {
  const oldVersion = useVersion('v1');
  const newVersion = useVersion('v2');

  return <WorkflowDiff oldVersion={oldVersion} newVersion={newVersion} />;
}
```

## Version Control Concepts

### Version States

| State       | Description                          | Actions Available     |
| ----------- | ------------------------------------ | --------------------- |
| `draft`     | Work in progress, not deployed       | Edit, Publish, Delete |
| `published` | Active version, deployed             | View, Restore, Branch |
| `archived`  | Historical version, no longer active | View, Restore         |

### Change Types

| Type        | Icon         | Description                     |
| ----------- | ------------ | ------------------------------- |
| `created`   | FileText     | Initial workflow creation       |
| `updated`   | Edit3        | Modifications to workflow       |
| `published` | CheckCircle2 | Draft promoted to published     |
| `branched`  | GitBranch    | New branch created from version |
| `merged`    | GitMerge     | Branch merged into main         |
| `restored`  | RotateCcw    | Previous version restored       |
| `archived`  | AlertCircle  | Version archived                |

### Version Branching

Create experimental branches to test changes without affecting the main workflow:

```typescript
// Create a new branch
const branch = {
  name: 'feature/new-action',
  description: 'Testing new notification action',
  baseVersionId: currentVersion.id,
};

// Work on branch
// ...

// Merge branch back to main
mergeBranch(branch.id, mainVersion.id);
```

## Type Definitions

### WorkflowVersion

```typescript
interface WorkflowVersion {
  id: string;
  versionNumber: number;
  state: 'draft' | 'published' | 'archived';
  workflow: Workflow;
  changeType: 'created' | 'updated' | 'published' | 'branched' | 'merged' | 'restored' | 'archived';
  changeNotes?: string;
  createdBy: string;
  createdByName: string;
  createdAt: string;
  parentVersionId?: string;
  branchName?: string;
  tags: string[];
}
```

### VersionBranch

```typescript
interface VersionBranch {
  id: string;
  name: string;
  description?: string;
  baseVersionId: string;
  headVersionId: string;
  createdBy: string;
  createdAt: string;
  mergedAt?: string;
  mergedIntoVersionId?: string;
  status: 'active' | 'merged' | 'abandoned';
}
```

### WorkflowDiffResult

```typescript
interface WorkflowDiffResult {
  metadata: DiffItem[];
  trigger: DiffItem[];
  actions: DiffItem<ActionConfig>[];
  variables: DiffItem<WorkflowVariable>[];
  hasChanges: boolean;
}

interface DiffItem<T = unknown> {
  operation: 'added' | 'removed' | 'modified' | 'unchanged';
  oldValue?: T;
  newValue?: T;
  path: string;
  label: string;
}
```

## Version Control Best Practices

### 1. Use Meaningful Version Notes

```typescript
{
  changeNotes: 'Added notification step to alert team when deployment completes',
}
```

### 2. Tag Important Versions

```typescript
{
  tags: ['v1.0', 'stable', 'production'],
}
```

### 3. Branch for Experiments

```typescript
// Create branch for testing
createBranch(currentVersion.id, 'experiment/new-workflow', 'Testing new approach');

// If successful, merge back
if (experimentSuccessful) {
  mergeBranch(branch.id, mainVersion.id);
}
```

### 4. Regular Publishing

```typescript
// Publish draft versions regularly to create restore points
if (isDraftReady) {
  publishVersion(draftVersion.id, 'Completed initial setup');
}
```

### 5. Compare Before Restore

```typescript
// Always compare versions before restoring
const diff = compareVersions(currentVersion, targetVersion);
if (diff.hasChanges) {
  showDiffModal(diff);
  // User reviews and confirms restore
}
```

## Complete Integration Example

```tsx
import { useState } from 'react';
import {
  VersionHistory,
  WorkflowDiff,
  type WorkflowVersion,
  type VersionBranch,
} from '@/components/workflow';
import { Dialog, DialogContent } from '@/components/ui/dialog';

function WorkflowVersionManager() {
  const [versions, setVersions] = useState<WorkflowVersion[]>([]);
  const [branches, setBranches] = useState<VersionBranch[]>([]);
  const [currentVersionId, setCurrentVersionId] = useState('');
  const [compareVersions, setCompareVersions] = useState<{
    old: WorkflowVersion;
    new: WorkflowVersion;
  } | null>(null);

  const handleRestore = async (versionId: string) => {
    const targetVersion = versions.find(v => v.id === versionId);
    if (!targetVersion) return;

    // Show confirmation
    const confirmed = await confirmRestore(targetVersion);
    if (!confirmed) return;

    // Create new version from target
    const restoredVersion: WorkflowVersion = {
      ...targetVersion,
      id: generateId(),
      versionNumber: versions.length + 1,
      changeType: 'restored',
      changeNotes: `Restored from version ${targetVersion.versionNumber}`,
      createdAt: new Date().toISOString(),
      parentVersionId: currentVersionId,
    };

    setVersions([...versions, restoredVersion]);
    setCurrentVersionId(restoredVersion.id);
  };

  const handleCompare = (versionId1: string, versionId2: string) => {
    const v1 = versions.find(v => v.id === versionId1);
    const v2 = versions.find(v => v.id === versionId2);
    if (v1 && v2) {
      setCompareVersions({ old: v1, new: v2 });
    }
  };

  const handleCreateBranch = (baseVersionId: string, branchName: string, description?: string) => {
    const branch: VersionBranch = {
      id: generateId(),
      name: branchName,
      description,
      baseVersionId,
      headVersionId: baseVersionId,
      createdBy: currentUser.id,
      createdAt: new Date().toISOString(),
      status: 'active',
    };

    setBranches([...branches, branch]);
  };

  const handlePublish = (versionId: string, notes?: string) => {
    setVersions(
      versions.map(v => (v.id === versionId ? { ...v, state: 'published', changeNotes: notes } : v))
    );
  };

  return (
    <div className='space-y-6'>
      <VersionHistory
        workflowId='workflow-123'
        versions={versions}
        branches={branches}
        currentVersionId={currentVersionId}
        onRestore={handleRestore}
        onCompare={handleCompare}
        onCreateBranch={handleCreateBranch}
        onPublish={handlePublish}
        onAddNotes={(versionId, notes) => {
          setVersions(versions.map(v => (v.id === versionId ? { ...v, changeNotes: notes } : v)));
        }}
      />

      {/* Compare dialog */}
      {compareVersions && (
        <Dialog open={!!compareVersions} onOpenChange={() => setCompareVersions(null)}>
          <DialogContent className='max-w-6xl'>
            <WorkflowDiff oldVersion={compareVersions.old} newVersion={compareVersions.new} />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
```

## License

Part of the Wundr Neolith project.
