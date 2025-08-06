'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Home, ChevronRight, Folder } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface BreadcrumbItem {
  name: string;
  path: string;
  isLast: boolean;
}

export interface BreadcrumbNavigationProps {
  items: BreadcrumbItem[];
  onNavigate: (path: string) => void;
  className?: string;
}

export function BreadcrumbNavigation({
  items,
  onNavigate,
  className,
}: BreadcrumbNavigationProps) {
  return (
    <div className={cn('flex items-center gap-1 overflow-x-auto', className)}>
      <Button
        variant="ghost"
        size="sm"
        className="h-6 w-6 p-0 flex-shrink-0"
        onClick={() => onNavigate('/')}
      >
        <Home className="h-3 w-3" />
      </Button>
      
      {items.map((item, index) => (
        <React.Fragment key={item.path}>
          <ChevronRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              'h-6 px-2 text-sm whitespace-nowrap',
              item.isLast 
                ? 'font-medium text-foreground cursor-default' 
                : 'text-muted-foreground hover:text-foreground'
            )}
            onClick={() => !item.isLast && onNavigate(item.path)}
            disabled={item.isLast}
          >
            {index === 0 && <Folder className="h-3 w-3 mr-1" />}
            {item.name}
          </Button>
        </React.Fragment>
      ))}
    </div>
  );
}

export default BreadcrumbNavigation;