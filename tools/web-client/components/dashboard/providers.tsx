'use client';

import { ReactNode } from 'react';
import { ConfigProvider } from '@/lib/contexts/config/config-context';
import { AnalysisProvider } from '@/lib/contexts/analysis-context';

export function DashboardProviders({ children }: { children: ReactNode }) {
  return (
    <ConfigProvider>
      <AnalysisProvider>
        {children}
      </AnalysisProvider>
    </ConfigProvider>
  );
}