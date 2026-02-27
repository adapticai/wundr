'use client';

/**
 * Workflow Templates Page
 *
 * Displays the workflow template gallery and allows users to create
 * workflows from pre-built templates.
 */

import { ArrowLeft, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { TemplateGallery, TemplateConfigurator } from '@/components/workflow';
import { useToast } from '@/hooks/use-toast';
import { useWorkflowTemplate } from '@/hooks/use-workflow-template';

import type { WorkflowTemplate } from '@/types/workflow';

export default function WorkflowTemplatesPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [showConfigurator, setShowConfigurator] = useState(false);

  const {
    selectedTemplate,
    variableValues,
    isCreating,
    selectTemplate,
    updateVariable,
    clearTemplate,
    createAndEdit,
  } = useWorkflowTemplate({
    onWorkflowCreated: () => {
      toast({
        title: 'Workflow created',
        description: 'Your workflow has been created from the template.',
      });
    },
    onError: error => {
      toast({
        title: 'Failed to create workflow',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleUseTemplate = (template: WorkflowTemplate) => {
    selectTemplate(template);
    setShowConfigurator(true);
  };

  const handleConfigureComplete = async (workflowName: string) => {
    try {
      await createAndEdit(workflowName);
      setShowConfigurator(false);
    } catch (error) {
      // Error is handled by the hook's onError callback
      console.error('Failed to create workflow:', error);
    }
  };

  const handleConfigureCancel = () => {
    setShowConfigurator(false);
    clearTemplate();
  };

  return (
    <div className='container mx-auto py-8'>
      {/* Header */}
      <div className='mb-8'>
        <Button
          variant='ghost'
          size='sm'
          onClick={() => router.back()}
          className='mb-4'
        >
          <ArrowLeft className='mr-2 h-4 w-4' />
          Back to Workflows
        </Button>

        <div className='flex items-center gap-3'>
          <div className='flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10'>
            <Sparkles className='h-6 w-6 text-primary' />
          </div>
          <div>
            <h1 className='text-3xl font-bold tracking-tight'>
              Workflow Templates
            </h1>
            <p className='text-muted-foreground'>
              Choose from our collection of pre-built workflow templates to get
              started quickly
            </p>
          </div>
        </div>
      </div>

      {/* Template Gallery */}
      <TemplateGallery onUseTemplate={handleUseTemplate} />

      {/* Configuration Dialog */}
      <Dialog open={showConfigurator} onOpenChange={setShowConfigurator}>
        <DialogContent className='max-h-[90vh] max-w-2xl overflow-y-auto'>
          {selectedTemplate && (
            <>
              <DialogHeader>
                <DialogTitle>Configure Template</DialogTitle>
                <DialogDescription>
                  {selectedTemplate.description}
                </DialogDescription>
              </DialogHeader>
              <TemplateConfigurator
                template={selectedTemplate}
                values={variableValues}
                onValueChange={updateVariable}
                onComplete={handleConfigureComplete}
                onCancel={handleConfigureCancel}
                isLoading={isCreating}
              />
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
