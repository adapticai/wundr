/**
 * Dual-Mode Editor Component
 * Provides both conversational and direct editing interfaces with seamless switching
 * @module components/wizard/dual-mode-editor
 */
'use client';

import {
  MessageSquare,
  Edit3,
  Sparkles,
  HelpCircle,
  Lightbulb,
  Save,
  AlertCircle,
} from 'lucide-react';
import * as React from 'react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

import {
  ConversationalWizard,
  type Message,
  type EntityData,
} from './conversational-wizard';

/**
 * Field configuration for dynamic form rendering
 */
export interface FieldConfig {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'email' | 'number' | 'url';
  placeholder?: string;
  required?: boolean;
  helpText?: string;
}

/**
 * Props for DualModeEditor
 */
export interface DualModeEditorProps {
  /** Type of entity being created/edited */
  entityType: string;
  /** Optional initial data for editing */
  initialData?: Partial<EntityData>;
  /** Callback when data is saved */
  onSave: (data: EntityData) => void;
  /** Initial mode (default: 'chat') */
  mode?: 'chat' | 'edit';
  /** Optional callback when mode changes */
  onModeChange?: (mode: 'chat' | 'edit') => void;
  /** Optional field configurations for edit mode */
  fieldConfigs?: FieldConfig[];
  /** Optional custom LLM handler */
  onSendMessage?: (
    message: string,
    history: Message[]
  ) => Promise<{ response: string; extractedData?: EntityData }>;
  /** Optional callback when AI assistance is requested for a field */
  onAskAI?: (
    field: string,
    currentValue: string,
    context: EntityData
  ) => Promise<string>;
  /** Enable auto-save to localStorage */
  autoSave?: boolean;
  /** LocalStorage key for auto-save (default: 'dual-mode-editor-draft') */
  storageKey?: string;
}

/**
 * DualModeEditor - Seamless interface between conversational and direct editing
 *
 * Features:
 * - Toggle between "Chat" and "Edit" modes
 * - Full ConversationalWizard integration in chat mode
 * - Direct form editing with AI assistance in edit mode
 * - Bidirectional sync between modes
 * - "Ask AI" button for field-specific suggestions
 * - "Explain this field" for clarification
 * - "Suggest improvements" for AI review
 * - Auto-save to localStorage
 * - Smooth transitions with state preservation
 */
