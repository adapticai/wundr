'use client';

import { useState } from 'react';

import type { CreateDeploymentInput, DeploymentType, DeploymentEnvironment } from '@/types/deployment';

export interface CreateDeploymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (input: CreateDeploymentInput) => Promise<void>;
}

export function CreateDeploymentModal({
  isOpen,
  onClose,
  onCreate,
}: CreateDeploymentModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<CreateDeploymentInput>({
    name: '',
    description: '',
    type: 'service',
    environment: 'development',
    config: {
      region: 'us-east-1',
      replicas: 1,
      resources: {
        cpu: '500m',
        memory: '512Mi',
      },
      env: {},
    },
  });

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      await onCreate(formData);
      onClose();
    } catch (error) {
      console.error('Failed to create deployment:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="relative w-full max-w-2xl rounded-lg border bg-card p-6 shadow-lg">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-semibold">Create New Deployment</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground hover:bg-accent"
            aria-label="Close"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Name */}
          <div>
            <label htmlFor="name" className="block text-sm font-medium">
              Name *
            </label>
            <input
              id="name"
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2"
              placeholder="my-deployment"
            />
          </div>

          {/* Description */}
          <div>
            <label htmlFor="description" className="block text-sm font-medium">
              Description
            </label>
            <textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2"
              placeholder="Optional description"
            />
          </div>

          {/* Type and Environment */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="type" className="block text-sm font-medium">
                Type *
              </label>
              <select
                id="type"
                value={formData.type}
                onChange={(e) =>
                  setFormData({ ...formData, type: e.target.value as DeploymentType })
                }
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2"
              >
                <option value="service">Service</option>
                <option value="agent">Agent</option>
                <option value="workflow">Workflow</option>
                <option value="integration">Integration</option>
              </select>
            </div>

            <div>
              <label htmlFor="environment" className="block text-sm font-medium">
                Environment *
              </label>
              <select
                id="environment"
                value={formData.environment}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    environment: e.target.value as DeploymentEnvironment,
                  })
                }
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2"
              >
                <option value="development">Development</option>
                <option value="staging">Staging</option>
                <option value="production">Production</option>
              </select>
            </div>
          </div>

          {/* Configuration */}
          <div className="space-y-4 rounded-md border p-4">
            <h3 className="font-medium">Configuration</h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="region" className="block text-sm font-medium">
                  Region
                </label>
                <select
                  id="region"
                  value={formData.config.region}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      config: { ...formData.config, region: e.target.value },
                    })
                  }
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2"
                >
                  <option value="us-east-1">US East (N. Virginia)</option>
                  <option value="us-west-2">US West (Oregon)</option>
                  <option value="eu-west-1">EU (Ireland)</option>
                  <option value="ap-southeast-1">Asia Pacific (Singapore)</option>
                </select>
              </div>

              <div>
                <label htmlFor="replicas" className="block text-sm font-medium">
                  Replicas
                </label>
                <input
                  id="replicas"
                  type="number"
                  min="1"
                  max="10"
                  value={formData.config.replicas}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      config: { ...formData.config, replicas: parseInt(e.target.value, 10) },
                    })
                  }
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="cpu" className="block text-sm font-medium">
                  CPU
                </label>
                <input
                  id="cpu"
                  type="text"
                  value={formData.config.resources.cpu}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      config: {
                        ...formData.config,
                        resources: { ...formData.config.resources, cpu: e.target.value },
                      },
                    })
                  }
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2"
                  placeholder="500m"
                />
              </div>

              <div>
                <label htmlFor="memory" className="block text-sm font-medium">
                  Memory
                </label>
                <input
                  id="memory"
                  type="text"
                  value={formData.config.resources.memory}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      config: {
                        ...formData.config,
                        resources: { ...formData.config.resources, memory: e.target.value },
                      },
                    })
                  }
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2"
                  placeholder="512Mi"
                />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-md border border-border bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {isSubmitting ? 'Creating...' : 'Create Deployment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}
