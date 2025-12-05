'use client';

import { Search } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';

import { SettingsBreadcrumb } from './settings-breadcrumb';
import { SettingsSearch } from './settings-search';

interface SettingsHeaderProps {
  workspaceSlug: string;
  title: string;
  description?: string;
}

export function SettingsHeader({
  workspaceSlug,
  title,
  description,
}: SettingsHeaderProps) {
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <>
      <div className='space-y-4 border-b pb-4'>
        <div className='flex items-center justify-between'>
          <SettingsBreadcrumb workspaceSlug={workspaceSlug} />
          <Button
            variant='outline'
            size='sm'
            onClick={() => setSearchOpen(true)}
            className='gap-2'
          >
            <Search className='h-4 w-4' />
            <span className='hidden sm:inline'>Search settings</span>
            <kbd className='pointer-events-none hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex'>
              <span className='text-xs'>⌘</span>K
            </kbd>
          </Button>
        </div>
        <div>
          <h1 className='text-2xl font-bold tracking-tight'>{title}</h1>
          {description && (
            <p className='text-sm text-muted-foreground mt-1'>{description}</p>
          )}
        </div>
      </div>

      <SettingsSearch
        workspaceSlug={workspaceSlug}
        open={searchOpen}
        onOpenChange={setSearchOpen}
      />
    </>
  );
}
