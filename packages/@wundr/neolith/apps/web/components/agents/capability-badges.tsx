'use client';

import { cn } from '@/lib/utils';

/**
 * Capability identifiers for agent permissions
 */
export type Capability =
  | 'canReadFiles'
  | 'canWriteFiles'
  | 'canExecuteCommands'
  | 'canAccessNetwork'
  | 'canSpawnSubAgents';

interface CapabilityConfig {
  label: string;
  shortLabel: string;
  icon: React.ReactNode;
  activeClass: string;
}

function FileReadIcon({ className }: { className?: string }) {
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
      <path d='M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z' />
      <polyline points='14 2 14 8 20 8' />
      <line x1='16' y1='13' x2='8' y2='13' />
      <line x1='16' y1='17' x2='8' y2='17' />
      <polyline points='10 9 9 9 8 9' />
    </svg>
  );
}

function FileWriteIcon({ className }: { className?: string }) {
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
      <path d='M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7' />
      <path d='M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z' />
    </svg>
  );
}

function TerminalIcon({ className }: { className?: string }) {
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
      <polyline points='4 17 10 11 4 5' />
      <line x1='12' y1='19' x2='20' y2='19' />
    </svg>
  );
}

function GlobeIcon({ className }: { className?: string }) {
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
      <circle cx='12' cy='12' r='10' />
      <line x1='2' y1='12' x2='22' y2='12' />
      <path d='M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z' />
    </svg>
  );
}

function BotIcon({ className }: { className?: string }) {
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
      <rect width='18' height='10' x='3' y='11' rx='2' />
      <circle cx='12' cy='5' r='2' />
      <path d='M12 7v4' />
      <line x1='8' y1='16' x2='8' y2='16' />
      <line x1='16' y1='16' x2='16' y2='16' />
    </svg>
  );
}

const CAPABILITY_CONFIG: Record<Capability, CapabilityConfig> = {
  canReadFiles: {
    label: 'Read Files',
    shortLabel: 'Read',
    icon: <FileReadIcon className='h-3 w-3' />,
    activeClass:
      'bg-blue-500/10 text-blue-600 border-blue-500/20 dark:text-blue-400',
  },
  canWriteFiles: {
    label: 'Write Files',
    shortLabel: 'Write',
    icon: <FileWriteIcon className='h-3 w-3' />,
    activeClass:
      'bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400',
  },
  canExecuteCommands: {
    label: 'Execute Commands',
    shortLabel: 'Exec',
    icon: <TerminalIcon className='h-3 w-3' />,
    activeClass:
      'bg-red-500/10 text-red-600 border-red-500/20 dark:text-red-400',
  },
  canAccessNetwork: {
    label: 'Network Access',
    shortLabel: 'Net',
    icon: <GlobeIcon className='h-3 w-3' />,
    activeClass:
      'bg-green-500/10 text-green-600 border-green-500/20 dark:text-green-400',
  },
  canSpawnSubAgents: {
    label: 'Spawn Sub-Agents',
    shortLabel: 'Spawn',
    icon: <BotIcon className='h-3 w-3' />,
    activeClass:
      'bg-purple-500/10 text-purple-600 border-purple-500/20 dark:text-purple-400',
  },
};

const INACTIVE_CLASS =
  'bg-muted/40 text-muted-foreground border-border opacity-40';

interface CapabilityBadgesProps {
  /**
   * Map of capability keys to their enabled state.
   * If a capability is not present it defaults to inactive.
   */
  capabilities: Partial<Record<Capability, boolean>>;
  /** When true, render only active capabilities. Default: false. */
  activeOnly?: boolean;
  /** Override size class applied to each badge. */
  className?: string;
}

/**
 * CapabilityBadges renders a row of badges for agent capability flags.
 *
 * Each badge shows an icon and a short label. Active capabilities are
 * highlighted; inactive capabilities are dimmed unless `activeOnly` is set.
 */
export function CapabilityBadges({
  capabilities,
  activeOnly = false,
  className,
}: CapabilityBadgesProps) {
  const capabilityKeys = Object.keys(CAPABILITY_CONFIG) as Capability[];

  const visibleKeys = activeOnly
    ? capabilityKeys.filter(key => capabilities[key])
    : capabilityKeys;

  if (visibleKeys.length === 0) {
    return (
      <span className='text-xs text-muted-foreground'>No capabilities</span>
    );
  }

  return (
    <div className={cn('flex flex-wrap gap-1.5', className)}>
      {visibleKeys.map(key => {
        const config = CAPABILITY_CONFIG[key];
        const isActive = Boolean(capabilities[key]);

        return (
          <span
            key={key}
            title={config.label}
            className={cn(
              'inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-xs font-medium',
              isActive ? config.activeClass : INACTIVE_CLASS
            )}
          >
            {config.icon}
            {config.shortLabel}
          </span>
        );
      })}
    </div>
  );
}

export { CAPABILITY_CONFIG };
