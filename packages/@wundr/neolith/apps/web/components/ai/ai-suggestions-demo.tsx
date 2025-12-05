'use client';

import * as React from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import {
  SmartSuggestions,
  GroupedSmartSuggestions,
  type Suggestion,
} from './smart-suggestions';
import {
  AutocompleteInput,
  InlineAutocomplete,
  type AutocompleteOption,
} from './autocomplete-input';
import {
  QuickActions,
  CategorizedQuickActions,
  FloatingQuickActions,
  type QuickAction,
} from './quick-actions';
import { SmartContextMenu } from './context-menu-ai';
import { InlineEdit, InlineEditWithDiff } from './inline-edit';

/**
 * Demo component showcasing all AI Suggestion features
 * This demonstrates real-world usage patterns
 */
export function AISuggestionsDemo() {
  // Smart Suggestions State
  const [suggestions] = React.useState<Suggestion[]>([
    {
      id: '1',
      text: 'Create new workspace',
      category: 'quick-action',
      confidence: 0.95,
    },
    {
      id: '2',
      text: 'Import team members',
      category: 'recommended',
      confidence: 0.88,
    },
    {
      id: '3',
      text: 'Setup integrations',
      category: 'trending',
      confidence: 0.82,
    },
    {
      id: '4',
      text: 'Review recent activity',
      category: 'recent',
    },
    {
      id: '5',
      text: 'Customize dashboard',
      category: 'personalized',
      confidence: 0.91,
    },
  ]);

  // Autocomplete State
  const [autocompleteValue, setAutocompleteValue] = React.useState('');
  const [inlineValue, setInlineValue] = React.useState('');

  // Quick Actions
  const quickActions: QuickAction[] = [
    {
      id: 'generate',
      label: 'Generate',
      category: 'AI Actions',
      isAI: true,
      onClick: () => console.log('Generate clicked'),
    },
    {
      id: 'enhance',
      label: 'Enhance',
      category: 'AI Actions',
      isAI: true,
      onClick: () => console.log('Enhance clicked'),
    },
    {
      id: 'summarize',
      label: 'Summarize',
      category: 'AI Actions',
      isAI: true,
      onClick: () => console.log('Summarize clicked'),
    },
    {
      id: 'copy',
      label: 'Copy',
      category: 'Standard',
      onClick: () => console.log('Copy clicked'),
    },
    {
      id: 'share',
      label: 'Share',
      category: 'Standard',
      onClick: () => console.log('Share clicked'),
    },
  ];

  // Inline Edit State
  const [editValue, setEditValue] = React.useState(
    'This is a sample text that can be edited inline with AI assistance. Try the AI actions to see how it transforms the content.'
  );
  const [showDiff, setShowDiff] = React.useState(false);

  // Mock API functions
  const fetchAutocompleteSuggestions = async (
    query: string
  ): Promise<AutocompleteOption[]> => {
    await new Promise(resolve => setTimeout(resolve, 500));
    return [
      {
        value: query + ' workspace',
        label: query + ' workspace',
        description: 'Create a new workspace',
        category: 'Workspaces',
        confidence: 0.9,
      },
      {
        value: query + ' project',
        label: query + ' project',
        description: 'Start a new project',
        category: 'Projects',
        confidence: 0.85,
      },
      {
        value: query + ' team',
        label: query + ' team',
        description: 'Add team members',
        category: 'Teams',
        confidence: 0.8,
      },
    ];
  };

  const fetchInlineSuggestion = async (
    query: string
  ): Promise<string | null> => {
    await new Promise(resolve => setTimeout(resolve, 500));
    if (query.length < 5) return null;
    return query + ' suggestion';
  };

  const handleAIEdit = async (instruction: string): Promise<string> => {
    await new Promise(resolve => setTimeout(resolve, 1000));
    const transformations: Record<string, string> = {
      'Make it shorter': editValue.split('.')[0] + '.',
      'Make it longer':
        editValue +
        ' Additionally, this content has been expanded with more detailed information to provide better context.',
      Simplify: 'This text can be edited with AI help.',
      'Make it formal':
        'The present document constitutes a specimen text which may be subjected to inline modification with artificial intelligence assistance.',
      'Fix grammar': editValue.replace('can be edited', 'may be edited'),
    };
    return transformations[instruction] || editValue;
  };

  return (
    <div className='container mx-auto py-8 space-y-8'>
      <div>
        <h1 className='text-3xl font-bold mb-2'>AI Suggestions Components</h1>
        <p className='text-muted-foreground'>
          Comprehensive showcase of AI-powered suggestion features
        </p>
      </div>

      <Tabs defaultValue='smart-suggestions' className='space-y-6'>
        <TabsList className='grid w-full grid-cols-5'>
          <TabsTrigger value='smart-suggestions'>Smart Suggestions</TabsTrigger>
          <TabsTrigger value='autocomplete'>Autocomplete</TabsTrigger>
          <TabsTrigger value='quick-actions'>Quick Actions</TabsTrigger>
          <TabsTrigger value='context-menu'>Context Menu</TabsTrigger>
          <TabsTrigger value='inline-edit'>Inline Edit</TabsTrigger>
        </TabsList>

        {/* Smart Suggestions Tab */}
        <TabsContent value='smart-suggestions' className='space-y-6'>
          <Card>
            <CardHeader>
              <CardTitle>Smart Suggestions Pills</CardTitle>
              <CardDescription>
                Floating suggestion chips with keyboard navigation
              </CardDescription>
            </CardHeader>
            <CardContent className='space-y-6'>
              <div className='space-y-4'>
                <div>
                  <h3 className='text-sm font-medium mb-3'>Pills Variant</h3>
                  <SmartSuggestions
                    suggestions={suggestions}
                    onSelect={suggestion =>
                      console.log('Selected:', suggestion.text)
                    }
                    onDismiss={id => console.log('Dismissed:', id)}
                    variant='pills'
                    showCategories={true}
                  />
                </div>

                <Separator />

                <div>
                  <h3 className='text-sm font-medium mb-3'>Chips Variant</h3>
                  <SmartSuggestions
                    suggestions={suggestions}
                    onSelect={suggestion =>
                      console.log('Selected:', suggestion.text)
                    }
                    variant='chips'
                    showCategories={true}
                  />
                </div>

                <Separator />

                <div>
                  <h3 className='text-sm font-medium mb-3'>Compact Variant</h3>
                  <SmartSuggestions
                    suggestions={suggestions}
                    onSelect={suggestion =>
                      console.log('Selected:', suggestion.text)
                    }
                    variant='compact'
                    showCategories={false}
                  />
                </div>

                <Separator />

                <div>
                  <h3 className='text-sm font-medium mb-3'>
                    Grouped by Category
                  </h3>
                  <GroupedSmartSuggestions
                    suggestions={suggestions}
                    onSelect={suggestion =>
                      console.log('Selected:', suggestion.text)
                    }
                    onDismiss={id => console.log('Dismissed:', id)}
                  />
                </div>
              </div>

              <div className='p-4 rounded-md bg-muted'>
                <p className='text-sm text-muted-foreground'>
                  <strong>Keyboard Navigation:</strong> Use Tab/Arrow keys to
                  navigate, Enter to select, Escape to clear selection
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Autocomplete Tab */}
        <TabsContent value='autocomplete' className='space-y-6'>
          <Card>
            <CardHeader>
              <CardTitle>AI Autocomplete</CardTitle>
              <CardDescription>
                Smart autocomplete with debounced API calls
              </CardDescription>
            </CardHeader>
            <CardContent className='space-y-6'>
              <div className='space-y-4'>
                <div>
                  <h3 className='text-sm font-medium mb-3'>
                    Dropdown Autocomplete
                  </h3>
                  <AutocompleteInput
                    value={autocompleteValue}
                    onChange={setAutocompleteValue}
                    onSelect={option => console.log('Selected:', option)}
                    placeholder='Type to search...'
                    fetchSuggestions={fetchAutocompleteSuggestions}
                    showConfidence={true}
                  />
                </div>

                <Separator />

                <div>
                  <h3 className='text-sm font-medium mb-3'>
                    Inline Autocomplete (Ghost Text)
                  </h3>
                  <InlineAutocomplete
                    value={inlineValue}
                    onChange={setInlineValue}
                    placeholder='Start typing for ghost text...'
                    fetchSuggestion={fetchInlineSuggestion}
                  />
                  <p className='text-xs text-muted-foreground mt-2'>
                    Press Tab or Right Arrow to accept suggestion
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Quick Actions Tab */}
        <TabsContent value='quick-actions' className='space-y-6'>
          <Card>
            <CardHeader>
              <CardTitle>Quick Action Buttons</CardTitle>
              <CardDescription>
                AI-powered action buttons with categories
              </CardDescription>
            </CardHeader>
            <CardContent className='space-y-6'>
              <div className='space-y-4'>
                <div>
                  <h3 className='text-sm font-medium mb-3'>Default Toolbar</h3>
                  <QuickActions
                    actions={quickActions}
                    variant='default'
                    showLabels={true}
                    showTooltips={true}
                  />
                </div>

                <Separator />

                <div>
                  <h3 className='text-sm font-medium mb-3'>Compact Toolbar</h3>
                  <QuickActions
                    actions={quickActions}
                    variant='compact'
                    showLabels={false}
                    showTooltips={true}
                  />
                </div>

                <Separator />

                <div>
                  <h3 className='text-sm font-medium mb-3'>
                    Categorized Actions
                  </h3>
                  <CategorizedQuickActions actions={quickActions} />
                </div>

                <Separator />

                <div>
                  <h3 className='text-sm font-medium mb-3'>
                    Floating Action Button
                  </h3>
                  <p className='text-sm text-muted-foreground mb-2'>
                    Check bottom-right corner (toggle to expand)
                  </p>
                  <FloatingQuickActions actions={quickActions.slice(0, 4)} />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Context Menu Tab */}
        <TabsContent value='context-menu' className='space-y-6'>
          <Card>
            <CardHeader>
              <CardTitle>AI Context Menu</CardTitle>
              <CardDescription>
                Right-click text for AI-powered actions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SmartContextMenu
                onAction={actionId => console.log('Action:', actionId)}
              >
                <div className='p-8 border-2 border-dashed rounded-lg text-center'>
                  <p className='text-lg mb-2'>
                    Right-click anywhere in this box to see AI actions
                  </p>
                  <p className='text-sm text-muted-foreground'>
                    Try selecting text first for context-aware suggestions
                  </p>
                  <div className='mt-4 p-4 bg-muted rounded-md'>
                    <p>
                      This is sample text you can select. The context menu will
                      show different actions based on what you select: regular
                      text, code snippets, or URLs.
                    </p>
                    <pre className='mt-2 p-2 bg-background rounded text-xs'>
                      function example() {'{'}
                      {'\n'}
                      {'  '}return "Select this code";
                      {'\n'}
                      {'}'}
                    </pre>
                    <p className='mt-2'>
                      Or try this link: https://example.com
                    </p>
                  </div>
                </div>
              </SmartContextMenu>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Inline Edit Tab */}
        <TabsContent value='inline-edit' className='space-y-6'>
          <Card>
            <CardHeader>
              <CardTitle>Inline Editing with AI</CardTitle>
              <CardDescription>
                Click text to edit with AI assistance
              </CardDescription>
            </CardHeader>
            <CardContent className='space-y-6'>
              <InlineEdit
                value={editValue}
                onChange={value => {
                  setEditValue(value);
                  setShowDiff(false);
                }}
                onAIEdit={handleAIEdit}
                showAIActions={true}
                aiInstructions={[
                  'Make it shorter',
                  'Make it longer',
                  'Simplify',
                  'Make it formal',
                  'Fix grammar',
                ]}
              />

              <Separator />

              {showDiff && (
                <InlineEditWithDiff
                  original='This is the original text before AI edits.'
                  edited='This represents the enhanced text after AI transformation has been applied.'
                  onAccept={() => {
                    console.log('Accepted changes');
                    setShowDiff(false);
                  }}
                  onReject={() => {
                    console.log('Rejected changes');
                    setShowDiff(false);
                  }}
                />
              )}

              <div className='p-4 rounded-md bg-muted'>
                <p className='text-sm text-muted-foreground'>
                  <strong>Features:</strong> Undo/Redo (⌘Z/⌘⇧Z), Save (⌘Enter),
                  Cancel (Esc), AI transformations, Character count
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
