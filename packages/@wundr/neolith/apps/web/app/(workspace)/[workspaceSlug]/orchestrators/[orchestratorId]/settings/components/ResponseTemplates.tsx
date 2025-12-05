'use client';

/**
 * Response Templates Component
 *
 * Manage predefined response templates for the orchestrator.
 */

import { Plus, Trash2, Edit, Eye, Power } from 'lucide-react';
import { useState } from 'react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
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
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
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
    (config?.responseTemplates as Record<string, ResponseTemplate>) || {}
  );
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [deleteTemplateId, setDeleteTemplateId] = useState<string | null>(null);
  const [editingTemplate, setEditingTemplate] =
    useState<ResponseTemplate | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    content: '',
    trigger: '',
    active: true,
  });

  const openDialog = (template?: ResponseTemplate) => {
    if (template) {
      setEditingTemplate(template);
      setFormData({
        name: template.name,
        content: template.content,
        trigger: template.trigger || '',
        active: template.active ?? true,
      });
    } else {
      setEditingTemplate(null);
      setFormData({ name: '', content: '', trigger: '', active: true });
    }
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingTemplate(null);
    setFormData({ name: '', content: '', trigger: '', active: true });
  };

  const saveTemplate = async () => {
    const id = editingTemplate?.id || `template_${Date.now()}`;
    const newTemplate: ResponseTemplate = {
      id,
      name: formData.name,
      content: formData.content,
      trigger: formData.trigger || undefined,
      active: formData.active,
    };

    const updatedTemplates = {
      ...templates,
      [id]: newTemplate,
    };

    setTemplates(updatedTemplates);
    closeDialog();

    // Auto-save after creating/updating template
    setIsSaving(true);
    try {
      await onSave({ responseTemplates: updatedTemplates });
    } finally {
      setIsSaving(false);
    }
  };

  const confirmDelete = (id: string) => {
    setDeleteTemplateId(id);
  };

  const deleteTemplate = async () => {
    if (!deleteTemplateId) {
      return;
    }

    const newTemplates = { ...templates };
    delete newTemplates[deleteTemplateId];
    setTemplates(newTemplates);
    setDeleteTemplateId(null);

    // Auto-save after deleting
    setIsSaving(true);
    try {
      await onSave({ responseTemplates: newTemplates });
    } finally {
      setIsSaving(false);
    }
  };

  const toggleTemplateActive = async (id: string) => {
    const template = templates[id];
    if (!template) {
      return;
    }

    const updatedTemplate = {
      ...template,
      active: !template.active,
    };

    const updatedTemplates = {
      ...templates,
      [id]: updatedTemplate,
    };

    setTemplates(updatedTemplates);

    // Auto-save after toggling
    setIsSaving(true);
    try {
      await onSave({ responseTemplates: updatedTemplates });
    } finally {
      setIsSaving(false);
    }
  };

  const openPreview = () => {
    setIsPreviewOpen(true);
  };

  return (
    <div className='space-y-6'>
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
                  disabled={disabled || isSaving}
                >
                  <Plus className='h-4 w-4 mr-2' />
                  Add Template
                </Button>
              </DialogTrigger>
              <DialogContent className='max-w-2xl max-h-[90vh] overflow-y-auto'>
                <DialogHeader>
                  <DialogTitle>
                    {editingTemplate ? 'Edit Template' : 'New Template'}
                  </DialogTitle>
                </DialogHeader>
                <div className='space-y-4'>
                  <div className='space-y-2'>
                    <Label htmlFor='template-name'>
                      Template Name <span className='text-destructive'>*</span>
                    </Label>
                    <Input
                      id='template-name'
                      value={formData.name}
                      onChange={e =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      placeholder='e.g., Welcome Message'
                      disabled={isSaving}
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
                      disabled={isSaving}
                    />
                    <p className='text-xs text-muted-foreground'>
                      Keyword that triggers this template automatically
                    </p>
                  </div>

                  <div className='space-y-2'>
                    <div className='flex items-center justify-between'>
                      <Label htmlFor='template-content'>
                        Content <span className='text-destructive'>*</span>
                      </Label>
                      <span className='text-xs text-muted-foreground'>
                        {formData.content.length} characters
                      </span>
                    </div>
                    <Textarea
                      id='template-content'
                      value={formData.content}
                      onChange={e =>
                        setFormData({ ...formData, content: e.target.value })
                      }
                      rows={8}
                      placeholder='Template content...'
                      disabled={isSaving}
                    />
                    <p className='text-xs text-muted-foreground'>
                      Use variables: {'{user}'}, {'{channel}'}, {'{date}'},{' '}
                      {'{time}'}
                    </p>
                  </div>

                  <div className='flex items-center justify-between space-x-2 rounded-lg border p-4'>
                    <div className='space-y-0.5'>
                      <Label htmlFor='template-active'>Active</Label>
                      <p className='text-sm text-muted-foreground'>
                        Enable this template for use
                      </p>
                    </div>
                    <Switch
                      id='template-active'
                      checked={formData.active}
                      onCheckedChange={active =>
                        setFormData({ ...formData, active })
                      }
                      disabled={isSaving}
                    />
                  </div>

                  <Separator />

                  <div className='flex justify-between gap-2'>
                    <Button
                      type='button'
                      variant='outline'
                      onClick={openPreview}
                      disabled={!formData.content || isSaving}
                    >
                      <Eye className='h-4 w-4 mr-2' />
                      Preview
                    </Button>
                    <div className='flex gap-2'>
                      <Button
                        type='button'
                        variant='outline'
                        onClick={closeDialog}
                        disabled={isSaving}
                      >
                        Cancel
                      </Button>
                      <Button
                        type='button'
                        onClick={saveTemplate}
                        disabled={
                          !formData.name || !formData.content || isSaving
                        }
                      >
                        {isSaving
                          ? 'Saving...'
                          : editingTemplate
                            ? 'Update'
                            : 'Create'}
                      </Button>
                    </div>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {Object.keys(templates).length === 0 ? (
            <div className='flex flex-col items-center justify-center py-12 text-center'>
              <div className='rounded-full bg-muted p-3 mb-4'>
                <Plus className='h-6 w-6 text-muted-foreground' />
              </div>
              <h3 className='font-semibold text-lg mb-2'>No templates yet</h3>
              <p className='text-muted-foreground max-w-sm mb-4'>
                Create reusable response templates to streamline common
                interactions and maintain consistency.
              </p>
              <Button
                type='button'
                onClick={() => openDialog()}
                disabled={disabled || isSaving}
                size='sm'
              >
                <Plus className='h-4 w-4 mr-2' />
                Create your first template
              </Button>
            </div>
          ) : (
            <div className='space-y-3'>
              {Object.entries(templates).map(([id, template]) => (
                <div
                  key={id}
                  className={`border rounded-lg p-4 transition-opacity ${
                    !template.active ? 'opacity-60' : ''
                  }`}
                >
                  <div className='flex items-start justify-between gap-4'>
                    <div className='flex-1 min-w-0'>
                      <div className='flex items-center gap-2 mb-1'>
                        <h4 className='font-medium truncate'>
                          {template.name}
                        </h4>
                        <Badge
                          variant={template.active ? 'default' : 'secondary'}
                        >
                          {template.active ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                      {template.trigger && (
                        <div className='text-sm text-muted-foreground mb-2 flex items-center gap-1'>
                          <span className='font-medium'>Trigger:</span>
                          <code className='bg-muted px-1.5 py-0.5 rounded text-xs'>
                            {template.trigger}
                          </code>
                        </div>
                      )}
                      <p className='text-sm text-muted-foreground line-clamp-2'>
                        {template.content}
                      </p>
                    </div>
                    <div className='flex items-center gap-1'>
                      <Button
                        type='button'
                        variant='ghost'
                        size='icon'
                        onClick={() => toggleTemplateActive(id)}
                        disabled={disabled || isSaving}
                        title={
                          template.active
                            ? 'Deactivate template'
                            : 'Activate template'
                        }
                      >
                        <Power
                          className={`h-4 w-4 ${
                            template.active
                              ? 'text-green-600'
                              : 'text-muted-foreground'
                          }`}
                        />
                      </Button>
                      <Button
                        type='button'
                        variant='ghost'
                        size='icon'
                        onClick={() => openDialog(template)}
                        disabled={disabled || isSaving}
                        title='Edit template'
                      >
                        <Edit className='h-4 w-4' />
                      </Button>
                      <Button
                        type='button'
                        variant='ghost'
                        size='icon'
                        onClick={() => confirmDelete(id)}
                        disabled={disabled || isSaving}
                        title='Delete template'
                      >
                        <Trash2 className='h-4 w-4 text-destructive' />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Preview Dialog */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className='max-w-2xl'>
          <DialogHeader>
            <DialogTitle>Template Preview</DialogTitle>
          </DialogHeader>
          <div className='space-y-4'>
            <div className='space-y-2'>
              <Label>Template Name</Label>
              <p className='text-sm font-medium'>{formData.name}</p>
            </div>
            {formData.trigger && (
              <div className='space-y-2'>
                <Label>Trigger Keyword</Label>
                <code className='text-sm bg-muted px-2 py-1 rounded'>
                  {formData.trigger}
                </code>
              </div>
            )}
            <Separator />
            <div className='space-y-2'>
              <Label>Rendered Content</Label>
              <div className='rounded-lg border bg-muted/50 p-4'>
                <p className='text-sm whitespace-pre-wrap'>
                  {formData.content}
                </p>
              </div>
            </div>
            <div className='flex justify-end'>
              <Button
                type='button'
                onClick={() => setIsPreviewOpen(false)}
                variant='outline'
              >
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={!!deleteTemplateId}
        onOpenChange={open => !open && setDeleteTemplateId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the template{' '}
              <strong>
                {deleteTemplateId && templates[deleteTemplateId]?.name}
              </strong>
              . This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSaving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={deleteTemplate}
              disabled={isSaving}
              className='bg-destructive text-destructive-foreground hover:bg-destructive/90'
            >
              {isSaving ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
