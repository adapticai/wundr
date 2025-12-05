/**
 * Condition Builder Component Tests
 *
 * Comprehensive test suite for the condition builder including:
 * - Condition creation and editing
 * - Nested group management
 * - Operator validation
 * - Variable reference handling
 * - Natural language generation
 * - Template application
 */

import { describe, it, expect } from 'vitest';
import {
  validateCondition,
  validateConditionGroup,
  explainCondition,
  explainConditionGroup,
  isConditionGroup,
  getOperatorsForType,
  OPERATOR_CONFIG,
  CONDITION_TEMPLATES,
  type Condition,
  type ConditionGroup,
} from '@/components/workflow/condition-builder';
import type { ScopedWorkflowVariable } from '@/components/workflow/variable-manager';

// ============================================================================
// Test Data
// ============================================================================

const mockVariables: ScopedWorkflowVariable[] = [
  {
    id: 'v1',
    name: 'trigger.payload.email',
    type: 'string',
    defaultValue: '',
    description: 'Email address',
    scope: 'global',
  },
  {
    id: 'v2',
    name: 'trigger.payload.count',
    type: 'number',
    defaultValue: 0,
    description: 'Item count',
    scope: 'global',
  },
  {
    id: 'v3',
    name: 'trigger.payload.enabled',
    type: 'boolean',
    defaultValue: false,
    description: 'Enabled flag',
    scope: 'global',
  },
  {
    id: 'v4',
    name: 'trigger.payload.tags',
    type: 'array',
    defaultValue: [],
    description: 'Tag list',
    scope: 'global',
  },
];

// ============================================================================
// Helper Function Tests
// ============================================================================

describe('isConditionGroup', () => {
  it('should identify condition groups correctly', () => {
    const group: ConditionGroup = {
      id: 'g1',
      operator: 'AND',
      conditions: [],
    };

    const condition: Condition = {
      id: 'c1',
      variable: 'test',
      operator: 'equals',
      value: 'value',
      type: 'literal',
    };

    expect(isConditionGroup(group)).toBe(true);
    expect(isConditionGroup(condition)).toBe(false);
  });
});

describe('getOperatorsForType', () => {
  it('should return string operators', () => {
    const operators = getOperatorsForType('string');
    expect(operators).toContain('equals');
    expect(operators).toContain('contains');
    expect(operators).toContain('starts_with');
    expect(operators).toContain('matches_regex');
  });

  it('should return number operators', () => {
    const operators = getOperatorsForType('number');
    expect(operators).toContain('equals');
    expect(operators).toContain('greater_than');
    expect(operators).toContain('less_than');
    expect(operators).not.toContain('contains');
  });

  it('should return boolean operators', () => {
    const operators = getOperatorsForType('boolean');
    expect(operators).toContain('equals');
    expect(operators).toContain('not_equals');
  });

  it('should return array operators', () => {
    const operators = getOperatorsForType('array');
    expect(operators).toContain('contains');
    expect(operators).toContain('is_empty');
  });
});

// ============================================================================
// Validation Tests
// ============================================================================

describe('validateCondition', () => {
  it('should validate a correct condition', () => {
    const condition: Condition = {
      id: 'c1',
      variable: 'trigger.payload.email',
      operator: 'equals',
      value: 'test@example.com',
      type: 'literal',
    };

    const error = validateCondition(condition, mockVariables);
    expect(error).toBeNull();
  });

  it('should detect missing variable', () => {
    const condition: Condition = {
      id: 'c1',
      variable: 'nonexistent.variable',
      operator: 'equals',
      value: 'test',
      type: 'literal',
    };

    const error = validateCondition(condition, mockVariables);
    expect(error).toContain('not found');
  });

  it('should detect invalid operator for type', () => {
    const condition: Condition = {
      id: 'c1',
      variable: 'trigger.payload.count', // number type
      operator: 'contains', // string operator
      value: 'test',
      type: 'literal',
    };

    const error = validateCondition(condition, mockVariables);
    expect(error).toContain('not supported');
  });

  it('should detect missing required value', () => {
    const condition: Condition = {
      id: 'c1',
      variable: 'trigger.payload.email',
      operator: 'equals',
      value: '',
      type: 'literal',
    };

    const error = validateCondition(condition, mockVariables);
    expect(error).toContain('required');
  });

  it('should validate operators that do not require values', () => {
    const condition: Condition = {
      id: 'c1',
      variable: 'trigger.payload.email',
      operator: 'is_empty',
      value: '',
      type: 'literal',
    };

    const error = validateCondition(condition, mockVariables);
    expect(error).toBeNull();
  });

  it('should validate variable references', () => {
    const condition: Condition = {
      id: 'c1',
      variable: 'trigger.payload.email',
      operator: 'equals',
      value: 'trigger.payload.count', // invalid - referencing number variable
      type: 'variable',
    };

    const error = validateCondition(condition, mockVariables);
    expect(error).toBeNull(); // Should pass - just checking existence
  });

  it('should detect missing variable reference', () => {
    const condition: Condition = {
      id: 'c1',
      variable: 'trigger.payload.email',
      operator: 'equals',
      value: 'nonexistent.variable',
      type: 'variable',
    };

    const error = validateCondition(condition, mockVariables);
    expect(error).toContain('not found');
  });
});

