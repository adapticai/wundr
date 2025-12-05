# Condition Builder - Quick Start Guide

## 5-Minute Setup

### 1. Import the Component

```tsx
import {
  ConditionBuilder,
  type ConditionGroup,
  validateConditionGroup,
} from '@/components/workflow';
```

### 2. Set Up State

```tsx
const [condition, setCondition] = useState<ConditionGroup>({
  id: 'root',
  operator: 'AND',
  conditions: [],
});
```

### 3. Render the Component

```tsx
<ConditionBuilder value={condition} onChange={setCondition} variables={workflowVariables} />
```

## Common Use Cases

### Use Case 1: Simple Field Validation

```tsx
// Check if email is from approved domain
{
  id: 'email-check',
  operator: 'AND',
  conditions: [
    {
      id: 'c1',
      variable: 'trigger.payload.email',
      operator: 'ends_with',
      value: '@company.com',
      type: 'literal',
    },
  ],
}
```

### Use Case 2: Priority Routing

```tsx
// Route high-priority or high-value items
{
  id: 'priority-routing',
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
}
```

### Use Case 3: Complex Business Rules

```tsx
// Enabled + (Premium tier OR high credits)
{
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
          operator: 'equals',
          value: 'premium',
          type: 'literal',
        },
        {
          id: 'c3',
          variable: 'trigger.payload.credits',
          operator: 'greater_than',
          value: '100',
          type: 'literal',
        },
      ],
    },
  ],
}
```

## Quick Validation

```tsx
// Validate before saving
const errors = validateConditionGroup(condition, variables);

if (errors.length > 0) {
  alert('Please fix validation errors');
  return;
}

// Save the workflow
await saveWorkflow({ ...workflow, condition });
```

## Show Natural Language Preview

```tsx
import { explainConditionGroup } from '@/components/workflow';

const explanation = explainConditionGroup(condition, variables);

// Display to user
<pre className='text-sm'>{explanation}</pre>;
```

## Enable Templates

```tsx
<ConditionBuilder
  value={condition}
  onChange={setCondition}
  variables={variables}
  showTemplates={true} // Show template button
/>
```

## Read-Only Mode

```tsx
<ConditionBuilder
  value={condition}
  onChange={setCondition}
  variables={variables}
  readOnly={true} // Disable editing
/>
```

## Operator Reference (Quick)

### String

- `equals`, `not_equals`
- `contains`, `not_contains`
- `starts_with`, `ends_with`
- `matches_regex`

### Number

- `equals`, `not_equals`
- `greater_than`, `greater_than_or_equal`
- `less_than`, `less_than_or_equal`

### Any Type

- `is_empty`, `is_not_empty`

### Array

- `contains`, `not_contains`
- `in_array`, `not_in_array`

## Common Patterns

### Check Multiple Values (OR)

```tsx
{
  operator: 'OR',
  conditions: [
    { variable: 'status', operator: 'equals', value: 'draft' },
    { variable: 'status', operator: 'equals', value: 'pending' },
    { variable: 'status', operator: 'equals', value: 'review' },
  ]
}
```

### Range Check (AND)

```tsx
{
  operator: 'AND',
  conditions: [
    { variable: 'age', operator: 'greater_than_or_equal', value: '18' },
    { variable: 'age', operator: 'less_than', value: '65' },
  ]
}
```

### Not Null and Has Value

```tsx
{
  operator: 'AND',
  conditions: [
    { variable: 'field', operator: 'is_not_empty' },
    { variable: 'field', operator: 'not_equals', value: '' },
  ]
}
```

## Troubleshooting

### Issue: Operator not showing

**Solution**: Check variable type matches operator's supported types

### Issue: Validation error

**Solution**: Ensure variable exists in variables array

### Issue: Value required error

**Solution**: Some operators need values, others don't (like `is_empty`)

### Issue: Preview not updating

**Solution**: Check that `showPreview` prop is true

## TypeScript Tips

```tsx
// Import types
import type { Condition, ConditionGroup, ComparisonOperator } from '@/components/workflow';

// Type-safe condition creation
const condition: Condition = {
  id: 'c1',
  variable: 'test',
  operator: 'equals' as ComparisonOperator,
  value: 'value',
  type: 'literal',
};
```

## Performance Tips

1. Memoize validation:

```tsx
const errors = useMemo(() => validateConditionGroup(condition, variables), [condition, variables]);
```

2. Debounce onChange:

```tsx
const debouncedOnChange = useDebouncedCallback(onChange, 300);
```

3. Use read-only for display:

```tsx
<ConditionBuilder readOnly={true} ... />
```

## Next Steps

1. Read full documentation: `CONDITION_BUILDER_README.md`
2. View demo: `condition-builder-demo.tsx`
3. Run tests: `npm run test -- condition-builder.test.tsx`
4. Try examples in your workflow builder

## Support

For issues or questions:

1. Check the full README
2. Review test cases for examples
3. Examine demo component
4. Check operator configuration in source

---

**Pro Tip**: Use the template button to quickly start with common patterns, then customize from
there!
