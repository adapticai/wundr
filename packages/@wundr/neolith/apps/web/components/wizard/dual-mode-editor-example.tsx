/**
 * DualModeEditor Usage Example
 * Demonstrates how to use the dual-mode editor component
 * @module components/wizard/dual-mode-editor-example
 */
'use client';

import * as React from 'react';
import {
  DualModeEditor,
  type EntityData,
  type Message,
  type FieldConfig,
} from './';

/**
 * Example usage of DualModeEditor for creating a workspace
 */
export function WorkspaceCreatorExample() {
  const handleSave = (data: EntityData) => {
    console.log('Saving workspace:', data);
    // Call your API here
    // await createWorkspace(data);
  };

  const handleAskAI = async (
    field: string,
    _currentValue: string,
    context: EntityData
  ): Promise<string> => {
    // Mock AI response - replace with actual LLM API call
    await new Promise(resolve => setTimeout(resolve, 1000));

    if (field.startsWith('explain-')) {
      const fieldName = field.replace('explain-', '');
      return `The ${fieldName} field helps identify and describe your workspace. It should be clear, concise, and meaningful to your team.`;
    }

    if (field === 'name') {
      return `${context.description ? context.description.slice(0, 30) : 'My'} Workspace`;
    }

    if (field === 'description') {
      return `A collaborative workspace for ${context.name || 'the team'} to manage projects and workflows efficiently.`;
    }

    if (field === 'improvements') {
      return `Consider adding more specific details about the workspace purpose, team size, and primary use cases.`;
    }

    return 'AI suggestion generated based on context.';
  };

  const handleSendMessage = async (
    message: string,
    history: Message[]
  ): Promise<{ response: string; extractedData?: EntityData }> => {
    // Mock LLM conversation - replace with actual API call
    await new Promise(resolve => setTimeout(resolve, 1000));

    const messageCount = history.filter(m => m.role === 'user').length;

    if (messageCount === 1) {
      return {
        response: `Great! I understand you want to create a workspace for "${message}". Can you tell me more about what this workspace will be used for?`,
      };
    }

    if (messageCount === 2) {
      return {
        response:
          "Perfect! I've gathered enough information to create your workspace. You can review the details in the 'Edit' tab, or switch to edit mode to make any adjustments.",
        extractedData: {
          name: history[0].content.slice(0, 50),
          description: history
            .map(m => (m.role === 'user' ? m.content : ''))
            .join(' '),
        },
      };
    }

    return {
      response:
        'Thanks for the additional information. The workspace details have been updated.',
      extractedData: {
        name: history[0].content.slice(0, 50),
        description: history
          .filter(m => m.role === 'user')
          .map(m => m.content)
          .join(' '),
      },
    };
  };

  const fieldConfigs: FieldConfig[] = [
    {
      key: 'name',
      label: 'Workspace Name',
      type: 'text',
      placeholder: 'Enter a name for your workspace',
      required: true,
      helpText: 'Choose a clear, memorable name for your workspace',
    },
    {
      key: 'description',
      label: 'Description',
      type: 'textarea',
      placeholder: 'Describe the purpose and goals of this workspace',
      required: true,
      helpText: 'Provide context about what this workspace will be used for',
    },
    {
      key: 'team',
      label: 'Team Name',
      type: 'text',
      placeholder: 'Enter the team or organization name',
      required: false,
      helpText: 'Optional: Specify the team that will use this workspace',
    },
  ];

  return (
    <div className='container mx-auto p-6'>
      <DualModeEditor
        entityType='Workspace'
        onSave={handleSave}
        mode='chat'
        fieldConfigs={fieldConfigs}
        onSendMessage={handleSendMessage}
        onAskAI={handleAskAI}
        autoSave={true}
        storageKey='workspace-creator'
      />
    </div>
  );
}

/**
 * Example usage of DualModeEditor for creating an agent
 */
export function AgentCreatorExample() {
  const handleSave = (data: EntityData) => {
    console.log('Saving agent:', data);
    // Call your API here
    // await createAgent(data);
  };

  const fieldConfigs: FieldConfig[] = [
    {
      key: 'name',
      label: 'Agent Name',
      type: 'text',
      placeholder: 'e.g., Customer Support Bot',
      required: true,
      helpText: 'A descriptive name for your AI agent',
    },
    {
      key: 'description',
      label: 'Description',
      type: 'textarea',
      placeholder: 'Describe what this agent does',
      required: true,
      helpText: 'Explain the purpose and capabilities of this agent',
    },
    {
      key: 'role',
      label: 'Role',
      type: 'text',
      placeholder: 'e.g., Support Specialist, Data Analyst',
      required: true,
      helpText: 'The specific role this agent will perform',
    },
    {
      key: 'model',
      label: 'AI Model',
      type: 'text',
      placeholder: 'e.g., gpt-4, claude-3',
      required: false,
      helpText: 'The LLM model to use for this agent',
    },
  ];

  return (
    <div className='container mx-auto p-6'>
      <DualModeEditor
        entityType='Agent'
        onSave={handleSave}
        mode='edit'
        fieldConfigs={fieldConfigs}
        autoSave={true}
        storageKey='agent-creator'
        initialData={{
          name: 'My Agent',
          description: '',
          role: '',
        }}
      />
    </div>
  );
}

/**
 * Example with custom AI handler
 */
export function CustomAIExample() {
  const handleAskAI = async (
    field: string,
    currentValue: string,
    context: EntityData
  ): Promise<string> => {
    // Call your actual LLM API
    const response = await fetch('/api/ai/suggest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ field, currentValue, context }),
    });

    const data = await response.json();
    return data.suggestion;
  };

  return (
    <DualModeEditor
      entityType='Custom Entity'
      onSave={data => console.log('Saved:', data)}
      onAskAI={handleAskAI}
      autoSave={true}
    />
  );
}
