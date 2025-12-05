# Condition Builder Component

A comprehensive visual condition builder for workflow steps with advanced features for creating
complex logical expressions.

## Features

### Visual Condition Building

- **AND/OR Groups**: Create logical groups with unlimited nesting depth
- **Visual Hierarchy**: Clear visual indication of condition structure with indentation
- **Collapsible Groups**: Collapse/expand condition groups for better organization
- **Drag and Drop**: Reorder conditions and groups (future enhancement)

### Comparison Operators

#### String Operators

- `equals` - Exact match
- `not_equals` - Not equal to value
- `contains` - Contains substring
- `not_contains` - Does not contain substring
- `starts_with` - String starts with value
- `ends_with` - String ends with value
- `matches_regex` - Matches regular expression

#### Numeric Operators

- `equals` - Exact numeric match
- `not_equals` - Not equal to value
- `greater_than` - Numerically greater
- `greater_than_or_equal` - Greater or equal
- `less_than` - Numerically less
- `less_than_or_equal` - Less or equal

#### Empty/Existence Checks

- `is_empty` - Empty or null
- `is_not_empty` - Not empty or null

#### Array Operators

- `contains` - Contains element
- `not_contains` - Does not contain element
- `in_array` - Value exists in array
- `not_in_array` - Value does not exist in array

### Variable References

- **Type-Aware**: Only shows operators supported by variable type
- **Variable vs Literal**: Toggle between literal values and variable references
- **Validation**: Real-time validation of variable references

### Nested Conditions

- **Unlimited Depth**: Create deeply nested condition groups
- **Mixed Logic**: Combine AND/OR at different levels
- **Visual Indentation**: Clear hierarchy with visual depth indicators

### Condition Preview

- **Natural Language**: Human-readable explanation of conditions
- **Copy to Clipboard**: Copy condition text for documentation
- **Real-time Updates**: Preview updates as you build

### Validation

- **Real-time**: Immediate feedback on validation errors
- **Type Checking**: Ensures operators are compatible with variable types
- **Required Values**: Validates that required values are provided
- **Variable Existence**: Checks that referenced variables exist

### Templates

Four pre-built templates for common scenarios:

1. **Email Validation**
   - Check if email is valid and from specific domain
   - Validates non-empty, format, and domain

2. **Priority Routing**
   - Route high-value or urgent items
   - OR logic for priority or value threshold

3. **Status Check**
   - Check if item is approved and not archived
   - AND logic for status filtering

4. **Complex Business Logic**
   - Nested conditions for advanced routing
   - Mixed AND/OR with tier/credits logic

## Usage

### Basic Example

```tsx
import { ConditionBuilder, type ConditionGroup } from '@/components/workflow';

function MyComponent() {
  const [condition, setCondition] = React.useState<ConditionGroup>({
    id: 'root',
    operator: 'AND',
    conditions: [],
  });

  return (
    <ConditionBuilder value={condition} onChange={setCondition} variables={availableVariables} />
  );
}
```

### With Templates

```tsx
<ConditionBuilder
  value={condition}
  onChange={setCondition}
  variables={availableVariables}
  showTemplates={true}
/>
```

### Read-only Mode

```tsx
<ConditionBuilder
  value={condition}
  onChange={setCondition}
  variables={availableVariables}
  readOnly={true}
/>
```

### With Preview

```tsx
<ConditionBuilder
  value={condition}
  onChange={setCondition}
  variables={availableVariables}
  showPreview={true}
/>
```

## API Reference

### ConditionBuilder Props

```typescript
interface ConditionBuilderProps {
  // Current condition group value
  value: ConditionGroup;

  // Callback when conditions change
  onChange: (group: ConditionGroup) => void;

  // Available variables for condition building
  variables: ScopedWorkflowVariable[];

  // Disable editing
  readOnly?: boolean;

  // Show natural language preview
  showPreview?: boolean;

  // Show template selector
  showTemplates?: boolean;

  // Additional CSS classes
  className?: string;
}
```

### Condition Type

```typescript
interface Condition {
  // Unique identifier
  id: string;

  // Variable reference (e.g., "trigger.payload.email")
  variable: string;

  // Comparison operator
  operator: ComparisonOperator;

  // Comparison value (literal or variable reference)
  value: string;

  // Value type
  type: 'literal' | 'variable';
}
```

### ConditionGroup Type

```typescript
interface ConditionGroup {
  // Unique identifier
  id: string;

  // Logical operator
  operator: 'AND' | 'OR';

  // Child conditions and groups
  conditions: Array<Condition | ConditionGroup>;
}
```

## Validation

### Validate Conditions

```typescript
import { validateConditionGroup } from '@/components/workflow';

const errors = validateConditionGroup(conditionGroup, variables);

if (errors.length > 0) {
  console.error('Validation errors:', errors);
}
```

### Validation Error Type

```typescript
interface ConditionError {
  // ID of the condition with error
  id: string;

  // Error message
  message: string;
}
```

## Natural Language Preview

### Generate Explanation

```typescript
import { explainConditionGroup } from '@/components/workflow';

const explanation = explainConditionGroup(conditionGroup, variables);
console.log(explanation);
```

Example output:

