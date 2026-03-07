'use client';

import Link from 'next/link';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { AGENT_TYPE_METADATA } from '@/types/agent';

import { CapabilityBadges } from './capability-badges';

import type { Capability } from './capability-badges';
import type { Agent } from '@/types/agent';

// ---------------------------------------------------------------------------
// Model badge colours
// ---------------------------------------------------------------------------

const MODEL_TIER_COLORS: Record<string, string> = {
  opus: 'bg-purple-500/10 text-purple-600 border-purple-500/20 dark:text-purple-400',
  sonnet: 'bg-blue-500/10 text-blue-600 border-blue-500/20 dark:text-blue-400',
  haiku:
    'bg-green-500/10 text-green-600 border-green-500/20 dark:text-green-400',
  default: 'bg-muted text-muted-foreground border-border',
};

function getModelTier(model: string): string {
  if (model.includes('opus')) {
    return 'opus';
  }
  if (model.includes('sonnet')) {
    return 'sonnet';
  }
  if (model.includes('haiku')) {
    return 'haiku';
  }
  return 'default';
}

function getModelShortName(model: string): string {
  if (model.includes('opus')) {
    return 'Opus';
  }
  if (model.includes('sonnet')) {
    return 'Sonnet';
  }
  if (model.includes('haiku')) {
    return 'Haiku';
  }
  return model;
}

// ---------------------------------------------------------------------------
// Status dot
// ---------------------------------------------------------------------------

const STATUS_DOT_COLORS: Record<Agent['status'], string> = {
  active: 'bg-green-500',
  paused: 'bg-yellow-500',
  inactive: 'bg-stone-400',
};

const STATUS_LABELS: Record<Agent['status'], string> = {
  active: 'Active',
  paused: 'Paused',
  inactive: 'Inactive',
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface AgentCardProps {
  agent: Agent;
  /** Optional href to navigate to when the card is clicked */
  href?: string;
  /** Capabilities map – derived from agent config or explicit override */
  capabilities?: Partial<Record<Capability, boolean>>;
  onEdit?: (agent: Agent) => void;
  onPause?: (agent: Agent) => void;
  onResume?: (agent: Agent) => void;
  onDelete?: (agent: Agent) => void;
  /** When true, hides the dropdown menu */
  readOnly?: boolean;
}

/**
 * AgentCard – compact card for rendering an agent in list views.
 *
 * Shows: name, model badge (coloured by tier), capability icons, status dot.
 */
export function AgentCard({
  agent,
  href,
  capabilities = {},
  onEdit,
  onPause,
  onResume,
  onDelete,
  readOnly = false,
}: AgentCardProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const metadata = AGENT_TYPE_METADATA[agent.type];
  if (!metadata) {
    return null;
  }

  const modelTier = getModelTier(agent.config.model);
  const modelShort = getModelShortName(agent.config.model);

  const inner = (
    <article
      className={cn(
        'group relative flex flex-col gap-3 rounded-lg border border-border bg-card p-4 transition-colors',
        href && 'hover:border-primary/50 hover:bg-accent cursor-pointer'
      )}
      aria-label={`Agent: ${agent.name}`}
    >
      {/* Header row */}
      <div className='flex items-start justify-between gap-2'>
        <div className='flex items-start gap-3 min-w-0'>
          {/* Type icon */}
          <div className='flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted text-lg'>
            {metadata.icon}
          </div>

          {/* Name + type */}
          <div className='min-w-0'>
            <h3 className='truncate font-medium leading-tight text-foreground'>
              {agent.name}
            </h3>
            <p className='text-xs text-muted-foreground'>{metadata.label}</p>
          </div>
        </div>

        {/* Right side: status dot + menu */}
        <div className='flex shrink-0 items-center gap-2'>
          {/* Status dot */}
          <span
            title={STATUS_LABELS[agent.status]}
            className={cn(
              'h-2 w-2 rounded-full',
              STATUS_DOT_COLORS[agent.status]
            )}
          />

          {!readOnly && (
            <DropdownMenu open={isMenuOpen} onOpenChange={setIsMenuOpen}>
              <DropdownMenuTrigger asChild>
                <Button
                  variant='ghost'
                  size='sm'
                  className='h-7 w-7 p-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100'
                  onClick={e => e.preventDefault()}
                  aria-label={`Options for ${agent.name}`}
                >
                  <MoreIcon className='h-4 w-4' />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align='end' className='w-40'>
                {onEdit && (
                  <DropdownMenuItem
                    onClick={e => {
                      e.preventDefault();
                      onEdit(agent);
                    }}
                  >
                    <EditIcon className='mr-2 h-4 w-4' />
                    Edit
                  </DropdownMenuItem>
                )}
                {agent.status === 'active' && onPause ? (
                  <DropdownMenuItem
                    onClick={e => {
                      e.preventDefault();
                      onPause(agent);
                    }}
                  >
                    <PauseIcon className='mr-2 h-4 w-4' />
                    Pause
                  </DropdownMenuItem>
                ) : onResume ? (
                  <DropdownMenuItem
                    onClick={e => {
                      e.preventDefault();
                      onResume(agent);
                    }}
                  >
                    <PlayIcon className='mr-2 h-4 w-4' />
                    Resume
                  </DropdownMenuItem>
                ) : null}
                {onDelete && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={e => {
                        e.preventDefault();
                        onDelete(agent);
                      }}
                      className='text-red-500 focus:text-red-500'
                    >
                      <TrashIcon className='mr-2 h-4 w-4' />
                      Delete
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* Description */}
      {agent.description && (
        <p className='line-clamp-1 text-xs text-muted-foreground'>
          {agent.description}
        </p>
      )}

      {/* Footer row: model badge + capabilities */}
      <div className='flex flex-wrap items-center gap-2'>
        <Badge
          variant='outline'
          className={cn('text-xs', MODEL_TIER_COLORS[modelTier])}
        >
          {modelShort}
        </Badge>

        <CapabilityBadges capabilities={capabilities} activeOnly />
      </div>
    </article>
  );

  if (href) {
    return (
      <Link href={href} className='block no-underline'>
        {inner}
      </Link>
    );
  }

  return inner;
}

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

function MoreIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
      className={className}
    >
      <circle cx='12' cy='12' r='1' />
      <circle cx='12' cy='5' r='1' />
      <circle cx='12' cy='19' r='1' />
    </svg>
  );
}

function EditIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
      className={className}
    >
      <path d='M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z' />
    </svg>
  );
}

function PauseIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
      className={className}
    >
      <rect width='4' height='16' x='6' y='4' />
      <rect width='4' height='16' x='14' y='4' />
    </svg>
  );
}

function PlayIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
      className={className}
    >
      <polygon points='5 3 19 12 5 21 5 3' />
    </svg>
  );
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
      className={className}
    >
      <path d='M3 6h18' />
      <path d='M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6' />
      <path d='M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2' />
    </svg>
  );
}
