'use client';

import {
  X,
  Plus,
  Shield,
  FileWarning,
  Ban,
  CheckCircle2,
  Download,
  Upload,
} from 'lucide-react';
import * as React from 'react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

/**
 * Governance constraints for charter configuration
 */
export interface CharterConstraints {
  forbiddenCommands: string[];
  forbiddenPaths: string[];
  forbiddenActions: string[];
  requireApprovalFor: string[];
}

/**
 * Preset templates for different constraint scenarios
 */
const PRESETS = {
  security: {
    forbiddenCommands: [
      'rm -rf /',
      'sudo rm',
      'format',
      'fdisk',
      'mkfs',
      'dd if=',
      ':(){:|:&};:',
    ],
    forbiddenPaths: ['/etc/passwd', '/etc/shadow', '~/.ssh', '/root', '/boot'],
    forbiddenActions: [
      'delete_production_data',
      'expose_secrets',
      'disable_encryption',
      'bypass_auth',
    ],
    requireApprovalFor: [
      'deploy_production',
      'delete_workspace',
      'modify_permissions',
      'access_credentials',
    ],
  },
  compliance: {
    forbiddenCommands: [
      'rm -rf /',
      'sudo rm',
      'format',
      'chmod 777',
      'chown root',
    ],
    forbiddenPaths: [
      '/etc/passwd',
      '/etc/shadow',
      '/var/log/audit',
      '/etc/security',
    ],
    forbiddenActions: [
      'delete_audit_logs',
      'modify_compliance_data',
      'disable_logging',
      'expose_pii',
    ],
    requireApprovalFor: [
      'access_pii',
      'modify_audit_settings',
      'export_user_data',
      'change_retention_policy',
    ],
  },
  production: {
    forbiddenCommands: [
      'rm -rf /',
      'sudo rm',
      'format',
      'fdisk',
      'reboot',
      'shutdown',
    ],
    forbiddenPaths: [
      '/etc/passwd',
      '/etc/shadow',
      '/var/lib/database',
      '/opt/production',
    ],
    forbiddenActions: [
      'delete_production_data',
      'modify_database_schema',
      'disable_monitoring',
      'bypass_rate_limits',
    ],
    requireApprovalFor: [
      'deploy_production',
      'rollback_production',
      'scale_infrastructure',
      'modify_billing',
    ],
  },
} as const;

/**
 * Default constraint values
 */
const DEFAULT_CONSTRAINTS: CharterConstraints = {
  forbiddenCommands: ['rm -rf /', 'sudo rm', 'format', 'fdisk'],
  forbiddenPaths: ['/etc/passwd', '/etc/shadow', '~/.ssh'],
  forbiddenActions: ['delete_production_data', 'expose_secrets'],
  requireApprovalFor: [
    'deploy_production',
    'delete_workspace',
    'modify_billing',
  ],
};

export interface CharterConstraintsProps {
  value: CharterConstraints;
  onChange: (constraints: CharterConstraints) => void;
  className?: string;
}

/**
 * Individual constraint list component
 */
interface ConstraintListProps {
  title: string;
  description: string;
  items: string[];
  onAdd: (item: string) => void;
  onRemove: (item: string) => void;
  placeholder: string;
  icon: React.ReactNode;
  variant?: 'destructive' | 'default' | 'secondary' | 'outline';
}

