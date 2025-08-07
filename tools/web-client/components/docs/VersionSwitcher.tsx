'use client';

import React from 'react';
import { Check, ChevronDown, AlertTriangle } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DocVersion, DOCS_VERSIONS } from '@/lib/docs-utils';

interface VersionSwitcherProps {
  currentVersion?: string;
  onVersionChange?: (version: DocVersion) => void;
  className?: string;
}

export function VersionSwitcher({ 
  currentVersion, 
  onVersionChange,
  className 
}: VersionSwitcherProps) {
  const current = DOCS_VERSIONS.find(v => v.version === currentVersion) || DOCS_VERSIONS[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="outline" 
          className={`justify-between min-w-[140px] ${className}`}
        >
          <div className="flex items-center gap-2">
            <span className="font-medium">{current.label}</span>
            {current.isLatest && (
              <Badge variant="secondary" className="text-xs px-1.5 py-0.5">
                Latest
              </Badge>
            )}
          </div>
          <ChevronDown className="h-4 w-4 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent align="end" className="w-56">
        {DOCS_VERSIONS.map((version) => (
          <DropdownMenuItem
            key={version.version}
            onClick={() => onVersionChange?.(version)}
            className="flex items-center justify-between cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <span className="font-medium">{version.label}</span>
              {version.deprecated && (
                <AlertTriangle className="h-3 w-3 text-yellow-500" />
              )}
              {version.isLatest && (
                <Badge variant="secondary" className="text-xs px-1.5 py-0.5">
                  Latest
                </Badge>
              )}
            </div>
            {current.version === version.version && (
              <Check className="h-4 w-4 text-primary" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}