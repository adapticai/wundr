'use client';

import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  FileCode,
  ExternalLink,
  Copy,
  CheckCheck,
} from 'lucide-react';
import type { EntityData } from '@/app/api/analysis/entities/route';

interface EntityDetailsTableProps {
  entities: EntityData[];
}

type SortKey = keyof EntityData | 'dependencyCount';
type SortDirection = 'asc' | 'desc';

export function EntityDetailsTable({ entities }: EntityDetailsTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [copiedEntity, setCopiedEntity] = useState<string | null>(null);

  const sortedEntities = useMemo(() => {
    return [...entities].sort((a, b) => {
      let aValue: any;
      let bValue: any;

      if (sortKey === 'dependencyCount') {
        aValue = a.dependencies.length;
        bValue = b.dependencies.length;
      } else {
        aValue = a[sortKey];
        bValue = b[sortKey];
      }

      // Handle undefined/null values
      if (aValue == null) aValue = '';
      if (bValue == null) bValue = '';

      // Convert to string for comparison if needed
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [entities, sortKey, sortDirection]);

  const paginatedEntities = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return sortedEntities.slice(startIndex, startIndex + pageSize);
  }, [sortedEntities, currentPage, pageSize]);

  const totalPages = Math.ceil(sortedEntities.length / pageSize);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
    setCurrentPage(1);
  };

  const getSortIcon = (key: SortKey) => {
    if (sortKey !== key) {
      return <ArrowUpDown className="ml-2 h-4 w-4" />;
    }
    return sortDirection === 'asc' ? 
      <ArrowUp className="ml-2 h-4 w-4" /> : 
      <ArrowDown className="ml-2 h-4 w-4" />;
  };

  const getComplexityBadge = (complexity?: number) => {
    if (!complexity || complexity === 0) {
      return <Badge variant="secondary">Unknown</Badge>;
    }
    
    if (complexity <= 5) {
      return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">Low</Badge>;
    } else if (complexity <= 10) {
      return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">Medium</Badge>;
    } else if (complexity <= 15) {
      return <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200">High</Badge>;
    } else {
      return <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">Very High</Badge>;
    }
  };

  const getTypeBadge = (type: string) => {
    const colors = {
      class: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      interface: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
      function: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      type: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
      service: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
    };
    
    const colorClass = colors[type as keyof typeof colors] || 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    
    return <Badge className={colorClass}>{type}</Badge>;
  };

  const copyEntityName = (name: string) => {
    navigator.clipboard.writeText(name);
    setCopiedEntity(name);
    setTimeout(() => setCopiedEntity(null), 2000);
  };

  const formatFileName = (filePath: string) => {
    const parts = filePath.split('/');
    return parts[parts.length - 1];
  };

  if (entities.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No entities match the current filters
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[250px]">
                <Button
                  variant="ghost"
                  onClick={() => handleSort('name')}
                  className="h-auto p-0 font-semibold"
                >
                  Name
                  {getSortIcon('name')}
                </Button>
              </TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  onClick={() => handleSort('type')}
                  className="h-auto p-0 font-semibold"
                >
                  Type
                  {getSortIcon('type')}
                </Button>
              </TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  onClick={() => handleSort('file')}
                  className="h-auto p-0 font-semibold"
                >
                  File
                  {getSortIcon('file')}
                </Button>
              </TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  onClick={() => handleSort('complexity')}
                  className="h-auto p-0 font-semibold"
                >
                  Complexity
                  {getSortIcon('complexity')}
                </Button>
              </TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  onClick={() => handleSort('dependencyCount')}
                  className="h-auto p-0 font-semibold"
                >
                  Dependencies
                  {getSortIcon('dependencyCount')}
                </Button>
              </TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  onClick={() => handleSort('exportType')}
                  className="h-auto p-0 font-semibold"
                >
                  Export
                  {getSortIcon('exportType')}
                </Button>
              </TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedEntities.map((entity, index) => (
              <TableRow key={`${entity.name}-${index}`}>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    <FileCode className="h-4 w-4 text-muted-foreground" />
                    <span className="truncate max-w-[200px]" title={entity.name}>
                      {entity.name}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => copyEntityName(entity.name)}
                    >
                      {copiedEntity === entity.name ? (
                        <CheckCheck className="h-3 w-3 text-green-600" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </Button>
                  </div>
                </TableCell>
                <TableCell>
                  {getTypeBadge(entity.type)}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <span className="text-sm text-muted-foreground truncate max-w-[150px]" title={entity.file}>
                      {formatFileName(entity.file)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      :{entity.line}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {getComplexityBadge(entity.complexity)}
                    {entity.complexity && entity.complexity > 0 && (
                      <span className="text-sm text-muted-foreground">
                        ({entity.complexity})
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">
                      {entity.dependencies.length}
                    </Badge>
                    {entity.dependencies.length > 0 && (
                      <div className="text-xs text-muted-foreground max-w-[100px] truncate" title={entity.dependencies.join(', ')}>
                        {entity.dependencies.slice(0, 2).join(', ')}
                        {entity.dependencies.length > 2 && '...'}
                      </div>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="secondary" className="capitalize">
                    {entity.exportType}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="sm">
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Showing {Math.min((currentPage - 1) * pageSize + 1, sortedEntities.length)} to{' '}
          {Math.min(currentPage * pageSize, sortedEntities.length)} of {sortedEntities.length} entities
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
          >
            Previous
          </Button>
          
          <div className="flex items-center gap-1">
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const page = i + 1;
              return (
                <Button
                  key={page}
                  variant={currentPage === page ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setCurrentPage(page)}
                  className="w-8 h-8 p-0"
                >
                  {page}
                </Button>
              );
            })}
            {totalPages > 5 && (
              <>
                <span className="text-muted-foreground">...</span>
                <Button
                  variant={currentPage === totalPages ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setCurrentPage(totalPages)}
                  className="w-8 h-8 p-0"
                >
                  {totalPages}
                </Button>
              </>
            )}
          </div>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage === totalPages}
          >
            Next
          </Button>
        </div>
      </div>

      {/* Page Size Control */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Rows per page:</span>
        <select
          value={pageSize}
          onChange={(e) => {
            setPageSize(Number(e.target.value));
            setCurrentPage(1);
          }}
          className="border rounded px-2 py-1 text-sm"
        >
          <option value={10}>10</option>
          <option value={20}>20</option>
          <option value={50}>50</option>
          <option value={100}>100</option>
        </select>
      </div>
    </div>
  );
}