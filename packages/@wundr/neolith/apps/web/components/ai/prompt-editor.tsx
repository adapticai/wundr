/**
 * AI Prompt Template Editor Component
 *
 * Full-featured editor for creating and editing prompt templates with:
 * - Variable detection and management
 * - Live preview with variable interpolation
 * - Category and tag selection
 * - Validation
 * - Version history
 *
 * @module components/ai/prompt-editor
 */

'use client';

import {
  Save,
  X,
  Plus,
  Trash2,
  Eye,
  Code,
  Tag as TagIcon,
  AlertCircle,
  History,
} from 'lucide-react';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import {
  PROMPT_CATEGORIES,
  extractVariables,
  interpolatePrompt,
  type PromptTemplate,
  type PromptVariable,
  type PromptCategory,
} from '@/lib/ai/prompt-templates';

interface PromptEditorProps {
  template?: PromptTemplate;
  workspaceId?: string;
  onSave?: (template: PromptTemplate) => void;
  onCancel?: () => void;
  className?: string;
}

export function PromptEditor({
  template,
  workspaceId,
  onSave,
  onCancel,
  className,
}: PromptEditorProps) {
  const [name, setName] = React.useState(template?.name || '');
  const [description, setDescription] = React.useState(
    template?.description || ''
  );
  const [category, setCategory] = React.useState<PromptCategory>(
    (template?.category as PromptCategory) || 'custom'
  );
  const [content, setContent] = React.useState(template?.content || '');
  const [tags, setTags] = React.useState<string[]>(template?.tags || []);
  const [isPublic, setIsPublic] = React.useState(template?.isPublic || false);
  const [variables, setVariables] = React.useState<PromptVariable[]>(
    template?.variables || []
  );
  const [newTag, setNewTag] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [errors, setErrors] = React.useState<string[]>([]);
  const [showPreview, setShowPreview] = React.useState(false);
  const [previewValues, setPreviewValues] = React.useState<
    Record<string, string>
  >({});
  const [showVersions, setShowVersions] = React.useState(false);
  const [versions, setVersions] = React.useState<any[]>([]);

  // Auto-detect variables when content changes
  React.useEffect(() => {
    const detected = extractVariables(content);
    const existingVarNames = new Set(variables.map(v => v.name));

    // Add new variables
    const newVariables = detected
      .filter(name => !existingVarNames.has(name))
      .map(name => ({
        name,
        description: `Variable: ${name}`,
        required: true,
        type: 'string' as const,
      }));

    if (newVariables.length > 0) {
      setVariables(prev => [...prev, ...newVariables]);
    }

    // Remove variables not in content anymore
    setVariables(prev => prev.filter(v => detected.includes(v.name)));

    // Initialize preview values
    setPreviewValues(prev => {
      const newValues = { ...prev };
      detected.forEach(name => {
        if (!newValues[name]) {
          const variable = variables.find(v => v.name === name);
          newValues[name] = variable?.defaultValue || '';
        }
      });
      return newValues;
    });
  }, [content]);

  // Load version history
  React.useEffect(() => {
    if (template && !template.id.startsWith('system-')) {
      fetchVersions();
    }
  }, [template]);

  const fetchVersions = async () => {
    if (!template) return;

    try {
      const response = await fetch(`/api/ai/prompts/${template.id}`);
      if (!response.ok) throw new Error('Failed to fetch versions');

      const data = await response.json();
      setVersions(data.data.versions || []);
    } catch (error) {
      console.error('Error fetching versions:', error);
    }
  };

  // Validate form
  const validate = (): boolean => {
    const newErrors: string[] = [];

    if (!name.trim()) newErrors.push('Name is required');
    if (!description.trim()) newErrors.push('Description is required');
    if (!content.trim()) newErrors.push('Content is required');

    setErrors(newErrors);
    return newErrors.length === 0;
  };

  // Handle save
  const handleSave = async () => {
    if (!validate()) return;

    try {
      setSaving(true);

      const body = {
        name: name.trim(),
        description: description.trim(),
        category,
        content: content.trim(),
        tags,
        isPublic,
        variables,
        workspaceId,
      };

      const url = template
        ? `/api/ai/prompts/${template.id}`
        : '/api/ai/prompts';

      const method = template ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) throw new Error('Failed to save template');

      const data = await response.json();
      onSave?.(data.data);
    } catch (error) {
      console.error('Error saving template:', error);
      setErrors(['Failed to save template. Please try again.']);
    } finally {
      setSaving(false);
    }
  };

  // Handle tag add
  const handleAddTag = () => {
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      setTags([...tags, newTag.trim()]);
      setNewTag('');
    }
  };

  // Handle tag remove
  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter(t => t !== tag));
  };

  // Update variable
  const updateVariable = (index: number, updates: Partial<PromptVariable>) => {
    setVariables(prev =>
      prev.map((v, i) => (i === index ? { ...v, ...updates } : v))
    );
  };

  // Generate preview
  const preview = React.useMemo(() => {
    try {
      return interpolatePrompt(content, previewValues);
    } catch {
      return content;
    }
  }, [content, previewValues]);

  return (
    <div className={cn('flex flex-col space-y-6', className)}>
      {/* Header */}
      <div className='flex items-center justify-between'>
        <div>
          <h2 className='text-2xl font-bold'>
            {template ? 'Edit' : 'Create'} Prompt Template
          </h2>
          <p className='text-sm text-muted-foreground'>
            {template
              ? `Editing "${template.name}"`
              : 'Create a new reusable prompt template'}
          </p>
        </div>
        <div className='flex items-center gap-2'>
          {template && !template.id.startsWith('system-') && (
            <Button variant='outline' onClick={() => setShowVersions(true)}>
              <History className='mr-2 h-4 w-4' />
              Version History
            </Button>
          )}
          {onCancel && (
            <Button variant='outline' onClick={onCancel}>
              <X className='mr-2 h-4 w-4' />
              Cancel
            </Button>
          )}
          <Button onClick={handleSave} disabled={saving}>
            <Save className='mr-2 h-4 w-4' />
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>

      {/* Errors */}
      {errors.length > 0 && (
        <Alert variant='destructive'>
          <AlertCircle className='h-4 w-4' />
          <AlertDescription>
            <ul className='list-disc list-inside'>
              {errors.map((error, i) => (
                <li key={i}>{error}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <div className='grid gap-6 lg:grid-cols-3'>
        {/* Editor Panel */}
        <div className='lg:col-span-2 space-y-6'>
          {/* Basic Info */}
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
            </CardHeader>
            <CardContent className='space-y-4'>
              <div className='space-y-2'>
                <Label htmlFor='name'>Template Name*</Label>
                <Input
                  id='name'
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder='e.g., Code Reviewer'
                  maxLength={100}
                />
              </div>

              <div className='space-y-2'>
                <Label htmlFor='description'>Description*</Label>
                <Textarea
                  id='description'
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder='Brief description of what this template does'
                  rows={2}
                  maxLength={500}
                />
              </div>

              <div className='grid gap-4 sm:grid-cols-2'>
                <div className='space-y-2'>
                  <Label htmlFor='category'>Category</Label>
                  <Select
                    value={category}
                    onValueChange={(v: any) => setCategory(v)}
                  >
                    <SelectTrigger id='category'>
                      <SelectValue placeholder='Select category' />
                    </SelectTrigger>
                    <SelectContent>
                      {(
                        Object.entries(PROMPT_CATEGORIES) as [
                          PromptCategory,
                          (typeof PROMPT_CATEGORIES)[PromptCategory],
                        ][]
                      ).map(([key, { label, icon }]) => (
                        <SelectItem key={key} value={key}>
                          <span className='mr-2'>{icon}</span>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className='flex items-center space-x-2'>
                  <Switch
                    id='public'
                    checked={isPublic}
                    onCheckedChange={setIsPublic}
                  />
                  <Label htmlFor='public' className='cursor-pointer'>
                    Make template public
                  </Label>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Content Editor */}
          <Card>
            <CardHeader>
              <div className='flex items-center justify-between'>
                <div>
                  <CardTitle>Template Content</CardTitle>
                  <CardDescription>
                    Use {'{{variable}}'} syntax for variables
                  </CardDescription>
                </div>
                <Button
                  variant='outline'
                  size='sm'
                  onClick={() => setShowPreview(!showPreview)}
                >
                  {showPreview ? (
                    <Code className='mr-2 h-4 w-4' />
                  ) : (
                    <Eye className='mr-2 h-4 w-4' />
                  )}
                  {showPreview ? 'Editor' : 'Preview'}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {showPreview ? (
                <div className='prose prose-sm max-w-none border rounded-lg p-4 min-h-[300px] bg-muted/50'>
                  <pre className='whitespace-pre-wrap font-sans text-sm'>
                    {preview}
                  </pre>
                </div>
              ) : (
                <Textarea
                  value={content}
                  onChange={e => setContent(e.target.value)}
                  placeholder='Enter your prompt template here. Use {{variable}} for dynamic values.'
                  rows={12}
                  className='font-mono text-sm'
                />
              )}
            </CardContent>
          </Card>

          {/* Tags */}
          <Card>
            <CardHeader>
              <CardTitle>Tags</CardTitle>
              <CardDescription>
                Add tags to help organize and find this template
              </CardDescription>
            </CardHeader>
            <CardContent className='space-y-4'>
              <div className='flex gap-2'>
                <Input
                  value={newTag}
                  onChange={e => setNewTag(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddTag()}
                  placeholder='Add a tag...'
                />
                <Button onClick={handleAddTag} variant='outline'>
                  <Plus className='h-4 w-4' />
                </Button>
              </div>

              {tags.length > 0 && (
                <div className='flex flex-wrap gap-2'>
                  {tags.map(tag => (
                    <Badge key={tag} variant='secondary' className='pl-2 pr-1'>
                      <TagIcon className='mr-1 h-3 w-3' />
                      {tag}
                      <button
                        onClick={() => handleRemoveTag(tag)}
                        className='ml-1 hover:text-destructive'
                      >
                        <X className='h-3 w-3' />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Variables Panel */}
        <div className='space-y-6'>
          <Card>
            <CardHeader>
              <CardTitle>Variables ({variables.length})</CardTitle>
              <CardDescription>Configure detected variables</CardDescription>
            </CardHeader>
            <CardContent className='space-y-4'>
              {variables.length === 0 ? (
                <p className='text-sm text-muted-foreground text-center py-4'>
                  No variables detected. Use {'{{variable}}'} in your template.
                </p>
              ) : (
                variables.map((variable, index) => (
                  <div
                    key={variable.name}
                    className='space-y-3 p-3 border rounded-lg'
                  >
                    <div className='flex items-center justify-between'>
                      <code className='text-sm font-mono bg-muted px-2 py-1 rounded'>
                        {'{{'}
                        {variable.name}
                        {'}}'}
                      </code>
                      <Switch
                        checked={variable.required}
                        onCheckedChange={checked =>
                          updateVariable(index, { required: checked })
                        }
                      />
                    </div>

                    <Input
                      value={variable.description}
                      onChange={e =>
                        updateVariable(index, { description: e.target.value })
                      }
                      placeholder='Description'
                      className='text-sm'
                    />

                    <Select
                      value={variable.type}
                      onValueChange={(v: any) =>
                        updateVariable(index, { type: v })
                      }
                    >
                      <SelectTrigger className='text-sm'>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value='string'>String</SelectItem>
                        <SelectItem value='number'>Number</SelectItem>
                        <SelectItem value='boolean'>Boolean</SelectItem>
                        <SelectItem value='array'>Array</SelectItem>
                      </SelectContent>
                    </Select>

                    <Input
                      value={variable.defaultValue || ''}
                      onChange={e =>
                        updateVariable(index, { defaultValue: e.target.value })
                      }
                      placeholder='Default value (optional)'
                      className='text-sm'
                    />
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Preview Values */}
          {showPreview && variables.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Preview Values</CardTitle>
                <CardDescription>Fill values to preview output</CardDescription>
              </CardHeader>
              <CardContent className='space-y-3'>
                {variables.map(variable => (
                  <div key={variable.name} className='space-y-1'>
                    <Label className='text-xs font-mono'>{variable.name}</Label>
                    <Input
                      value={previewValues[variable.name] || ''}
                      onChange={e =>
                        setPreviewValues(prev => ({
                          ...prev,
                          [variable.name]: e.target.value,
                        }))
                      }
                      placeholder={variable.description}
                      className='text-sm'
                    />
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Version History Dialog */}
      <Dialog open={showVersions} onOpenChange={setShowVersions}>
        <DialogContent className='max-w-2xl max-h-[80vh] overflow-y-auto'>
          <DialogHeader>
            <DialogTitle>Version History</DialogTitle>
            <DialogDescription>
              View previous versions of this template
            </DialogDescription>
          </DialogHeader>

          <div className='space-y-4'>
            {versions.map(version => (
              <Card key={version.version}>
                <CardHeader>
                  <div className='flex items-center justify-between'>
                    <CardTitle className='text-base'>
                      Version {version.version}
                    </CardTitle>
                    <Badge variant='secondary'>
                      {new Date(version.createdAt).toLocaleDateString()}
                    </Badge>
                  </div>
                  {version.changeLog && (
                    <CardDescription>{version.changeLog}</CardDescription>
                  )}
                </CardHeader>
                <CardContent>
                  <pre className='text-xs bg-muted p-3 rounded overflow-x-auto'>
                    {version.content}
                  </pre>
                  <p className='text-xs text-muted-foreground mt-2'>
                    by {version.createdBy.name}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
