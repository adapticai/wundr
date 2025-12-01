/**
 * Example usage of CharterCapabilities component
 *
 * This demonstrates how to use the CharterCapabilities component
 * in an orchestrator charter configuration form.
 */

'use client';

import { useState } from 'react';
import { CharterCapabilities } from './charter-capabilities';
import { Button } from '@/components/ui/button';
import type { OrchestratorCapability } from '@/types/charter-capabilities';

export function CharterCapabilitiesExample() {
  const [capabilities, setCapabilities] = useState<OrchestratorCapability[]>([
    {
      id: 'send_messages',
      name: 'Send Messages',
      description: 'Send messages in channels and direct messages',
      category: 'communication',
      enabled: true,
      permissionLevel: 'write',
      rateLimit: {
        maxPerMinute: 10,
        maxPerHour: 100,
      },
    },
    {
      id: 'code_review',
      name: 'Code Review',
      description: 'Review code changes and provide feedback',
      category: 'development',
      enabled: true,
      permissionLevel: 'read',
    },
  ]);

  const handleSave = () => {
    console.log('Saving capabilities:', capabilities);
    // In a real app, you would save to the backend here
  };

  return (
    <div className='space-y-6'>
      <div>
        <h2 className='text-2xl font-bold'>
          Configure Orchestrator Capabilities
        </h2>
        <p className='text-muted-foreground'>
          Select which actions your orchestrator can perform and configure their
          permissions.
        </p>
      </div>

      <CharterCapabilities
        value={capabilities}
        onChange={setCapabilities}
        availableCapabilities={[]}
        disabled={false}
        isAdmin={true}
      />

      <div className='flex justify-end gap-3'>
        <Button variant='outline' onClick={() => setCapabilities([])}>
          Reset
        </Button>
        <Button onClick={handleSave}>Save Capabilities</Button>
      </div>

      {/* Debug output */}
      <details className='mt-8 p-4 border rounded-lg'>
        <summary className='cursor-pointer font-medium'>
          Current Configuration (Debug)
        </summary>
        <pre className='mt-4 text-xs overflow-auto'>
          {JSON.stringify(capabilities, null, 2)}
        </pre>
      </details>
    </div>
  );
}
