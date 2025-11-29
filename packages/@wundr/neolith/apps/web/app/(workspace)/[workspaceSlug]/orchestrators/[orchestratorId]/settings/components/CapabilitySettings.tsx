'use client';

/**
 * Capability Settings Component
 *
 * Manage orchestrator capabilities and permissions.
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CapabilityToggle } from './CapabilityToggle';

import type { CapabilityConfig } from '@/lib/validations/orchestrator-config';

interface CapabilitySettingsProps {
  orchestratorId: string;
  onSave: (data: Record<string, unknown>) => Promise<void>;
  disabled?: boolean;
  isAdmin?: boolean;
}

const CAPABILITY_DEFINITIONS = [
  {
    type: 'respond_to_messages',
    name: 'Respond to Messages',
    description: 'Send messages in channels and threads',
    icon: '💬',
  },
  {
    type: 'create_tasks',
    name: 'Create Tasks',
    description: 'Create and assign tasks to team members',
    icon: '✓',
  },
  {
    type: 'execute_code',
    name: 'Execute Code',
    description: 'Run code snippets and scripts (use with caution)',
    icon: '⚡',
  },
  {
    type: 'file_operations',
    name: 'File Operations',
    description: 'Read and write files in the workspace',
    icon: '📁',
  },
  {
    type: 'api_calls',
    name: 'API Calls',
    description: 'Make external API calls and integrations',
    icon: '🔌',
  },
  {
    type: 'data_analysis',
    name: 'Data Analysis',
    description: 'Analyze data and generate insights',
    icon: '📊',
  },
  {
    type: 'workflow_automation',
    name: 'Workflow Automation',
    description: 'Create and manage automated workflows',
    icon: '🔄',
  },
  {
    type: 'integration_management',
    name: 'Integration Management',
    description: 'Manage third-party integrations',
    icon: '🔗',
  },
  {
    type: 'team_coordination',
    name: 'Team Coordination',
    description: 'Coordinate tasks between team members',
    icon: '👥',
  },
];

export function CapabilitySettings({
  orchestratorId,
  onSave,
  disabled,
  isAdmin,
}: CapabilitySettingsProps) {
  const [capabilities, setCapabilities] = useState<Record<string, CapabilityConfig>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchCapabilities();
  }, [orchestratorId]);

  const fetchCapabilities = async () => {
    try {
      const response = await fetch(`/api/orchestrators/${orchestratorId}/capabilities`);
      if (response.ok) {
        const data = await response.json();
        setCapabilities((data.data?.enabledCapabilities as Record<string, CapabilityConfig>) || {});
      }
    } catch (error) {
      console.error('Failed to fetch capabilities:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggle = (type: string, enabled: boolean) => {
    setCapabilities((prev) => ({
      ...prev,
      [type]: {
        ...prev[type],
        type: type as any,
        enabled,
        permissionLevel: prev[type]?.permissionLevel || 'read',
      },
    }));
  };

  const handlePermissionChange = (type: string, permissionLevel: string) => {
    setCapabilities((prev) => ({
      ...prev,
      [type]: {
        ...prev[type],
        type: type as any,
        permissionLevel: permissionLevel as any,
      },
    }));
  };

  const handleRateLimitChange = (type: string, field: string, value: string) => {
    setCapabilities((prev) => ({
      ...prev,
      [type]: {
        ...prev[type],
        type: type as any,
        rateLimit: {
          ...prev[type]?.rateLimit,
          [field]: value ? Number(value) : undefined,
        },
      },
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const response = await fetch(`/api/orchestrators/${orchestratorId}/capabilities`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ capabilities }),
      });

      if (!response.ok) {
        throw new Error('Failed to update capabilities');
      }

      await onSave({ enabledCapabilities: capabilities });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <div>Loading capabilities...</div>;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Capabilities</CardTitle>
          <CardDescription>
            Enable and configure what actions your orchestrator can perform
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {CAPABILITY_DEFINITIONS.map((def) => {
            const capability = capabilities[def.type];
            return (
              <CapabilityToggle
                key={def.type}
                capability={{
                  type: def.type,
                  name: def.name,
                  description: def.description,
                  icon: def.icon,
                }}
                config={capability}
                onToggle={(enabled) => handleToggle(def.type, enabled)}
                onPermissionChange={(level) => handlePermissionChange(def.type, level)}
                onRateLimitChange={(field, value) => handleRateLimitChange(def.type, field, value)}
                disabled={disabled}
                isAdmin={isAdmin}
              />
            );
          })}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" disabled={disabled || isSaving}>
          {isSaving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </form>
  );
}
