'use client';

import { useEffect } from 'react';

import { usePageHeader } from '@/contexts/page-header-context';

/**
 * Example usage of usePageHeader hook in a page component
 *
 * Simply import this pattern into any client component to set the page header:
 *
 * import { usePageHeader } from '@/contexts/page-header-context';
 *
 * export function MyPageComponent() {
 *   const { setPageHeader, setBreadcrumbs } = usePageHeader();
 *
 *   useEffect(() => {
 *     setPageHeader('My Page Title', 'Optional subtitle');
 *     setBreadcrumbs([
 *       { label: 'Home', href: '/' },
 *       { label: 'Settings', href: '/settings' },
 *       { label: 'Profile' }
 *     ]);
 *   }, [setPageHeader, setBreadcrumbs]);
 *
 *   return (
 *     <div>Page content here</div>
 *   );
 * }
 */
export function DynamicPageHeaderExample() {
  const { setPageHeader, setBreadcrumbs } = usePageHeader();

  useEffect(() => {
    // Set title and subtitle
    setPageHeader('Example Page', 'This is an example of dynamic page headers');

    // Set breadcrumbs
    setBreadcrumbs([
      { label: 'Home', href: '/' },
      { label: 'Documentation', href: '/docs' },
      { label: 'Examples' },
    ]);

    // Clean up on unmount (optional, but recommended)
    return () => {
      setPageHeader('Dashboard');
      setBreadcrumbs([]);
    };
  }, [setPageHeader, setBreadcrumbs]);

  return (
    <div className='space-y-6'>
      <div className='rounded-lg border bg-card p-6'>
        <h2 className='text-xl font-semibold mb-4'>
          Dynamic Page Header Example
        </h2>
        <p className='text-muted-foreground mb-4'>
          This page demonstrates how to use the dynamic page header component.
          The header above this content automatically updates based on the
          context you provide.
        </p>

        <div className='space-y-4'>
          <div>
            <h3 className='font-medium mb-2'>Features:</h3>
            <ul className='list-disc list-inside space-y-1 text-sm text-muted-foreground'>
              <li>Dynamic title updates</li>
              <li>Optional subtitle support</li>
              <li>Breadcrumb navigation</li>
              <li>Smooth transitions</li>
              <li>Default fallback to "Dashboard"</li>
            </ul>
          </div>

          <div>
            <h3 className='font-medium mb-2'>Usage in your components:</h3>
            <pre className='bg-muted p-4 rounded-md overflow-x-auto text-xs'>
              {`const { setPageHeader, setBreadcrumbs } = usePageHeader();

useEffect(() => {
  setPageHeader('Your Title', 'Your subtitle');
  setBreadcrumbs([
    { label: 'Home', href: '/' },
    { label: 'Current Page' }
  ]);
}, [setPageHeader, setBreadcrumbs]);`}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
