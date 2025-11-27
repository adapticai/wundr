/**
 * Example Usage of ConversationalWizard
 * @module components/wizard/example-usage
 */
'use client';

import * as React from 'react';
import { ConversationalWizard } from './conversational-wizard';
import type { EntityData, Message } from './conversational-wizard';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

/**
 * Example 1: Basic Usage with Default Mock Handler
 */
export function BasicWizardExample() {
  const [isOpen, setIsOpen] = React.useState(false);

  const handleComplete = (data: EntityData) => {
    console.log('Entity created:', data);
    // Call your API to create the entity
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button>Create Workspace</Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl">
        <ConversationalWizard
          entityType="workspace"
          onComplete={handleComplete}
          onCancel={() => setIsOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

/**
 * Example 2: With Custom LLM API Integration
 */
export function CustomLLMWizardExample() {
  const [isOpen, setIsOpen] = React.useState(false);

  const handleSendMessage = async (
    message: string,
    history: Message[]
  ): Promise<{ response: string; extractedData?: EntityData }> => {
    try {
      // Call your LLM API endpoint
      const response = await fetch('/api/creation/conversation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entityType: 'orchestrator',
          messages: history.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          message,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get AI response');
      }

      const data = await response.json();

      return {
        response: data.message,
        extractedData: data.spec
          ? {
              name: data.spec.name,
              description: data.spec.description,
              role: data.spec.role,
              charter: data.spec.charter,
            }
          : undefined,
      };
    } catch (error) {
      console.error('Error calling LLM API:', error);
      return {
        response: 'Sorry, I encountered an error. Please try again.',
      };
    }
  };

  const handleComplete = async (data: EntityData) => {
    try {
      // Call your API to create the orchestrator
      const response = await fetch('/api/workspaces/123/orchestrators', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (response.ok) {
        console.log('Orchestrator created successfully');
        setIsOpen(false);
      }
    } catch (error) {
      console.error('Failed to create orchestrator:', error);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button>Create Orchestrator</Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl">
        <ConversationalWizard
          entityType="orchestrator"
          onComplete={handleComplete}
          onCancel={() => setIsOpen(false)}
          onSendMessage={handleSendMessage}
          initialContext="I need help creating a new orchestrator agent."
        />
      </DialogContent>
    </Dialog>
  );
}

/**
 * Example 3: Workflow Creation with Initial Context
 */
export function WorkflowWizardExample() {
  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">Create Workflow</Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl">
        <ConversationalWizard
          entityType="workflow"
          onComplete={(data) => {
            console.log('Workflow data:', data);
            setIsOpen(false);
          }}
          onCancel={() => setIsOpen(false)}
          initialContext="Let's create a workflow to automate your processes. What would you like to automate?"
        />
      </DialogContent>
    </Dialog>
  );
}

/**
 * Example 4: Edit Mode with Initial Data
 */
export function EditEntityWizardExample() {
  const [isOpen, setIsOpen] = React.useState(false);

  const existingData: EntityData = {
    name: 'Customer Support Agent',
    description: 'Handles customer inquiries and support tickets',
    role: 'Customer Support Lead',
    charter: 'Respond to customer inquiries within 5 minutes...',
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary">Edit Orchestrator</Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl">
        <ConversationalWizard
          entityType="orchestrator"
          initialData={existingData}
          onComplete={(data) => {
            console.log('Updated data:', data);
            setIsOpen(false);
          }}
          onCancel={() => setIsOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

/**
 * Example 5: Session Manager Creation
 */
export function SessionManagerWizardExample() {
  const [isOpen, setIsOpen] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const handleComplete = async (data: EntityData) => {
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/workspaces/123/session-managers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (response.ok) {
        const result = await response.json();
        console.log('Session manager created:', result);
        setIsOpen(false);
      } else {
        console.error('Failed to create session manager');
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button>Create Session Manager</Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl">
        <ConversationalWizard
          entityType="session-manager"
          onComplete={handleComplete}
          onCancel={() => setIsOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

/**
 * Example 6: Standalone Usage (No Dialog)
 */
export function StandaloneWizardExample() {
  const handleComplete = (data: EntityData) => {
    console.log('Created:', data);
    // Navigate away or show success message
  };

  return (
    <div className="container mx-auto max-w-4xl py-8">
      <ConversationalWizard
        entityType="subagent"
        onComplete={handleComplete}
        onCancel={() => window.history.back()}
        initialContext="I'll help you create a new subagent. What specific task should this subagent handle?"
      />
    </div>
  );
}

/**
 * Example 7: Multi-Step Wizard with Progress
 */
export function MultiStepWizardExample() {
  const [step, setStep] = React.useState(1);
  const [workspaceData, setWorkspaceData] = React.useState<EntityData | null>(null);

  if (step === 1) {
    return (
      <ConversationalWizard
        entityType="workspace"
        onComplete={(data) => {
          setWorkspaceData(data);
          setStep(2);
        }}
        onCancel={() => console.log('Cancelled')}
      />
    );
  }

  if (step === 2) {
    return (
      <ConversationalWizard
        entityType="orchestrator"
        initialContext={`Great! Now let's create an orchestrator for your ${workspaceData?.name} workspace.`}
        onComplete={(data) => {
          console.log('Workspace:', workspaceData);
          console.log('Orchestrator:', data);
          // Create both entities
        }}
        onCancel={() => setStep(1)}
      />
    );
  }

  return null;
}