export function DualModeEditor({
  entityType,
  initialData = {},
  onSave,
  mode: initialMode = 'chat',
  onModeChange,
  fieldConfigs,
  onSendMessage,
  onAskAI,
  autoSave = true,
  storageKey = 'dual-mode-editor-draft',
}: DualModeEditorProps) {
  const [activeMode, setActiveMode] = React.useState<'chat' | 'edit'>(
    initialMode
  );
  const [data, setData] = React.useState<EntityData>(initialData as EntityData);
  const [conversationHistory, setConversationHistory] = React.useState<
    Message[]
  >([]);
  const [isAILoading, setIsAILoading] = React.useState<Record<string, boolean>>(
    {}
  );
  const [aiSuggestions, setAISuggestions] = React.useState<
    Record<string, string>
  >({});
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [lastSaved, setLastSaved] = React.useState<Date | null>(null);

  // Generate default field configs if not provided
  const defaultFieldConfigs: FieldConfig[] = React.useMemo(
    () =>
      fieldConfigs || [
        {
          key: 'name',
          label: 'Name',
          type: 'text',
          placeholder: `Enter ${entityType} name`,
          required: true,
          helpText: 'A unique, descriptive name for this entity',
        },
        {
          key: 'description',
          label: 'Description',
          type: 'textarea',
          placeholder: `Describe the purpose of this ${entityType}`,
          required: true,
          helpText: 'Provide a clear description of what this entity does',
        },
      ],
    [fieldConfigs, entityType]
  );

  // Load draft from localStorage on mount
  React.useEffect(() => {
    if (autoSave) {
      const saved = localStorage.getItem(`${storageKey}-${entityType}`);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (parsed.data) {
            setData(parsed.data);
          }
          if (parsed.conversationHistory) {
            setConversationHistory(parsed.conversationHistory);
          }
        } catch (error) {
          console.error('Failed to load draft:', error);
        }
      }
    }
  }, [autoSave, storageKey, entityType]);

  // Auto-save to localStorage whenever data or conversation changes
  React.useEffect(() => {
    if (autoSave) {
      const draft = {
        data,
        conversationHistory,
        timestamp: new Date().toISOString(),
      };
      localStorage.setItem(
        `${storageKey}-${entityType}`,
        JSON.stringify(draft)
      );
      setLastSaved(new Date());
    }
  }, [data, conversationHistory, autoSave, storageKey, entityType]);

  /**
   * Handle mode change with state preservation
   */
  const handleModeChange = (newMode: 'chat' | 'edit') => {
    setActiveMode(newMode);
    onModeChange?.(newMode);
  };

  /**
   * Handle field value change in edit mode
   */
  const handleFieldChange = (field: string, value: string) => {
    const newData = { ...data, [field]: value };
    setData(newData);

    // Clear error for this field
    if (errors[field]) {
      setErrors(prev => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }

    // Clear AI suggestion when user edits
    if (aiSuggestions[field]) {
      setAISuggestions(prev => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  /**
   * Ask AI for help with a specific field
   */
  const handleAskAI = async (field: string) => {
    if (!onAskAI) {
      return;
    }

    setIsAILoading(prev => ({ ...prev, [field]: true }));

    try {
      const currentValue = (data[field] as string) || '';
      const suggestion = await onAskAI(field, currentValue, data);

      setAISuggestions(prev => ({ ...prev, [field]: suggestion }));
    } catch (error) {
      console.error('AI assistance failed:', error);
      setAISuggestions(prev => ({
        ...prev,
        [field]: 'Sorry, I could not generate a suggestion. Please try again.',
      }));
    } finally {
      setIsAILoading(prev => ({ ...prev, [field]: false }));
    }
  };

  /**
   * Apply AI suggestion to field
   */
  const handleApplySuggestion = (field: string) => {
    const suggestion = aiSuggestions[field];
    if (suggestion) {
      handleFieldChange(field, suggestion);
      setAISuggestions(prev => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  /**
   * Ask AI to explain a field
   */
  const handleExplainField = async (field: string) => {
    const fieldConfig = defaultFieldConfigs.find(f => f.key === field);
    if (!onAskAI) {
      return;
    }

    setIsAILoading(prev => ({ ...prev, [`explain-${field}`]: true }));

    try {
      const explanation = await onAskAI(
        `explain-${field}`,
        `What is the purpose of the "${fieldConfig?.label || field}" field for a ${entityType}?`,
        data
      );

      setAISuggestions(prev => ({
        ...prev,
        [`explain-${field}`]: explanation,
      }));
    } catch (error) {
      console.error('Explanation failed:', error);
    } finally {
      setIsAILoading(prev => ({ ...prev, [`explain-${field}`]: false }));
    }
  };

  /**
   * Ask AI to suggest improvements for all fields
   */
  const handleSuggestImprovements = async () => {
    if (!onAskAI) {
      return;
    }

    setIsAILoading(prev => ({ ...prev, improvements: true }));

    try {
      const currentData = JSON.stringify(data, null, 2);
      const improvements = await onAskAI(
        'improvements',
        `Review and suggest improvements for this ${entityType}: ${currentData}`,
        data
      );

      setAISuggestions(prev => ({ ...prev, improvements }));
    } catch (error) {
      console.error('Improvement suggestions failed:', error);
    } finally {
      setIsAILoading(prev => ({ ...prev, improvements: false }));
    }
  };

  /**
   * Validate form data
   */
  const validateData = (): boolean => {
    const newErrors: Record<string, string> = {};

    defaultFieldConfigs.forEach(field => {
      if (field.required && !data[field.key]) {
        newErrors[field.key] = `${field.label} is required`;
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  /**
   * Handle save
   */
  const handleSave = () => {
    if (validateData()) {
      onSave(data);
      // Clear localStorage draft on successful save
      if (autoSave) {
        localStorage.removeItem(`${storageKey}-${entityType}`);
      }
    }
  };

  return (
    <Card className='flex h-[80vh] flex-col overflow-hidden'>
      <Tabs
        value={activeMode}
        onValueChange={v => handleModeChange(v as 'chat' | 'edit')}
      >
        {/* Header with mode switcher */}
        <CardHeader className='border-b pb-4'>
          <div className='flex items-center justify-between'>
            <div>
              <h2 className='text-xl font-semibold'>
                {initialData?.name ? 'Edit' : 'Create'} {entityType}
              </h2>
              <p className='text-sm text-muted-foreground'>
                {activeMode === 'chat'
                  ? 'Describe what you want in natural language'
                  : 'Edit fields directly or get AI assistance'}
              </p>
            </div>
            <div className='flex items-center gap-4'>
              {autoSave && lastSaved && (
                <div className='flex items-center gap-2 text-xs text-muted-foreground'>
                  <Save className='h-3 w-3' />
                  <span>Saved {lastSaved.toLocaleTimeString()}</span>
                </div>
              )}
              <TabsList className='grid w-[240px] grid-cols-2'>
                <TabsTrigger value='chat' className='flex items-center gap-2'>
                  <MessageSquare className='h-4 w-4' />
                  Chat
                </TabsTrigger>
                <TabsTrigger value='edit' className='flex items-center gap-2'>
                  <Edit3 className='h-4 w-4' />
                  Edit
                </TabsTrigger>
              </TabsList>
            </div>
          </div>
        </CardHeader>

        {/* Chat Mode */}
        <TabsContent value='chat' className='m-0 h-full'>
          <ConversationalWizard
            entityType={entityType as any}
            onComplete={handleSave}
            onCancel={() => {}}
            initialData={data}
            onSendMessage={onSendMessage}
          />
        </TabsContent>

        {/* Edit Mode */}
        <TabsContent value='edit' className='m-0 h-full overflow-hidden'>
          <div className='flex h-full flex-col'>
            {/* AI Improvements Panel */}
            {aiSuggestions.improvements && (
              <div className='border-b bg-muted/50 px-6 py-3'>
                <Alert>
                  <Lightbulb className='h-4 w-4' />
                  <AlertDescription className='text-sm'>
                    {aiSuggestions.improvements}
                  </AlertDescription>
                </Alert>
              </div>
            )}

            {/* Form Content */}
            <div className='flex-1 overflow-y-auto px-6 py-4'>
              <div className='mx-auto max-w-3xl space-y-6'>
                {/* AI Assistance Info */}
                <Alert>
                  <Sparkles className='h-4 w-4' />
                  <AlertDescription>
                    Click the AI button next to any field to get suggestions or
                    explanations.
                  </AlertDescription>
                </Alert>

                {/* Dynamic Form Fields */}
                {defaultFieldConfigs.map(field => (
                  <div key={field.key} className='space-y-2'>
                    <div className='flex items-center justify-between'>
                      <Label
                        htmlFor={field.key}
                        className={cn(field.required && 'required')}
                      >
                        {field.label}
                        {field.required && (
                          <span className='ml-1 text-destructive'>*</span>
                        )}
                      </Label>
                      <div className='flex gap-2'>
                        {onAskAI && (
                          <>
                            <Button
                              type='button'
                              variant='ghost'
                              size='sm'
                              onClick={() => handleExplainField(field.key)}
                              disabled={isAILoading[`explain-${field.key}`]}
                              title='Explain this field'
                            >
                              <HelpCircle className='h-4 w-4' />
                            </Button>
                            <Button
                              type='button'
                              variant='outline'
                              size='sm'
                              onClick={() => handleAskAI(field.key)}
                              disabled={isAILoading[field.key]}
                            >
                              {isAILoading[field.key] ? (
                                <>Loading...</>
                              ) : (
                                <>
                                  <Sparkles className='mr-1 h-3 w-3' />
                                  Ask AI
                                </>
                              )}
                            </Button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Explanation */}
                    {aiSuggestions[`explain-${field.key}`] && (
                      <Alert className='mt-2'>
                        <HelpCircle className='h-4 w-4' />
                        <AlertDescription className='text-xs'>
                          {aiSuggestions[`explain-${field.key}`]}
                        </AlertDescription>
                      </Alert>
                    )}

                    {/* Field Input */}
                    {field.type === 'textarea' ? (
                      <Textarea
                        id={field.key}
                        value={(data[field.key] as string) || ''}
                        onChange={e =>
                          handleFieldChange(field.key, e.target.value)
                        }
                        placeholder={field.placeholder}
                        className={cn(
                          errors[field.key] && 'border-destructive'
                        )}
                        rows={4}
                      />
                    ) : (
                      <Input
                        id={field.key}
                        type={field.type}
                        value={(data[field.key] as string) || ''}
                        onChange={e =>
                          handleFieldChange(field.key, e.target.value)
                        }
                        placeholder={field.placeholder}
                        className={cn(
                          errors[field.key] && 'border-destructive'
                        )}
                      />
                    )}

                    {/* Help Text */}
                    {field.helpText && (
                      <p className='text-xs text-muted-foreground'>
                        {field.helpText}
                      </p>
                    )}

                    {/* Error */}
                    {errors[field.key] && (
                      <p className='flex items-center gap-1 text-xs text-destructive'>
                        <AlertCircle className='h-3 w-3' />
                        {errors[field.key]}
                      </p>
                    )}

                    {/* AI Suggestion */}
                    {aiSuggestions[field.key] && (
                      <div className='mt-2 rounded-md border border-primary/20 bg-primary/5 p-3'>
                        <div className='flex items-start justify-between gap-2'>
                          <div className='flex-1'>
                            <div className='mb-1 flex items-center gap-2'>
                              <Sparkles className='h-3 w-3 text-primary' />
                              <span className='text-xs font-medium text-primary'>
                                AI Suggestion
                              </span>
                            </div>
                            <p className='text-sm'>
                              {aiSuggestions[field.key]}
                            </p>
                          </div>
                          <Button
                            type='button'
                            variant='default'
                            size='sm'
                            onClick={() => handleApplySuggestion(field.key)}
                          >
                            Apply
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {/* Additional Dynamic Fields */}
                {Object.keys(data)
                  .filter(
                    key =>
                      !defaultFieldConfigs.find(f => f.key === key) &&
                      typeof data[key] === 'string'
                  )
                  .map(key => (
                    <div key={key} className='space-y-2'>
                      <Label htmlFor={key}>
                        {key.charAt(0).toUpperCase() +
                          key.slice(1).replace(/([A-Z])/g, ' $1')}
                      </Label>
                      <Input
                        id={key}
                        value={(data[key] as string) || ''}
                        onChange={e => handleFieldChange(key, e.target.value)}
                      />
                    </div>
                  ))}
              </div>
            </div>

            {/* Footer Actions */}
            <div className='border-t px-6 py-4'>
              <div className='flex items-center justify-between'>
                <div className='flex gap-2'>
                  {onAskAI && (
                    <Button
                      type='button'
                      variant='outline'
                      onClick={handleSuggestImprovements}
                      disabled={isAILoading.improvements}
                    >
                      {isAILoading.improvements ? (
                        <>Analyzing...</>
                      ) : (
                        <>
                          <Lightbulb className='mr-2 h-4 w-4' />
                          Suggest Improvements
                        </>
                      )}
                    </Button>
                  )}
                </div>
                <div className='flex gap-2'>
                  <Button
                    type='button'
                    variant='outline'
                    onClick={() => handleModeChange('chat')}
                  >
                    Switch to Chat
                  </Button>
                  <Button type='button' onClick={handleSave}>
                    <Save className='mr-2 h-4 w-4' />
                    Save {entityType}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </Card>
  );
}
