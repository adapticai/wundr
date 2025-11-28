'use client';

import { useState, useCallback, useEffect } from 'react';

import { useParams } from 'next/navigation';

import { usePageHeader } from '@/contexts/page-header-context';

import { AgentCard } from '@/components/agents/agent-card';
import { AgentDetailPanel } from '@/components/agents/agent-detail-panel';
import { CreateAgentModal } from '@/components/agents/create-agent-modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { useAgents, useAgentMutations } from '@/hooks/use-agents';
import { useToast } from '@/hooks/use-toast';
import type { Agent, AgentType, AgentStatus } from '@/types/agent';

export default function AgentsPage() {
  const params = useParams();
  const workspaceSlug = params.workspaceSlug as string;
  const { toast } = useToast();
  const { setPageHeader } = usePageHeader();

  // Set page header
  useEffect(() => {
    setPageHeader('Agents', 'Manage your AI agents and their configurations');
  }, [setPageHeader]);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<AgentStatus | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<AgentType | 'all'>('all');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);

  const { agents, isLoading, error, refetch, filteredCount, totalCount } = useAgents(
    workspaceSlug,
    {
      search: searchQuery,
      status: statusFilter !== 'all' ? statusFilter : undefined,
      type: typeFilter !== 'all' ? typeFilter : undefined,
    },
  );

  const {
    createAgent,
    updateAgent,
    deleteAgent,
    pauseAgent,
    resumeAgent,
    isLoading: isMutating,
  } = useAgentMutations(workspaceSlug);

  const handleCreateAgent = useCallback(
    async (input: Parameters<typeof createAgent>[0]) => {
      const newAgent = await createAgent(input);
      if (newAgent) {
        toast({
          title: 'Agent created',
          description: `${newAgent.name} has been created successfully.`,
        });
        refetch();
      } else {
        toast({
          title: 'Error',
          description: 'Failed to create agent. Please try again.',
          variant: 'destructive',
        });
      }
    },
    [createAgent, refetch, toast],
  );

  const handleUpdateAgent = useCallback(
    async (id: string, input: Parameters<typeof updateAgent>[1]) => {
      const updated = await updateAgent(id, input);
      if (updated) {
        toast({
          title: 'Agent updated',
          description: 'Agent has been updated successfully.',
        });
        refetch();
        setSelectedAgent(updated);
      } else {
        toast({
          title: 'Error',
          description: 'Failed to update agent. Please try again.',
          variant: 'destructive',
        });
      }
    },
    [updateAgent, refetch, toast],
  );

  const handleDeleteAgent = useCallback(
    async (id: string) => {
      const success = await deleteAgent(id);
      if (success) {
        toast({
          title: 'Agent deleted',
          description: 'Agent has been deleted successfully.',
        });
        refetch();
        setSelectedAgent(null);
      } else {
        toast({
          title: 'Error',
          description: 'Failed to delete agent. Please try again.',
          variant: 'destructive',
        });
      }
    },
    [deleteAgent, refetch, toast],
  );

  const handlePauseAgent = useCallback(
    async (agent: Agent) => {
      const updated = await pauseAgent(agent.id);
      if (updated) {
        toast({
          title: 'Agent paused',
          description: `${agent.name} has been paused.`,
        });
        refetch();
      } else {
        toast({
          title: 'Error',
          description: 'Failed to pause agent. Please try again.',
          variant: 'destructive',
        });
      }
    },
    [pauseAgent, refetch, toast],
  );

  const handleResumeAgent = useCallback(
    async (agent: Agent) => {
      const updated = await resumeAgent(agent.id);
      if (updated) {
        toast({
          title: 'Agent resumed',
          description: `${agent.name} has been resumed.`,
        });
        refetch();
      } else {
        toast({
          title: 'Error',
          description: 'Failed to resume agent. Please try again.',
          variant: 'destructive',
        });
      }
    },
    [resumeAgent, refetch, toast],
  );

  if (error) {
    return (
      <div className="space-y-6">
        <div className="rounded-lg border border-red-800 bg-red-900/20 p-4">
          <p className="text-sm text-red-400">Error: {error.message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Action Button */}
      <div className="flex justify-end">
        <Button onClick={() => setIsCreateModalOpen(true)}>
          <PlusIcon className="mr-2 h-4 w-4" />
          Create Agent
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="flex-1">
          <Input
            type="search"
            placeholder="Search agents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full"
          />
        </div>
        <div className="flex gap-2">
          <Select value={typeFilter} onValueChange={(value) => setTypeFilter(value as AgentType | 'all')}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="task">Task</SelectItem>
              <SelectItem value="research">Research</SelectItem>
              <SelectItem value="coding">Coding</SelectItem>
              <SelectItem value="data">Data</SelectItem>
              <SelectItem value="qa">QA</SelectItem>
              <SelectItem value="support">Support</SelectItem>
              <SelectItem value="custom">Custom</SelectItem>
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as AgentStatus | 'all')}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="paused">Paused</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Results count */}
      {!isLoading && (
        <div className="text-sm text-stone-400">
          Showing {filteredCount} of {totalCount} agents
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Spinner className="h-8 w-8" />
        </div>
      )}

      {/* Empty State */}
      {!isLoading && agents.length === 0 && !searchQuery && statusFilter === 'all' && typeFilter === 'all' && (
        <div className="rounded-lg border border-stone-800 bg-stone-900 p-8 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-stone-800">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-stone-400"
            >
              <path d="M12 8V4H8" />
              <rect width="16" height="12" x="4" y="8" rx="2" />
              <path d="M2 14h2" />
              <path d="M20 14h2" />
              <path d="M15 13v2" />
              <path d="M9 13v2" />
            </svg>
          </div>
          <h3 className="mt-4 text-lg font-medium text-stone-100">No agents configured</h3>
          <p className="mt-2 text-sm text-stone-400">
            Get started by creating your first AI agent to automate tasks.
          </p>
          <Button className="mt-4" onClick={() => setIsCreateModalOpen(true)}>
            Create Agent
          </Button>
        </div>
      )}

      {/* No Results State */}
      {!isLoading && agents.length === 0 && (searchQuery || statusFilter !== 'all' || typeFilter !== 'all') && (
        <div className="rounded-lg border border-stone-800 bg-stone-900 p-8 text-center">
          <h3 className="text-lg font-medium text-stone-100">No agents found</h3>
          <p className="mt-2 text-sm text-stone-400">
            Try adjusting your search or filters.
          </p>
        </div>
      )}

      {/* Agent Grid */}
      {!isLoading && agents.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {agents.map((agent) => (
            <AgentCard
              key={agent.id}
              agent={agent}
              onEdit={(agent) => setSelectedAgent(agent)}
              onPause={handlePauseAgent}
              onResume={handleResumeAgent}
              onDelete={(agent) => {
                setSelectedAgent(agent);
                // The delete will be triggered from the detail panel
              }}
            />
          ))}
        </div>
      )}

      {/* Create Agent Modal */}
      <CreateAgentModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreate={handleCreateAgent}
        isLoading={isMutating}
      />

      {/* Agent Detail Panel */}
      {selectedAgent && (
        <AgentDetailPanel
          agent={selectedAgent}
          isOpen={!!selectedAgent}
          onClose={() => setSelectedAgent(null)}
          onUpdate={handleUpdateAgent}
          onDelete={handleDeleteAgent}
          isLoading={isMutating}
        />
      )}
    </div>
  );
}

function PlusIcon({ className }: { className?: string }) {
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
      <path d="M5 12h14" />
      <path d="M12 5v14" />
    </svg>
  );
}
