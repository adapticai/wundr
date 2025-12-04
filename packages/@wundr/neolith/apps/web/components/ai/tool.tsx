'use client';

import {
  Wrench,
  ChevronDown,
  Check,
  X,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import * as React from 'react';

import { Badge } from '@/components/ui/badge';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

type ToolStatus = 'pending' | 'running' | 'completed' | 'error';

interface ToolProps {
  name: string;
  status: ToolStatus;
  input?: Record<string, unknown>;
  output?: unknown;
  error?: string;
  defaultOpen?: boolean;
  className?: string;
}

export function Tool({
  name,
  status,
  input,
  output,
  error,
  defaultOpen = false,
  className,
}: ToolProps) {
  const [isOpen, setIsOpen] = React.useState(defaultOpen || status === 'error');

  // Auto-open on error
  React.useEffect(() => {
    if (status === 'error' || status === 'completed') {
      setIsOpen(true);
    }
  }, [status]);

  return (
    <Collapsible
      open={isOpen}
      onOpenChange={setIsOpen}
      className={cn('rounded-lg border', className)}
    >
      <ToolHeader name={name} status={status} />
      <CollapsibleContent>
        <div className='p-3 space-y-3 border-t'>
          {input && <ToolInput input={input} />}
          {status === 'completed' && output !== undefined && (
            <ToolOutput output={output} />
          )}
          {status === 'error' && error && <ToolError error={error} />}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function ToolHeader({
  name,
  status,
  className,
}: {
  name: string;
  status: ToolStatus;
  className?: string;
}) {
  return (
    <CollapsibleTrigger
      className={cn(
        'flex items-center justify-between w-full px-3 py-2 hover:bg-muted/50 transition-colors',
        className
      )}
    >
      <div className='flex items-center gap-2'>
        <Wrench className='h-4 w-4 text-muted-foreground' />
        <span className='font-medium text-sm'>{name}</span>
      </div>
      <div className='flex items-center gap-2'>
        <ToolStatusBadge status={status} />
        <ChevronDown className='h-4 w-4 text-muted-foreground transition-transform [[data-state=open]_&]:rotate-180' />
      </div>
    </CollapsibleTrigger>
  );
}

export function ToolStatusBadge({ status }: { status: ToolStatus }) {
  const config: Record<
    ToolStatus,
    {
      icon: typeof Check | typeof Loader2 | typeof AlertCircle | null;
      label: string;
      variant: 'default' | 'secondary' | 'destructive' | 'outline';
      iconClass?: string;
    }
  > = {
    pending: { icon: null, label: 'Pending', variant: 'secondary' },
    running: {
      icon: Loader2,
      label: 'Running',
      variant: 'default',
      iconClass: 'animate-spin',
    },
    completed: { icon: Check, label: 'Completed', variant: 'outline' },
    error: {
      icon: AlertCircle,
      label: 'Error',
      variant: 'destructive',
    },
  };

  const { icon: Icon, label, variant, iconClass } = config[status];

  return (
    <Badge variant={variant} className='gap-1 text-xs'>
      {Icon && <Icon className={cn('h-3 w-3', iconClass)} />}
      {label}
    </Badge>
  );
}

export function ToolInput({
  input,
  className,
}: {
  input: Record<string, unknown>;
  className?: string;
}) {
  return (
    <div className={cn('', className)}>
      <div className='text-xs font-medium text-muted-foreground mb-1'>
        Input
      </div>
      <pre className='text-xs bg-muted p-2 rounded overflow-x-auto'>
        {JSON.stringify(input, null, 2)}
      </pre>
    </div>
  );
}

export function ToolOutput({
  output,
  className,
}: {
  output: unknown;
  className?: string;
}) {
  return (
    <div className={cn('', className)}>
      <div className='text-xs font-medium text-muted-foreground mb-1'>
        Output
      </div>
      <pre className='text-xs bg-muted p-2 rounded overflow-x-auto'>
        {typeof output === 'string' ? output : JSON.stringify(output, null, 2)}
      </pre>
    </div>
  );
}

export function ToolError({
  error,
  className,
}: {
  error: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'rounded-lg bg-destructive/10 text-destructive p-2',
        className
      )}
    >
      <div className='flex items-center gap-2 text-sm'>
        <X className='h-4 w-4' />
        <span className='font-medium'>Error</span>
      </div>
      <p className='text-xs mt-1'>{error}</p>
    </div>
  );
}

// Tool execution list for multiple sequential tools
export function ToolList({
  tools,
  className,
}: {
  tools: ToolProps[];
  className?: string;
}) {
  return (
    <div className={cn('space-y-2', className)}>
      {tools.map((tool, index) => (
        <Tool key={`${tool.name}-${index}`} {...tool} />
      ))}
    </div>
  );
}

// Inline tool indicator (for showing in message stream)
export function ToolInline({
  name,
  status,
  className,
}: {
  name: string;
  status: ToolStatus;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'inline-flex items-center gap-2 px-2 py-1 rounded-md bg-muted text-sm',
        className
      )}
    >
      <Wrench className='h-3 w-3' />
      <span>{name}</span>
      <ToolStatusBadge status={status} />
    </div>
  );
}
