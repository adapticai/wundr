/**
 * Types for Organization Chart hierarchy display
 */

export type OrgNodeType = 'organization' | 'workspace' | 'vp';

export interface OrgNodeData {
  avatarUrl?: string;
  status?: 'ONLINE' | 'OFFLINE' | 'BUSY' | 'AWAY';
  discipline?: string;
  role?: 'OWNER' | 'ADMIN' | 'MEMBER';
  currentTask?: string;
  vpCount?: number;
  onlineVPCount?: number;
  pendingTasks?: number;
  supervisorId?: string;
}

export interface OrgHierarchyNode {
  id: string;
  type: OrgNodeType;
  name: string;
  children?: OrgHierarchyNode[];
  data?: OrgNodeData;
}

export interface OrgChartProps {
  hierarchy: OrgHierarchyNode;
  onNodeClick?: (node: OrgHierarchyNode) => void;
  className?: string;
}

export interface OrgNodeProps {
  node: OrgHierarchyNode;
  depth: number;
  onNodeClick?: (node: OrgHierarchyNode) => void;
  isExpanded: boolean;
  onToggleExpand: () => void;
  parentType?: OrgNodeType;
}

export interface VPDetailsPopoverProps {
  vp: {
    id: string;
    name: string;
    avatarUrl?: string;
    discipline?: string;
    status: 'ONLINE' | 'OFFLINE' | 'BUSY' | 'AWAY';
    currentTask?: string;
  };
  children: React.ReactNode;
}

// Discipline color mapping for visual grouping
export const DISCIPLINE_COLORS: Record<string, string> = {
  Engineering: 'bg-blue-100 text-blue-800 border-blue-300',
  Product: 'bg-purple-100 text-purple-800 border-purple-300',
  Design: 'bg-pink-100 text-pink-800 border-pink-300',
  Marketing: 'bg-orange-100 text-orange-800 border-orange-300',
  Sales: 'bg-green-100 text-green-800 border-green-300',
  Operations: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  Finance: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  'Human Resources': 'bg-rose-100 text-rose-800 border-rose-300',
  'Customer Success': 'bg-teal-100 text-teal-800 border-teal-300',
  Legal: 'bg-gray-100 text-gray-800 border-gray-300',
  Research: 'bg-indigo-100 text-indigo-800 border-indigo-300',
  'Data Science': 'bg-cyan-100 text-cyan-800 border-cyan-300',
};

// Additional types for advanced features (Wave 1.1.3)
export interface OrgNode {
  id: string;
  name: string;
  title: string;
  discipline: string;
  status: 'ONLINE' | 'OFFLINE' | 'BUSY' | 'AWAY';
  avatarUrl?: string;
  children?: OrgNode[];
}

export interface OrgHierarchy {
  id: string;
  name: string;
  root?: OrgNode;
  vps: OrgNode[];
  createdAt: Date;
  updatedAt: Date;
}

export type DisciplineFilter = 'all' | string;

export interface SearchFilters {
  query: string;
  discipline: DisciplineFilter;
  status?: 'ONLINE' | 'OFFLINE' | 'BUSY' | 'AWAY';
}

export interface ExportOptions {
  format: 'png' | 'pdf';
  filename: string;
  includeMetadata?: boolean;
}
