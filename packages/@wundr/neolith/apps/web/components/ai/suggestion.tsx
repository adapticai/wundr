'use client';

import * as React from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface SuggestionProps {
  suggestions: string[];
  onSelect: (suggestion: string) => void;
  variant?: 'outline' | 'secondary' | 'ghost';
  size?: 'sm' | 'default';
  className?: string;
}

export function Suggestions({
  suggestions,
  onSelect,
  variant = 'outline',
  size = 'sm',
  className,
}: SuggestionProps) {
  if (suggestions.length === 0) {
    return null;
  }

  return (
    <SuggestionContainer className={className}>
      {suggestions.map((suggestion, index) => (
        <SuggestionItem
          key={index}
          suggestion={suggestion}
          onClick={() => onSelect(suggestion)}
          variant={variant}
          size={size}
        />
      ))}
    </SuggestionContainer>
  );
}

export function SuggestionContainer({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('w-full overflow-x-auto', className)} {...props}>
      <div className='flex gap-2 pb-2'>{children}</div>
    </div>
  );
}

export function SuggestionItem({
  suggestion,
  onClick,
  variant = 'outline',
  size = 'sm',
  className,
  ...props
}: {
  suggestion: string;
  onClick: () => void;
  variant?: 'outline' | 'secondary' | 'ghost';
  size?: 'sm' | 'default';
} & Omit<React.HTMLAttributes<HTMLButtonElement>, 'onClick'>) {
  return (
    <Button
      variant={variant}
      size={size}
      className={cn(
        'shrink-0 rounded-full whitespace-nowrap',
        size === 'sm' ? 'h-8 px-4 text-xs' : 'h-9 px-5 text-sm',
        className
      )}
      onClick={onClick}
      {...props}
    >
      {suggestion}
    </Button>
  );
}

// Pre-built suggestion sets for entity creation
export const WORKSPACE_SUGGESTIONS = [
  "I'm building a tech startup",
  "It's a hedge fund for crypto",
  'Small team, about 5 people',
  'We focus on AI/ML products',
  'Enterprise software company',
];

export const ORCHESTRATOR_SUGGESTIONS = [
  'Customer support lead',
  'Research analyst',
  'Project manager',
  'Sales representative',
  'Technical advisor',
];

export const SESSION_MANAGER_SUGGESTIONS = [
  'Handle customer inquiries',
  'Monitor Slack channels',
  'Manage email conversations',
  'Process support tickets',
  'Coordinate team updates',
];

// Context-aware suggestion generator
export function getEntitySuggestions(
  entityType: string,
  conversationLength: number
): string[] {
  if (conversationLength === 0) {
    switch (entityType) {
      case 'workspace':
        return WORKSPACE_SUGGESTIONS;
      case 'orchestrator':
        return ORCHESTRATOR_SUGGESTIONS;
      case 'session-manager':
        return SESSION_MANAGER_SUGGESTIONS;
      default:
        return ['Tell me more...', 'I need help with...'];
    }
  }

  // Follow-up suggestions based on conversation stage
  if (conversationLength === 1) {
    return [
      'Add more details',
      "That's correct",
      'Let me explain further',
      'I want to modify that',
    ];
  }

  return [
    'That looks good',
    'Make a change',
    'Show me a preview',
    "I'm ready to create",
  ];
}
