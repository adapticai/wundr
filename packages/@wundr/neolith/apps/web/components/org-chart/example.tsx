/**
 * Example usage of OrgHierarchyChart component
 * This demonstrates how to structure and use the org chart hierarchy visualization
 */

'use client';

import { useState } from 'react';
import { OrgHierarchyChart, OrgHierarchyChartSkeleton, OrgHierarchyChartEmpty } from './OrgHierarchyChart';
import type { OrgHierarchyNode } from './types';

/**
 * Example data structure for organization hierarchy
 */
const exampleHierarchy: OrgHierarchyNode = {
  id: 'org-1',
  type: 'organization',
  name: 'Acme Corporation',
  data: {
    role: 'OWNER',
  },
  children: [
    {
      id: 'workspace-1',
      type: 'workspace',
      name: 'Engineering',
      data: {
        vpCount: 5,
        onlineVPCount: 3,
      },
      children: [
        {
          id: 'vp-1',
          type: 'vp',
          name: 'Alice Johnson',
          data: {
            avatarUrl: '/avatars/alice.jpg',
            status: 'ONLINE',
            discipline: 'Engineering',
            role: 'ADMIN',
            currentTask: 'Reviewing pull requests for the new API',
          },
        },
        {
          id: 'vp-2',
          type: 'vp',
          name: 'Bob Smith',
          data: {
            status: 'BUSY',
            discipline: 'Engineering',
            role: 'MEMBER',
            currentTask: 'Implementing authentication system',
          },
        },
        {
          id: 'vp-3',
          type: 'vp',
          name: 'Charlie Brown',
          data: {
            status: 'ONLINE',
            discipline: 'Engineering',
            role: 'MEMBER',
            currentTask: 'Writing unit tests',
          },
        },
      ],
    },
    {
      id: 'workspace-2',
      type: 'workspace',
      name: 'Product & Design',
      data: {
        vpCount: 4,
        onlineVPCount: 2,
      },
      children: [
        {
          id: 'vp-4',
          type: 'vp',
          name: 'Diana Prince',
          data: {
            status: 'ONLINE',
            discipline: 'Product',
            role: 'ADMIN',
            currentTask: 'Planning Q4 roadmap',
          },
        },
        {
          id: 'vp-5',
          type: 'vp',
          name: 'Eve Torres',
          data: {
            status: 'ONLINE',
            discipline: 'Design',
            role: 'MEMBER',
            currentTask: 'Creating design system components',
          },
        },
        {
          id: 'vp-6',
          type: 'vp',
          name: 'Frank Castle',
          data: {
            status: 'AWAY',
            discipline: 'Design',
            role: 'MEMBER',
            currentTask: 'User research interviews',
          },
        },
        {
          id: 'vp-7',
          type: 'vp',
          name: 'Grace Hopper',
          data: {
            status: 'OFFLINE',
            discipline: 'Product',
            role: 'MEMBER',
          },
        },
      ],
    },
    {
      id: 'workspace-3',
      type: 'workspace',
      name: 'Customer Success',
      data: {
        vpCount: 3,
        onlineVPCount: 3,
      },
      children: [
        {
          id: 'vp-8',
          type: 'vp',
          name: 'Henry Ford',
          data: {
            status: 'ONLINE',
            discipline: 'Customer Success',
            role: 'MEMBER',
            currentTask: 'Responding to support tickets',
          },
        },
        {
          id: 'vp-9',
          type: 'vp',
          name: 'Irene Curie',
          data: {
            status: 'ONLINE',
            discipline: 'Customer Success',
            role: 'MEMBER',
            currentTask: 'Customer onboarding session',
          },
        },
        {
          id: 'vp-10',
          type: 'vp',
          name: 'Jack Sparrow',
          data: {
            status: 'BUSY',
            discipline: 'Sales',
            role: 'MEMBER',
            currentTask: 'Client demo presentation',
          },
        },
      ],
    },
  ],
};

/**
 * Example component demonstrating OrgHierarchyChart usage
 */
export function OrgChartExample() {
  const [isLoading, setIsLoading] = useState(false);
  const [hasData, setHasData] = useState(true);

  const handleNodeClick = (node: OrgHierarchyNode) => {
    console.log('Clicked node:', node);
    // You can navigate to a detail page, show a modal, etc.
    if (node.type === 'vp') {
      // Navigate to VP detail page
      // router.push(`/vp/${node.id}`);
    } else if (node.type === 'workspace') {
      // Navigate to workspace page
      // router.push(`/workspace/${node.id}`);
    }
  };

  if (isLoading) {
    return <OrgHierarchyChartSkeleton />;
  }

  if (!hasData) {
    return <OrgHierarchyChartEmpty message="No organization data available. Create your first workspace to get started." />;
  }

  return (
    <div className="container mx-auto py-8 space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Organization Hierarchy</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setIsLoading(!isLoading)}
            className="px-4 py-2 text-sm border rounded-md hover:bg-accent"
          >
            Toggle Loading
          </button>
          <button
            onClick={() => setHasData(!hasData)}
            className="px-4 py-2 text-sm border rounded-md hover:bg-accent"
          >
            Toggle Data
          </button>
        </div>
      </div>

      <OrgHierarchyChart
        hierarchy={exampleHierarchy}
        onNodeClick={handleNodeClick}
      />
    </div>
  );
}

/**
 * Integration example with API data fetching
 * Uncomment useEffect to enable real API integration
 */
export function OrgChartWithAPI() {
  // For demonstration, using example data. Replace with real API call.
  const hierarchy = exampleHierarchy;
  const isLoading = false;
  const error = null;

  // Uncomment to enable real API fetching:
  // const [hierarchy, setHierarchy] = useState<OrgHierarchyNode | null>(null);
  // const [isLoading, setIsLoading] = useState(true);
  // const [error, setError] = useState<string | null>(null);

  // useEffect(() => {
  //   async function fetchOrgHierarchy() {
  //     try {
  //       setIsLoading(true);
  //       const response = await fetch('/api/org/hierarchy');
  //       if (!response.ok) throw new Error('Failed to fetch organization hierarchy');
  //       const data = await response.json();
  //       setHierarchy(data);
  //     } catch (err) {
  //       setError(err instanceof Error ? err.message : 'An error occurred');
  //     } finally {
  //       setIsLoading(false);
  //     }
  //   }
  //   fetchOrgHierarchy();
  // }, []);

  if (isLoading) {
    return <OrgHierarchyChartSkeleton />;
  }

  if (error) {
    return <div className="text-destructive">Error: {error}</div>;
  }

  if (!hierarchy) {
    return <OrgHierarchyChartEmpty />;
  }

  return (
    <OrgHierarchyChart
      hierarchy={hierarchy}
      onNodeClick={(node) => console.log('Clicked:', node)}
    />
  );
}
