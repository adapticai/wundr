'use client';

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
import { AGENT_TYPE_METADATA } from '@/types/agent';

import type { Agent } from '@/types/agent';

interface AgentCardProps {
  agent: Agent;
  onEdit: (agent: Agent) => void;
  onPause: (agent: Agent) => void;
  onResume: (agent: Agent) => void;
  onDelete: (agent: Agent) => void;
}

export function AgentCard({
  agent,
  onEdit,
  onPause,
  onResume,
  onDelete,
}: AgentCardProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const metadata = AGENT_TYPE_METADATA[agent.type];

  if (!metadata) {
    console.error(`Unknown agent type: ${agent.type}`);
    return null;
  }

  const statusColor = {
    active: 'bg-green-500/10 text-green-500 border-green-500/20',
    paused: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
    inactive: 'bg-stone-500/10 text-stone-500 border-stone-500/20',
  }[agent.status];

  return (
    <article
      className='group relative rounded-lg border border-stone-800 bg-stone-900 p-4 transition-all hover:border-stone-700 hover:bg-stone-900/80'
      aria-label={`Agent card for ${agent.name}`}
    >
      {/* Header */}
      <div className='mb-3 flex items-start justify-between'>
        <div className='flex items-start gap-3'>
          <div className='flex h-10 w-10 items-center justify-center rounded-lg bg-stone-800 text-xl'>
            {metadata.icon}
          </div>
          <div className='flex-1'>
            <h3 className='font-medium text-stone-100'>{agent.name}</h3>
            <p className='text-xs text-stone-400'>{metadata.label}</p>
          </div>
        </div>

        <DropdownMenu open={isMenuOpen} onOpenChange={setIsMenuOpen}>
          <DropdownMenuTrigger asChild>
            <Button
              variant='ghost'
              size='sm'
              className='h-8 w-8 p-0 text-stone-400 opacity-0 transition-opacity hover:text-stone-100 group-hover:opacity-100'
              aria-label={`Agent options for ${agent.name}`}
            >
              <MoreVerticalIcon className='h-4 w-4' aria-hidden='true' />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align='end' className='w-40'>
            <DropdownMenuItem onClick={() => onEdit(agent)}>
              <EditIcon className='mr-2 h-4 w-4' />
              Edit
            </DropdownMenuItem>
            {agent.status === 'active' ? (
              <DropdownMenuItem onClick={() => onPause(agent)}>
                <PauseIcon className='mr-2 h-4 w-4' />
                Pause
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onClick={() => onResume(agent)}>
                <PlayIcon className='mr-2 h-4 w-4' />
                Resume
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => onDelete(agent)}
              className='text-red-500 focus:text-red-500'
            >
              <TrashIcon className='mr-2 h-4 w-4' />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Description */}
      {agent.description && (
        <p className='mb-3 line-clamp-2 text-sm text-stone-400'>
          {agent.description}
        </p>
      )}

      {/* Status Badge */}
      <div className='mb-3'>
        <Badge variant='outline' className={statusColor}>
          {agent.status.charAt(0).toUpperCase() + agent.status.slice(1)}
        </Badge>
      </div>

      {/* Stats */}
      <div className='grid grid-cols-3 gap-2 border-t border-stone-800 pt-3'>
        <div className='text-center'>
          <p className='text-lg font-semibold text-stone-100'>
            {agent.stats.tasksCompleted}
          </p>
          <p className='text-xs text-stone-500'>Tasks</p>
        </div>
        <div className='text-center'>
          <p className='text-lg font-semibold text-stone-100'>
            {agent.stats.successRate}%
          </p>
          <p className='text-xs text-stone-500'>Success</p>
        </div>
        <div className='text-center'>
          <p className='text-lg font-semibold text-stone-100'>
            {agent.stats.avgResponseTime > 0
              ? `${Math.round(agent.stats.avgResponseTime / 1000)}s`
              : '-'}
          </p>
          <p className='text-xs text-stone-500'>Avg Time</p>
        </div>
      </div>

      {/* Model Info */}
      <div className='mt-3 flex items-center justify-between border-t border-stone-800 pt-3'>
        <p className='text-xs text-stone-500'>Model: {agent.config.model}</p>
        {agent.stats.lastActive && (
          <p className='text-xs text-stone-500'>
            Last active: {new Date(agent.stats.lastActive).toLocaleDateString()}
          </p>
        )}
      </div>
    </article>
  );
}

// Icons
function MoreVerticalIcon({ className }: { className?: string }) {
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
