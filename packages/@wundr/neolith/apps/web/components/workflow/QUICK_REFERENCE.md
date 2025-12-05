# Workflow Variables - Quick Reference Card

## Component Imports

```tsx
import {
  VariableManager,
  VariablePicker,
  VariableInput,
  validateVariable,
  validateVariableReferences,
  extractVariableReferences,
  replaceVariableReferences,
  type ScopedWorkflowVariable,
  type VariableScope,
} from '@/components/workflow';
```

## Variable Manager

```tsx
<VariableManager
  variables={variables}
  onVariablesChange={setVariables}
  availableSteps={[{ id: 'step1', name: 'Send Message' }]}
/>
```

## Variable Picker

```tsx
<VariablePicker
  variables={variables}
  currentStepId="step1"
  value={selectedVar}
  onSelect={(ref) => setSelectedVar(ref)}
  placeholder="Select a variable"
/>
```

## Variable Input

```tsx
<VariableInput
  value={message}
  onChange={setMessage}
  variables={variables}
  currentStepId="step1"
  multiline
/>
```

## Variable Types

| Type | Example Value | Icon |
|------|---------------|------|
| `string` | `"Hello"` | Aa |
| `number` | `42` | 123 |
| `boolean` | `true` | T/F |
| `array` | `[1, 2, 3]` | [] |
| `object` | `{"key": "value"}` | {} |

## Variable Scopes

```tsx
// Global - available everywhere
{
  scope: 'global',
}

// Step - available in specific step
{
  scope: 'step',
  stepId: 'step1',
}
```

## Variable Reference Syntax

```tsx
// In text
"Welcome ${variable.userName}!"

// In JSON
'{"name": "${variable.userName}"}'

// Multiple references
"Hello ${variable.firstName} ${variable.lastName}"
```

## Validation Functions

```tsx
// Validate variable name
const error = validateVariableName('userName', existingNames);

// Validate complete variable
const result = validateVariable(variable, existingVariables);
if (!result.isValid) {
  console.error(result.errors);
}

// Validate references in text
const result = validateVariableReferences(text, availableVariables);

// Extract variable names from text
const refs = extractVariableReferences('${variable.a} ${variable.b}');
// Returns: ['a', 'b']

// Preview with actual values
const preview = replaceVariableReferences(
  '${variable.name}',
  { name: 'John' }
);
// Returns: 'John'
```

## Variable Object Structure

```tsx
interface ScopedWorkflowVariable {
  id: string;                    // Unique identifier
  name: string;                  // Variable name (alphanumeric + _)
  type: VariableType;            // Type of variable
  description?: string;          // Optional description
  defaultValue?: any;            // Optional default value
  scope: 'global' | 'step';      // Variable scope
  stepId?: string;               // Required for step scope
}
```

## Common Patterns

### Create Variable

```tsx
const newVariable: ScopedWorkflowVariable = {
  id: `var_${Date.now()}`,
  name: 'userName',
  type: 'string',
  description: 'User name',
  defaultValue: 'Guest',
  scope: 'global',
};
```

### Update Variable

```tsx
const updatedVariables = variables.map(v =>
  v.id === targetId ? { ...v, name: 'newName' } : v
);
```

### Delete Variable

```tsx
const filteredVariables = variables.filter(v => v.id !== deleteId);
```

### Find Variable by Name

```tsx
const variable = variables.find(v => v.name === 'userName');
```

### Filter by Scope

```tsx
const globalVars = variables.filter(v => v.scope === 'global');
const stepVars = variables.filter(v => v.scope === 'step');
```

### Group by Step

```tsx
const byStep = variables
  .filter(v => v.scope === 'step')
  .reduce((acc, v) => {
    if (v.stepId) {
      if (!acc[v.stepId]) acc[v.stepId] = [];
      acc[v.stepId].push(v);
    }
    return acc;
  }, {} as Record<string, ScopedWorkflowVariable[]>);
```

## Error Handling

```tsx
// Validate before save
const validation = validateWorkflowVariables(variables);
if (!validation.isValid) {
  validation.errors.forEach(error => {
    console.error(`${error.field}: ${error.message}`);
  });
  return;
}

// Check for undefined references
const refValidation = validateVariableReferences(config.message, variables);
if (!refValidation.isValid) {
  alert('Some variables are not defined');
  return;
}
```

## Best Practices

1. **Always validate before save**
   ```tsx
   const result = validateWorkflowVariables(variables);
   if (!result.isValid) return;
   ```

2. **Use descriptive names**
   ```tsx
   // Good
   userName, userEmail, welcomeDelay

   // Avoid
   u, e, d
   ```

3. **Add descriptions**
   ```tsx
   {
     name: 'userName',
     description: 'Name of the user joining the workspace',
   }
   ```

4. **Provide defaults**
   ```tsx
   {
     name: 'welcomeDelay',
     defaultValue: 5,
   }
   ```

5. **Check references exist**
   ```tsx
   const refs = extractVariableReferences(text);
   const valid = refs.every(ref =>
     variables.some(v => v.name === ref)
   );
   ```

## Demo Component

```tsx
import { VariableManagerDemo } from '@/components/workflow/variable-manager-demo';

function DemoPage() {
  return <VariableManagerDemo />;
}
```

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Escape` | Close dialogs/popovers |
| `Enter` | Save variable (in dialog) |
| `Tab` | Navigate fields |
| `Arrow Up/Down` | Navigate picker items |
| `Enter` | Select picker item |

## Styling

All components support:
- `className` prop for custom styles
- Dark mode (automatic)
- Responsive design
- Custom color schemes via Tailwind

## File Locations

```
/components/workflow/
├── variable-manager.tsx        # Main manager component
├── variable-picker.tsx         # Variable picker dropdown
├── variable-input.tsx          # Input with variable support
├── variable-validation.ts      # Validation utilities
├── variable-manager-demo.tsx   # Demo component
├── index.ts                    # Exports
└── README.md                   # Full documentation
```

## Support

For detailed documentation, see:
- [README.md](./README.md) - Complete guide
- [IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md) - Technical details

## License

Part of the Wundr Neolith project.
