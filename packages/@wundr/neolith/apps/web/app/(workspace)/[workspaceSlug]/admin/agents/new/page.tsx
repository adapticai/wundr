'use client';

import { ArrowLeft, Bot, Copy } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

import {
  AgentEditor,
  buildDefaultValues,
} from '@/components/agents/agent-editor';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { usePageHeader } from '@/contexts/page-header-context';
import { useAgentMutations } from '@/hooks/use-agents';
import { AGENT_TYPE_METADATA } from '@/types/agent';

import type { AgentEditorValues } from '@/components/agents/agent-editor';
import type { Agent, AgentType } from '@/types/agent';

// ---------------------------------------------------------------------------
// Template selector
// ---------------------------------------------------------------------------

interface TemplateOption {
  id: string;
  label: string;
  description: string;
  type: AgentType;
  icon: string;
  systemPrompt: string;
}

const BLANK_TEMPLATES: TemplateOption[] = (
  [
    'task',
    'research',
    'coding',
    'data',
    'qa',
    'support',
    'custom',
  ] as AgentType[]
).map(type => ({
  id: `blank-${type}`,
  label: AGENT_TYPE_METADATA[type].label,
  description: AGENT_TYPE_METADATA[type].description,
  type,
  icon: AGENT_TYPE_METADATA[type].icon,
  systemPrompt: '',
}));

interface TemplateSelectorProps {
  onSelect: (template: TemplateOption | null) => void;
  workspaceSlug: string;
}