```
trigger.payload.enabled equals "true"
AND (
  trigger.payload.tier in array "["premium", "enterprise"]"
  OR trigger.payload.credits greater than "100"
)
```

## Helper Functions

### Check if Condition Group

```typescript
import { isConditionGroup } from '@/components/workflow';

if (isConditionGroup(item)) {
  // Handle as group
} else {
  // Handle as condition
}
```

### Get Operators for Type

```typescript
import { getOperatorsForType } from '@/components/workflow';

const stringOperators = getOperatorsForType('string');
// Returns: ['equals', 'not_equals', 'contains', 'starts_with', ...]
```

### Validate Single Condition

```typescript
import { validateCondition } from '@/components/workflow';

const error = validateCondition(condition, variables);
if (error) {
  console.error('Condition error:', error);
}
```

## Operator Configuration

Access operator metadata:

```typescript
import { OPERATOR_CONFIG } from '@/components/workflow';

const equalsConfig = OPERATOR_CONFIG.equals;
// {
//   label: 'equals',
//   requiresValue: true,
//   supportedTypes: ['string', 'number', 'boolean'],
//   description: 'Exact match'
// }
```

## Templates

Access pre-built templates:

```typescript
import { CONDITION_TEMPLATES } from '@/components/workflow';

// Apply a template
const emailTemplate = CONDITION_TEMPLATES[0];
setCondition(emailTemplate.group);
```

## Styling

The component uses Tailwind CSS and shadcn/ui components. Customize with:

```tsx
<ConditionBuilder
  className='my-custom-class'
  value={condition}
  onChange={setCondition}
  variables={variables}
/>
```

## Best Practices

1. **Type Safety**: Always use TypeScript for better type checking
2. **Validation**: Validate conditions before saving workflows
3. **Variable Scoping**: Ensure variables are available in the step's scope
4. **Performance**: Use React.memo for large condition trees
5. **User Experience**: Show validation errors inline with helpful messages
6. **Templates**: Provide templates for common patterns in your domain
7. **Testing**: Write tests for custom validation logic

## Examples

### Email Domain Validation

```typescript
const emailValidation: ConditionGroup = {
  id: 'email-check',
  operator: 'AND',
  conditions: [
    {
      id: 'c1',
      variable: 'trigger.payload.email',
      operator: 'is_not_empty',
      value: '',
      type: 'literal',
    },
    {
      id: 'c2',
      variable: 'trigger.payload.email',
      operator: 'ends_with',
      value: '@company.com',
      type: 'literal',
    },
  ],
};
```

### Priority-Based Routing

```typescript
const priorityRouting: ConditionGroup = {
  id: 'priority-check',
  operator: 'OR',
  conditions: [
    {
      id: 'c1',
      variable: 'trigger.payload.priority',
      operator: 'equals',
      value: 'high',
      type: 'literal',
    },
    {
      id: 'c2',
      variable: 'trigger.payload.value',
      operator: 'greater_than',
      value: '1000',
      type: 'literal',
    },
  ],
};
```

### Complex Business Rules

```typescript
const businessRules: ConditionGroup = {
  id: 'business-rules',
  operator: 'AND',
  conditions: [
    {
      id: 'c1',
      variable: 'trigger.payload.enabled',
      operator: 'equals',
      value: 'true',
      type: 'literal',
    },
    {
      id: 'g1',
      operator: 'OR',
      conditions: [
        {
          id: 'c2',
          variable: 'trigger.payload.tier',
          operator: 'in_array',
          value: '["premium", "enterprise"]',
          type: 'literal',
        },
        {
          id: 'g2',
          operator: 'AND',
          conditions: [
            {
              id: 'c3',
              variable: 'trigger.payload.credits',
              operator: 'greater_than',
              value: '100',
              type: 'literal',
            },
            {
              id: 'c4',
              variable: 'trigger.payload.verified',
              operator: 'equals',
              value: 'true',
              type: 'literal',
            },
          ],
        },
      ],
    },
  ],
};
```

## Testing

See `__tests__/components/workflow/condition-builder.test.tsx` for comprehensive test examples.

```typescript
import { validateConditionGroup } from '@/components/workflow';

describe('My Workflow', () => {
  it('should validate conditions', () => {
    const errors = validateConditionGroup(myCondition, variables);
    expect(errors).toHaveLength(0);
  });
});
```

## Performance

### Large Condition Trees

- Use React.memo for ConditionItem and ConditionGroupItem
- Implement virtualization for very large trees
- Consider lazy loading for deeply nested groups

### Optimization Tips

```typescript
// Memoize validation
const errors = React.useMemo(
  () => validateConditionGroup(condition, variables),
  [condition, variables]
);

// Debounce onChange
const debouncedOnChange = useDebouncedCallback(onChange, 300);
```

## Accessibility

The component includes:

- ARIA labels for all interactive elements
- Keyboard navigation support
- Screen reader friendly error messages
- Focus management for nested groups
- High contrast mode support

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers (iOS Safari, Chrome Mobile)

## Related Components

- `VariableManager` - Manage workflow variables
- `VariablePicker` - Pick variables for inputs
- `StepConfigForms` - Configure step settings
- `WorkflowDiff` - Compare condition changes

## License

MIT - See LICENSE file for details
