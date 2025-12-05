'use client';

/**
 * Response Templates Component
 *
 * Manage predefined response templates for the orchestrator.
 */

import { Plus, Trash2, Edit } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

import type { ResponseTemplate } from '@/lib/validations/orchestrator-config';

interface ResponseTemplatesProps {
  config: any;
  onSave: (data: Record<string, unknown>) => Promise<void>;
  disabled?: boolean;
}

export function ResponseTemplates({
  config,
  onSave,
  disabled,
}: ResponseTemplatesProps) {
  const [templates, setTemplates] = useState<Record<string, ResponseTemplate>>(
    (config?.responseTemplates as Record<string, ResponseTemplate>) || {},
  );
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] =
    useState<ResponseTemplate | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    content: '',
    trigger: '',
  });

  const openDialog = (template?: ResponseTemplate) => {
    if (template) {
      setEditingTemplate(template);
      setFormData({
        name: template.name,
        content: template.content,
        trigger: template.trigger || '',
      });
    } else {
      setEditingTemplate(null);
      setFormData({ name: '', content: '', trigger: '' });
    }
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingTemplate(null);
    setFormData({ name: '', content: '', trigger: '' });
  };

  const saveTemplate = () => {
    const id = editingTemplate?.id || `template_${Date.now()}`;
    const newTemplate: ResponseTemplate = {
      id,
      name: formData.name,
      content: formData.content,
      trigger: formData.trigger || undefined,
      active: true,
    };

    setTemplates({
      ...templates,
      [id]: newTemplate,
    });

    closeDialog();
  };

  const deleteTemplate = (id: string) => {
    const newTemplates = { ...templates };
    delete newTemplates[id];
    setTemplates(newTemplates);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await onSave({ responseTemplates: templates });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className='space-y-6'>
      <Card>
        <CardHeader>
          <div className='flex items-center justify-between'>
            <div>
              <CardTitle>Response Templates</CardTitle>
              <CardDescription>
                Create reusable response templates for common scenarios
              </CardDescription>
            </div>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  type='button'
                  onClick={() => openDialog()}
                  disabled={disabled}
                >
                  <Plus className='h-4 w-4 mr-2' />
                  Add Template
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>
                    {editingTemplate ? 'Edit Template' : 'New Template'}
                  </DialogTitle>
                </DialogHeader>
                <div className='space-y-4'>
                  <div className='space-y-2'>
                    <Label htmlFor='template-name'>Template Name</Label>
                    <Input
                      id='template-name'
                      value={formData.name}
                      onChange={e =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      placeholder='e.g., Welcome Message'
                    />
                  </div>

                  <div className='space-y-2'>
                    <Label htmlFor='template-trigger'>Trigger (optional)</Label>
                    <Input
                      id='template-trigger'
                      value={formData.trigger}
                      onChange={e =>
                        setFormData({ ...formData, trigger: e.target.value })
                      }
                      placeholder='e.g., welcome, help'
                    />
                    <p className='text-xs text-muted-foreground'>
                      Keyword that triggers this template
                    </p>
                  </div>

                  <div className='space-y-2'>
                    <Label htmlFor='template-content'>Content</Label>
                    <Textarea
                      id='template-content'
                      value={formData.content}
                      onChange={e =>
                        setFormData({ ...formData, content: e.target.value })
                      }
                      rows={6}
                      placeholder='Template content...'
                    />
                    <p className='text-xs text-muted-foreground'>
                      Use variables like {'{user}'}, {'{channel}'}, {'{date}'}
                    </p>
                  </div>

                  <div className='flex justify-end gap-2'>
                    <Button
                      type='button'
                      variant='outline'
                      onClick={closeDialog}
                    >
                      Cancel
                    </Button>
                    <Button
                      type='button'
                      onClick={saveTemplate}
                      disabled={!formData.name || !formData.content}
                    >
                      {editingTemplate ? 'Update' : 'Create'}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {Object.keys(templates).length === 0 ? (
            <div className='text-center py-8 text-muted-foreground'>
              No templates created yet. Click "Add Template" to create one.
            </div>
          ) : (
            <div className='space-y-4'>
              {Object.entries(templates).map(([id, template]) => (
                <div key={id} className='border rounded-lg p-4'>
                  <div className='flex items-start justify-between gap-4'>
                    <div className='flex-1'>
                      <div className='font-medium'>{template.name}</div>
                      {template.trigger && (
                        <div className='text-sm text-muted-foreground mt-1'>
                          Trigger: {template.trigger}
                        </div>
                      )}
                      <div className='text-sm mt-2 text-muted-foreground line-clamp-2'>
                        {template.content}
                      </div>
                    </div>
                    <div className='flex gap-2'>
                      <Button
                        type='button'
                        variant='ghost'
                        size='sm'
                        onClick={() => openDialog(template)}
                        disabled={disabled}
                      >
                        <Edit className='h-4 w-4' />
                      </Button>
                      <Button
                        type='button'
                        variant='ghost'
                        size='sm'
                        onClick={() => deleteTemplate(id)}
                        disabled={disabled}
                      >
                        <Trash2 className='h-4 w-4' />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className='flex justify-end'>
        <Button type='submit' disabled={disabled || isSaving}>
          {isSaving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </form>
  );
}