function TemplateSelector({ onSelect, workspaceSlug }: TemplateSelectorProps) {
  const [universalAgents, setUniversalAgents] = useState<Agent[]>([]);
  const [loadingUniversal, setLoadingUniversal] = useState(false);
  const [search, setSearch] = useState('');

  // Fetch universal agents for the "copy" option
  useEffect(() => {
    setLoadingUniversal(true);
    fetch(`/api/workspaces/${workspaceSlug}/agents?limit=50`)
      .then(r => r.json())
      .then((data: { data?: Agent[] }) => {
        setUniversalAgents(data.data ?? []);
      })
      .catch(() => {})
      .finally(() => setLoadingUniversal(false));
  }, [workspaceSlug]);

  const filteredBlank = BLANK_TEMPLATES.filter(
    t =>
      t.label.toLowerCase().includes(search.toLowerCase()) ||
      t.description.toLowerCase().includes(search.toLowerCase())
  );

  const filteredUniversal = universalAgents.filter(
    a =>
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      (a.description ?? '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className='space-y-4'>
      {/* Search */}
      <Input
        placeholder='Search templates...'
        value={search}
        onChange={e => setSearch(e.target.value)}
      />

      {/* Start blank */}
      <div>
        <p className='mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground'>
          Start from Blank
        </p>
        <div className='grid grid-cols-2 gap-2 sm:grid-cols-3'>
          {filteredBlank.map(t => (
            <button
              key={t.id}
              type='button'
              onClick={() => onSelect(t)}
              className='flex flex-col gap-1 rounded-lg border border-border bg-card p-3 text-left transition-colors hover:border-primary/50 hover:bg-accent'
            >
              <span className='text-lg'>{t.icon}</span>
              <span className='text-sm font-medium'>{t.label}</span>
              <span className='text-xs text-muted-foreground'>
                {t.description}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Copy from existing */}
      {(loadingUniversal || filteredUniversal.length > 0) && (
        <div>
          <p className='mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground'>
            Copy from Existing
          </p>
          {loadingUniversal ? (
            <div className='space-y-2'>
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className='h-14 w-full' />
              ))}
            </div>
          ) : (
            <div className='space-y-2'>
              {filteredUniversal.map(agent => {
                const meta = AGENT_TYPE_METADATA[agent.type];
                return (
                  <button
                    key={agent.id}
                    type='button'
                    onClick={() =>
                      onSelect({
                        id: agent.id,
                        label: agent.name,
                        description: agent.description,
                        type: agent.type,
                        icon: meta?.icon ?? '',
                        systemPrompt: agent.systemPrompt ?? '',
                      })
                    }
                    className='flex w-full items-center gap-3 rounded-lg border border-border bg-card p-3 text-left transition-colors hover:border-primary/50 hover:bg-accent'
                  >
                    <span className='text-lg'>{meta?.icon}</span>
                    <div className='min-w-0 flex-1'>
                      <div className='flex items-center gap-2'>
                        <p className='text-sm font-medium'>{agent.name}</p>
                        <Badge variant='secondary' className='text-xs'>
                          {meta?.label}
                        </Badge>
                      </div>
                      {agent.description && (
                        <p className='line-clamp-1 text-xs text-muted-foreground'>
                          {agent.description}
                        </p>
                      )}
                    </div>
                    <Copy className='h-4 w-4 shrink-0 text-muted-foreground' />
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function NewAgentPage() {
  const params = useParams();
  const router = useRouter();
  const workspaceSlug = params.workspaceSlug as string;
  const { setPageHeader } = usePageHeader();

  const [showTemplateDialog, setShowTemplateDialog] = useState(true);
  const [selectedTemplate, setSelectedTemplate] =
    useState<TemplateOption | null>(null);

  const { createAgent, isLoading } = useAgentMutations(workspaceSlug);

  useEffect(() => {
    setPageHeader('New Agent', 'Configure and create a new AI agent');
  }, [setPageHeader]);

  const handleTemplateSelect = useCallback(
    (template: TemplateOption | null) => {
      setSelectedTemplate(template);
      setShowTemplateDialog(false);
    },
    []
  );

  const handleCreate = useCallback(
    async (values: AgentEditorValues) => {
      const result = await createAgent({
        name: values.name,
        type: values.type,
        description: values.description || undefined,
        systemPrompt: values.systemPrompt || undefined,
        config: {
          model: values.model,
          temperature: values.temperature,
          maxTokens: values.maxTokens,
        },
        tools: values.tools as never[],
      });

      if (result) {
        toast.success(`Agent "${result.name}" created`);
        router.push(`/${workspaceSlug}/admin/agents/${result.id}`);
      } else {
        toast.error('Failed to create agent');
      }
    },
    [createAgent, router, workspaceSlug]
  );

  // Build default values from selected template
  const defaultValues: Partial<AgentEditorValues> = selectedTemplate
    ? buildDefaultValues({
        type: selectedTemplate.type,
        systemPrompt: selectedTemplate.systemPrompt,
      })
    : buildDefaultValues();

  return (
    <div className='space-y-6'>
      {/* Back nav */}
      <div className='flex items-center justify-between'>
        <Link href={`/${workspaceSlug}/admin/agents`}>
          <Button variant='ghost' size='sm' className='-ml-1'>
            <ArrowLeft className='mr-2 h-4 w-4' />
            Agents
          </Button>
        </Link>

        {selectedTemplate && (
          <Button
            variant='outline'
            size='sm'
            onClick={() => setShowTemplateDialog(true)}
          >
            Change template
          </Button>
        )}
      </div>

      {/* Template dialog */}
      <Dialog
        open={showTemplateDialog}
        onOpenChange={open => {
          // Only allow closing if a template has already been selected
          if (!open && selectedTemplate) {
            setShowTemplateDialog(false);
          }
        }}
      >
        <DialogContent className='max-w-lg max-h-[80vh] overflow-y-auto'>
          <DialogHeader>
            <DialogTitle className='flex items-center gap-2'>
              <Bot className='h-5 w-5' />
              Choose a Starting Point
            </DialogTitle>
            <DialogDescription>
              Start from a blank template or copy an existing agent.
            </DialogDescription>
          </DialogHeader>

          <TemplateSelector
            onSelect={handleTemplateSelect}
            workspaceSlug={workspaceSlug}
          />
        </DialogContent>
      </Dialog>

      {/* Editor – only shown once template is selected */}
      {!showTemplateDialog && (
        <div className='rounded-lg border bg-card p-6'>
          {selectedTemplate && (
            <div className='mb-6 flex items-center gap-3 rounded-lg bg-muted/50 px-4 py-3'>
              <span className='text-xl'>{selectedTemplate.icon}</span>
              <div>
                <p className='text-sm font-medium'>
                  Template: {selectedTemplate.label}
                </p>
                <p className='text-xs text-muted-foreground'>
                  {selectedTemplate.description}
                </p>
              </div>
            </div>
          )}

          <AgentEditor
            defaultValues={defaultValues}
            onSubmit={handleCreate}
            onCancel={() => router.push(`/${workspaceSlug}/admin/agents`)}
            isLoading={isLoading}
            submitLabel='Create Agent'
          />
        </div>
      )}
    </div>
  );
}
