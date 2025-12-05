'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';

export interface Breadcrumb {
  label: string;
  href?: string;
}

interface PageHeaderContextValue {
  title: string;
  subtitle?: string;
  breadcrumbs?: Breadcrumb[];
  setPageHeader: (title: string, subtitle?: string) => void;
  setBreadcrumbs: (breadcrumbs: Breadcrumb[]) => void;
}

const PageHeaderContext = createContext<PageHeaderContextValue | undefined>(
  undefined,
);

export interface PageHeaderProviderProps {
  children: React.ReactNode;
}

export function PageHeaderProvider({ children }: PageHeaderProviderProps) {
  const [title, setTitle] = useState<string>('Dashboard');
  const [subtitle, setSubtitle] = useState<string | undefined>(undefined);
  const [breadcrumbs, setBreadcrumbsState] = useState<Breadcrumb[] | undefined>(
    undefined,
  );

  const setPageHeader = useCallback(
    (newTitle: string, newSubtitle?: string) => {
      setTitle(newTitle);
      setSubtitle(newSubtitle);
    },
    [],
  );

  const setBreadcrumbs = useCallback((newBreadcrumbs: Breadcrumb[]) => {
    setBreadcrumbsState(newBreadcrumbs);
  }, []);

  const value: PageHeaderContextValue = {
    title,
    subtitle,
    breadcrumbs,
    setPageHeader,
    setBreadcrumbs,
  };

  return (
    <PageHeaderContext.Provider value={value}>
      {children}
    </PageHeaderContext.Provider>
  );
}

export function usePageHeader(): PageHeaderContextValue {
  const context = useContext(PageHeaderContext);

  if (context === undefined) {
    throw new Error('usePageHeader must be used within a PageHeaderProvider');
  }

  return context;
}