function ConstraintList({
  title,
  description,
  items,
  onAdd,
  onRemove,
  placeholder,
  icon,
  variant = 'default',
}: ConstraintListProps) {
  const [inputValue, setInputValue] = React.useState('');

  const handleAdd = () => {
    const trimmedValue = inputValue.trim();
    if (trimmedValue && !items.includes(trimmedValue)) {
      onAdd(trimmedValue);
      setInputValue('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAdd();
    }
  };

  return (
    <div className='space-y-3'>
      <div className='flex items-center gap-2'>
        {icon}
        <div className='flex-1'>
          <Label className='text-sm font-medium'>{title}</Label>
          <p className='text-xs text-muted-foreground'>{description}</p>
        </div>
      </div>

      {/* Input area */}
      <div className='flex gap-2'>
        <Input
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className='flex-1'
        />
        <Button onClick={handleAdd} size='sm' variant='outline'>
          <Plus className='h-4 w-4' />
        </Button>
      </div>

      {/* Items display */}
      <div className='flex flex-wrap gap-2 min-h-[2rem] p-3 border rounded-md bg-muted/30'>
        {items.length === 0 ? (
          <span className='text-sm text-muted-foreground italic'>
            No items added
          </span>
        ) : (
          items.map(item => (
            <Badge key={item} variant={variant} className='gap-1 pr-1'>
              <span className='max-w-[200px] truncate'>{item}</span>
              <button
                onClick={() => onRemove(item)}
                className='ml-1 hover:bg-background/20 rounded-sm p-0.5'
                aria-label={`Remove ${item}`}
              >
                <X className='h-3 w-3' />
              </button>
            </Badge>
          ))
        )}
      </div>
    </div>
  );
}

export function CharterConstraints({
  value,
  onChange,
  className,
}: CharterConstraintsProps) {
  const [localConstraints, setLocalConstraints] =
    React.useState<CharterConstraints>(value);

  // Sync local constraints with prop changes
  React.useEffect(() => {
    setLocalConstraints(value);
  }, [value]);

  const updateConstraints = (updates: Partial<CharterConstraints>) => {
    const updated = { ...localConstraints, ...updates };
    setLocalConstraints(updated);
    onChange(updated);
  };

  const handleAdd = (field: keyof CharterConstraints, item: string) => {
    updateConstraints({
      [field]: [...localConstraints[field], item],
    });
  };

  const handleRemove = (field: keyof CharterConstraints, item: string) => {
    updateConstraints({
      [field]: localConstraints[field].filter(i => i !== item),
    });
  };

  const applyPreset = (preset: keyof typeof PRESETS) => {
    const presetValues = PRESETS[preset];
    // Spread arrays to make them mutable
    const mutablePreset: CharterConstraints = {
      forbiddenCommands: [...presetValues.forbiddenCommands],
      forbiddenPaths: [...presetValues.forbiddenPaths],
      forbiddenActions: [...presetValues.forbiddenActions],
      requireApprovalFor: [...presetValues.requireApprovalFor],
    };
    setLocalConstraints(mutablePreset);
    onChange(mutablePreset);
  };

  const resetToDefaults = () => {
    setLocalConstraints(DEFAULT_CONSTRAINTS);
    onChange(DEFAULT_CONSTRAINTS);
  };

  const handleExport = () => {
    const dataStr = JSON.stringify(localConstraints, null, 2);
    const dataUri = `data:application/json;charset=utf-8,${encodeURIComponent(dataStr)}`;
    const exportFileDefaultName = `charter-constraints-${new Date().toISOString().split('T')[0]}.json`;

    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = e => {
      try {
        const imported = JSON.parse(
          e.target?.result as string
        ) as CharterConstraints;
        // Validate structure
        if (
          Array.isArray(imported.forbiddenCommands) &&
          Array.isArray(imported.forbiddenPaths) &&
          Array.isArray(imported.forbiddenActions) &&
          Array.isArray(imported.requireApprovalFor)
        ) {
          setLocalConstraints(imported);
          onChange(imported);
        } else {
          alert('Invalid constraints file format');
        }
      } catch (error) {
        alert('Failed to parse constraints file');
      }
    };
    reader.readAsText(file);
    // Reset input so the same file can be imported again
    event.target.value = '';
  };

  const totalConstraints =
    localConstraints.forbiddenCommands.length +
    localConstraints.forbiddenPaths.length +
    localConstraints.forbiddenActions.length +
    localConstraints.requireApprovalFor.length;

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader>
        <div className='flex items-center justify-between'>
          <div>
            <CardTitle>Governance Constraints</CardTitle>
            <CardDescription>
              Define security boundaries and approval requirements
            </CardDescription>
          </div>
          <Badge variant='outline' className='gap-1'>
            <Shield className='h-3 w-3' />
            {totalConstraints} constraints
          </Badge>
        </div>
      </CardHeader>
      <CardContent className='space-y-6'>
        {/* Alert */}
        <Alert>
          <Shield className='h-4 w-4' />
          <AlertTitle>Security First</AlertTitle>
          <AlertDescription>
            These constraints protect your system from dangerous operations.
            Review carefully before modifying.
          </AlertDescription>
        </Alert>

        {/* Preset Templates */}
        <div className='space-y-2'>
          <Label className='text-sm font-medium'>Quick Templates</Label>
          <div className='flex flex-wrap gap-2'>
            <Button
              variant='outline'
              size='sm'
              onClick={() => applyPreset('security')}
              className='flex items-center gap-1'
            >
              <Shield className='h-3 w-3' />
              Security
            </Button>
            <Button
              variant='outline'
              size='sm'
              onClick={() => applyPreset('compliance')}
              className='flex items-center gap-1'
            >
              <FileWarning className='h-3 w-3' />
              Compliance
            </Button>
            <Button
              variant='outline'
              size='sm'
              onClick={() => applyPreset('production')}
              className='flex items-center gap-1'
            >
              <Ban className='h-3 w-3' />
              Production
            </Button>
            <Button variant='ghost' size='sm' onClick={resetToDefaults}>
              Reset to Defaults
            </Button>
          </div>
        </div>

        {/* Import/Export */}
        <div className='flex gap-2'>
          <Button
            variant='outline'
            size='sm'
            onClick={handleExport}
            className='flex items-center gap-1'
          >
            <Download className='h-3 w-3' />
            Export
          </Button>
          <label htmlFor='import-constraints'>
            <Button
              variant='outline'
              size='sm'
              className='flex items-center gap-1 cursor-pointer'
              asChild
            >
              <span>
                <Upload className='h-3 w-3' />
                Import
              </span>
            </Button>
            <input
              id='import-constraints'
              type='file'
              accept='.json'
              onChange={handleImport}
              className='hidden'
            />
          </label>
        </div>

        {/* Forbidden Commands */}
        <ConstraintList
          title='Forbidden Commands'
          description='Shell commands that are blocked from execution'
          items={localConstraints.forbiddenCommands}
          onAdd={item => handleAdd('forbiddenCommands', item)}
          onRemove={item => handleRemove('forbiddenCommands', item)}
          placeholder='e.g., rm -rf /'
          icon={<Ban className='h-4 w-4 text-destructive' />}
          variant='destructive'
        />

        {/* Forbidden Paths */}
        <ConstraintList
          title='Forbidden Paths'
          description='File paths that cannot be accessed or modified'
          items={localConstraints.forbiddenPaths}
          onAdd={item => handleAdd('forbiddenPaths', item)}
          onRemove={item => handleRemove('forbiddenPaths', item)}
          placeholder='e.g., /etc/passwd'
          icon={<FileWarning className='h-4 w-4 text-destructive' />}
          variant='destructive'
        />

        {/* Forbidden Actions */}
        <ConstraintList
          title='Forbidden Actions'
          description='Action types that are completely prevented'
          items={localConstraints.forbiddenActions}
          onAdd={item => handleAdd('forbiddenActions', item)}
          onRemove={item => handleRemove('forbiddenActions', item)}
          placeholder='e.g., delete_production_data'
          icon={<Shield className='h-4 w-4 text-destructive' />}
          variant='destructive'
        />

        {/* Require Approval For */}
        <ConstraintList
          title='Require Approval For'
          description='Actions that need human approval before execution'
          items={localConstraints.requireApprovalFor}
          onAdd={item => handleAdd('requireApprovalFor', item)}
          onRemove={item => handleRemove('requireApprovalFor', item)}
          placeholder='e.g., deploy_production'
          icon={<CheckCircle2 className='h-4 w-4 text-yellow-500' />}
          variant='secondary'
        />

        {/* Summary */}
        <div className='pt-4 border-t'>
          <div className='grid grid-cols-2 gap-4 text-sm'>
            <div>
              <span className='text-muted-foreground'>Blocked Commands:</span>
              <span className='ml-2 font-semibold'>
                {localConstraints.forbiddenCommands.length}
              </span>
            </div>
            <div>
              <span className='text-muted-foreground'>Blocked Paths:</span>
              <span className='ml-2 font-semibold'>
                {localConstraints.forbiddenPaths.length}
              </span>
            </div>
            <div>
              <span className='text-muted-foreground'>Blocked Actions:</span>
              <span className='ml-2 font-semibold'>
                {localConstraints.forbiddenActions.length}
              </span>
            </div>
            <div>
              <span className='text-muted-foreground'>Require Approval:</span>
              <span className='ml-2 font-semibold'>
                {localConstraints.requireApprovalFor.length}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