describe('validateConditionGroup', () => {
  it('should validate a simple group', () => {
    const group: ConditionGroup = {
      id: 'g1',
      operator: 'AND',
      conditions: [
        {
          id: 'c1',
          variable: 'trigger.payload.email',
          operator: 'equals',
          value: 'test@example.com',
          type: 'literal',
        },
      ],
    };

    const errors = validateConditionGroup(group, mockVariables);
    expect(errors).toHaveLength(0);
  });

  it('should validate nested groups', () => {
    const group: ConditionGroup = {
      id: 'g1',
      operator: 'AND',
      conditions: [
        {
          id: 'c1',
          variable: 'trigger.payload.email',
          operator: 'equals',
          value: 'test@example.com',
          type: 'literal',
        },
        {
          id: 'g2',
          operator: 'OR',
          conditions: [
            {
              id: 'c2',
              variable: 'trigger.payload.count',
              operator: 'greater_than',
              value: '10',
              type: 'literal',
            },
          ],
        },
      ],
    };

    const errors = validateConditionGroup(group, mockVariables);
    expect(errors).toHaveLength(0);
  });

  it('should collect errors from nested groups', () => {
    const group: ConditionGroup = {
      id: 'g1',
      operator: 'AND',
      conditions: [
        {
          id: 'c1',
          variable: 'nonexistent.var1',
          operator: 'equals',
          value: 'test',
          type: 'literal',
        },
        {
          id: 'g2',
          operator: 'OR',
          conditions: [
            {
              id: 'c2',
              variable: 'nonexistent.var2',
              operator: 'equals',
              value: 'test',
              type: 'literal',
            },
          ],
        },
      ],
    };

    const errors = validateConditionGroup(group, mockVariables);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some(e => e.id === 'c1')).toBe(true);
    expect(errors.some(e => e.id === 'c2')).toBe(true);
  });
});

// ============================================================================
// Natural Language Tests
// ============================================================================

describe('explainCondition', () => {
  it('should explain equals condition', () => {
    const condition: Condition = {
      id: 'c1',
      variable: 'trigger.payload.email',
      operator: 'equals',
      value: 'test@example.com',
      type: 'literal',
    };

    const explanation = explainCondition(condition, mockVariables);
    expect(explanation).toContain('trigger.payload.email');
    expect(explanation).toContain('equals');
    expect(explanation).toContain('test@example.com');
  });

  it('should explain is_empty condition without value', () => {
    const condition: Condition = {
      id: 'c1',
      variable: 'trigger.payload.email',
      operator: 'is_empty',
      value: '',
      type: 'literal',
    };

    const explanation = explainCondition(condition, mockVariables);
    expect(explanation).toContain('trigger.payload.email');
    expect(explanation).toContain('is empty');
    expect(explanation).not.toContain('""');
  });

  it('should explain variable reference', () => {
    const condition: Condition = {
      id: 'c1',
      variable: 'trigger.payload.email',
      operator: 'equals',
      value: 'trigger.payload.count',
      type: 'variable',
    };

    const explanation = explainCondition(condition, mockVariables);
    expect(explanation).toContain('trigger.payload.email');
    expect(explanation).toContain('equals');
    expect(explanation).toContain('{trigger.payload.count}');
  });
});

describe('explainConditionGroup', () => {
  it('should explain simple AND group', () => {
    const group: ConditionGroup = {
      id: 'g1',
      operator: 'AND',
      conditions: [
        {
          id: 'c1',
          variable: 'trigger.payload.email',
          operator: 'equals',
          value: 'test@example.com',
          type: 'literal',
        },
        {
          id: 'c2',
          variable: 'trigger.payload.count',
          operator: 'greater_than',
          value: '5',
          type: 'literal',
        },
      ],
    };

    const explanation = explainConditionGroup(group, mockVariables);
    expect(explanation).toContain('AND');
    expect(explanation).toContain('trigger.payload.email');
    expect(explanation).toContain('trigger.payload.count');
  });

  it('should explain nested groups with proper formatting', () => {
    const group: ConditionGroup = {
      id: 'g1',
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
          id: 'g2',
          operator: 'OR',
          conditions: [
            {
              id: 'c2',
              variable: 'trigger.payload.count',
              operator: 'greater_than',
              value: '10',
              type: 'literal',
            },
            {
              id: 'c3',
              variable: 'trigger.payload.email',
              operator: 'contains',
              value: 'example.com',
              type: 'literal',
            },
          ],
        },
      ],
    };

    const explanation = explainConditionGroup(group, mockVariables);
    expect(explanation).toContain('AND');
    expect(explanation).toContain('OR');
    expect(explanation).toContain('(');
    expect(explanation).toContain(')');
  });
});

