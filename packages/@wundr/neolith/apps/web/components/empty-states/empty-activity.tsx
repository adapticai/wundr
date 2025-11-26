/**
 * Empty Activity Component
 * @module components/empty-states/empty-activity
 */
'use client';

import * as React from 'react';
import { Activity } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';

export function EmptyActivity() {
  return (
    <EmptyState
      icon={Activity}
      title="No activity yet"
      description="Activity from your team and Virtual Persons will appear here once you start working."
    />
  );
}
