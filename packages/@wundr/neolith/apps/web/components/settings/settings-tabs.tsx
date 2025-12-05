'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

interface SettingsTab {
  label: string;
  href: string;
  value: string;
}

interface SettingsTabsProps {
  tabs: SettingsTab[];
  baseHref?: string;
}

export function SettingsTabs({ tabs, baseHref }: SettingsTabsProps) {
  const pathname = usePathname();

  // Determine the active tab based on the current pathname
  const activeTab =
    tabs.find(tab => pathname === tab.href)?.value || tabs[0]?.value;

  return (
    <Tabs value={activeTab} className='w-full'>
      <TabsList className='w-full justify-start border-b rounded-none h-auto p-0 bg-transparent'>
        {tabs.map(tab => (
          <Link key={tab.value} href={tab.href} className='flex-1 sm:flex-none'>
            <TabsTrigger
              value={tab.value}
              className={cn(
                'relative rounded-none border-b-2 border-transparent px-4 pb-3 pt-2 font-medium transition-colors',
                'hover:text-foreground data-[state=active]:border-primary',
                'data-[state=active]:shadow-none'
              )}
            >
              {tab.label}
            </TabsTrigger>
          </Link>
        ))}
      </TabsList>
    </Tabs>
  );
}