// ============================================================================
// Operator Configuration Tests
// ============================================================================

describe('OPERATOR_CONFIG', () => {
  it('should have configuration for all operators', () => {
    const operators = [
      'equals',
      'not_equals',
      'contains',
      'not_contains',
      'starts_with',
      'ends_with',
      'greater_than',
      'greater_than_or_equal',
      'less_than',
      'less_than_or_equal',
      'is_empty',
      'is_not_empty',
      'matches_regex',
      'in_array',
      'not_in_array',
    ];

    operators.forEach(op => {
      expect(OPERATOR_CONFIG).toHaveProperty(op);
      expect(
        OPERATOR_CONFIG[op as keyof typeof OPERATOR_CONFIG]
      ).toHaveProperty('label');
      expect(
        OPERATOR_CONFIG[op as keyof typeof OPERATOR_CONFIG]
      ).toHaveProperty('requiresValue');
      expect(
        OPERATOR_CONFIG[op as keyof typeof OPERATOR_CONFIG]
      ).toHaveProperty('supportedTypes');
      expect(
        OPERATOR_CONFIG[op as keyof typeof OPERATOR_CONFIG]
      ).toHaveProperty('description');
    });
  });

  it('should have proper requiresValue flags', () => {
    expect(OPERATOR_CONFIG.equals.requiresValue).toBe(true);
    expect(OPERATOR_CONFIG.is_empty.requiresValue).toBe(false);
    expect(OPERATOR_CONFIG.is_not_empty.requiresValue).toBe(false);
  });

  it('should have proper type support', () => {
    expect(OPERATOR_CONFIG.greater_than.supportedTypes).toContain('number');
    expect(OPERATOR_CONFIG.greater_than.supportedTypes).not.toContain('string');
    expect(OPERATOR_CONFIG.contains.supportedTypes).toContain('string');
    expect(OPERATOR_CONFIG.contains.supportedTypes).toContain('array');
  });
});

// ============================================================================
// Template Tests
// ============================================================================

describe('CONDITION_TEMPLATES', () => {
  it('should have multiple templates', () => {
    expect(CONDITION_TEMPLATES.length).toBeGreaterThan(0);
  });

  it('should have properly structured templates', () => {
    CONDITION_TEMPLATES.forEach(template => {
      expect(template).toHaveProperty('name');
      expect(template).toHaveProperty('description');
      expect(template).toHaveProperty('group');
      expect(template.group).toHaveProperty('id');
      expect(template.group).toHaveProperty('operator');
      expect(template.group).toHaveProperty('conditions');
    });
  });

  it('should have email validation template', () => {
    const emailTemplate = CONDITION_TEMPLATES.find(t =>
      t.name.toLowerCase().includes('email')
    );
    expect(emailTemplate).toBeDefined();
  });

  it('should have priority routing template', () => {
    const priorityTemplate = CONDITION_TEMPLATES.find(t =>
      t.name.toLowerCase().includes('priority')
    );
    expect(priorityTemplate).toBeDefined();
  });

  it('should have nested conditions in complex template', () => {
    const complexTemplate = CONDITION_TEMPLATES.find(t =>
      t.name.toLowerCase().includes('complex')
    );
    expect(complexTemplate).toBeDefined();
    if (complexTemplate) {
      const hasNestedGroup = complexTemplate.group.conditions.some(c =>
        isConditionGroup(c)
      );
      expect(hasNestedGroup).toBe(true);
    }
  });
});

// ============================================================================
// Edge Cases
// ============================================================================

describe('Edge Cases', () => {
  it('should handle empty condition group', () => {
    const group: ConditionGroup = {
      id: 'g1',
      operator: 'AND',
      conditions: [],
    };

    const errors = validateConditionGroup(group, mockVariables);
    expect(errors).toHaveLength(0);

    const explanation = explainConditionGroup(group, mockVariables);
    expect(explanation).toBeDefined();
  });

  it('should handle deeply nested groups', () => {
    const group: ConditionGroup = {
      id: 'g1',
      operator: 'AND',
      conditions: [
        {
          id: 'g2',
          operator: 'OR',
          conditions: [
            {
              id: 'g3',
              operator: 'AND',
              conditions: [
                {
                  id: 'c1',
                  variable: 'trigger.payload.email',
                  operator: 'equals',
                  value: 'test@example.com',
                  type: 'literal',
                },
              ],
            },
          ],
        },
      ],
    };

    const errors = validateConditionGroup(group, mockVariables);
    expect(errors).toHaveLength(0);

    const explanation = explainConditionGroup(group, mockVariables);
    expect(explanation).toContain('(');
  });

  it('should handle special characters in values', () => {
    const condition: Condition = {
      id: 'c1',
      variable: 'trigger.payload.email',
      operator: 'matches_regex',
      value: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$',
      type: 'literal',
    };

    const error = validateCondition(condition, mockVariables);
    expect(error).toBeNull();
  });
});
