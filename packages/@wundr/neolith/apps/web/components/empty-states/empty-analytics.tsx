/**
 * Empty Analytics Component
 * @module components/empty-states/empty-analytics
 */
'use client';

import * as React from 'react';
import { BarChart3 } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';

export function EmptyAnalytics() {
  return (
    <EmptyState
      icon={BarChart3}
      title="No analytics data yet"
      description="Analytics and insights will be available once your Virtual Persons and workflows are active."
    />
  );
}
