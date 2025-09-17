'use client';

import { useState, useEffect } from 'react';
import { Archive, Download, Eye, History, Search, Filter, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { useReports } from '@/hooks/reports/use-reports';
import { HistoricalReport, Report } from '@/types/reports';
import { format, formatDistanceToNow } from 'date-fns';

interface HistoricalReportsArchiveProps {
  className?: string;
}

export function HistoricalReportsArchive({ className }: HistoricalReportsArchiveProps) {
  const { reports, getHistoricalReports } = useReports();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPeriod, setSelectedPeriod] = useState<'7d' | '30d' | '90d' | 'all'>('30d');
  const [sortBy, setSortBy] = useState<'date' | 'name' | 'size'>('date');
  const [expandedReports, setExpandedReports] = useState<Set<string>>(new Set());
  const [historicalData, setHistoricalData] = useState<Map<string, HistoricalReport>>(new Map());
  const [loading, setLoading] = useState<Set<string>>(new Set());

  const formatFileSize = (bytes: number): string => {
    const sizes = ['B', 'KB', 'MB', 'GB'];
    let i = 0;
    let size = bytes;
    
    while (size >= 1024 && i < sizes.length - 1) {
      size /= 1024;
      i++;
    }
    
    return `${size.toFixed(1)} ${sizes[i]}`;
  };

  const filterReportsByPeriod = (reports: Report[]) => {
    if (selectedPeriod === 'all') return reports;
    
    const now = new Date();
    const days = parseInt(selectedPeriod.replace('d', ''));
    const cutoffDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    
    return reports.filter(report => report.createdAt >= cutoffDate);
  };

  const filteredReports = filterReportsByPeriod(reports)
    .filter(report => {
      const matchesSearch = report.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           report.description?.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesSearch && report.status === 'completed';
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'size':
          return (b.size || 0) - (a.size || 0);
        case 'date':
        default:
          return b.createdAt.getTime() - a.createdAt.getTime();
      }
    });

  const toggleReportExpansion = async (reportId: string) => {
    const newExpanded = new Set(expandedReports);
    
    if (newExpanded.has(reportId)) {
      newExpanded.delete(reportId);
    } else {
      newExpanded.add(reportId);
      
      // Load historical data if not already loaded
      if (!historicalData.has(reportId)) {
        setLoading(prev => new Set(prev).add(reportId));
        try {
          const data = await getHistoricalReports(reportId);
          setHistoricalData(prev => new Map(prev).set(reportId, data));
        } catch (_error) {
          // Error logged - details available in network tab;
        } finally {
          setLoading(prev => {
            const newLoading = new Set(prev);
            newLoading.delete(reportId);
            return newLoading;
          });
        }
      }
    }
    
    setExpandedReports(newExpanded);
  };

  const handleDownloadVersion = (reportId: string, version: number) => {
    // In a real implementation, this would download the specific version
    const historical = historicalData.get(reportId);
    if (historical) {
      const versionData = historical.versions.find(v => v.version === version);
      if (versionData) {
        console.log(`Downloading version ${version} of report ${reportId}`);
        // Simulate download
        const blob = new Blob(['Mock historical report data'], { type: 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${historical.report.name}_v${version}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    }
  };

  const getTotalArchiveSize = () => {
    return filteredReports.reduce((total, report) => total + (report.size || 0), 0);
  };

  const getVersionBadgeColor = (version: number, totalVersions: number) => {
    if (version === totalVersions) return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
    if (version === totalVersions - 1) return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
    return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
  };

  return (
    <div className={`space-y-6 ${className}`}>
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Archive className="h-6 w-6" />
            Historical Reports Archive
          </h2>
          <p className="text-muted-foreground">
            Browse and download previous versions of your reports
          </p>
        </div>
        <div className="flex gap-2 text-sm text-muted-foreground">
          <span>{filteredReports.length} reports</span>
          <span>•</span>
          <span>{formatFileSize(getTotalArchiveSize())}</span>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-1 gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search archived reports..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={selectedPeriod} onValueChange={(value: '7d' | '30d' | '90d' | 'all') => setSelectedPeriod(value)}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7d">Last 7 days</SelectItem>
                  <SelectItem value="30d">Last 30 days</SelectItem>
                  <SelectItem value="90d">Last 90 days</SelectItem>
                  <SelectItem value="all">All time</SelectItem>
                </SelectContent>
              </Select>
              <Select value={sortBy} onValueChange={(value: 'date' | 'name' | 'size') => setSortBy(value)}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="date">Sort by Date</SelectItem>
                  <SelectItem value="name">Sort by Name</SelectItem>
                  <SelectItem value="size">Sort by Size</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Archive Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Reports</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{filteredReports.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Archive Size</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatFileSize(getTotalArchiveSize())}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">This Week</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {filterReportsByPeriod([...reports]).filter(r => {
                const weekAgo = new Date();
                weekAgo.setDate(weekAgo.getDate() - 7);
                return r.createdAt >= weekAgo && r.status === 'completed';
              }).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Avg Size</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {filteredReports.length > 0 
                ? formatFileSize(getTotalArchiveSize() / filteredReports.length)
                : '0 B'
              }
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Reports Archive */}
      <Card>
        <CardHeader>
          <CardTitle>Archived Reports</CardTitle>
          <CardDescription>
            Click on any report to view its version history and download previous versions
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredReports.length === 0 ? (
            <div className="text-center py-8">
              <Archive className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No Archived Reports</h3>
              <p className="text-muted-foreground">
                Completed reports will appear here for historical access.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredReports.map((report) => (
                <Collapsible key={report.id}>
                  <CollapsibleTrigger asChild>
                    <div
                      className="flex items-center justify-between p-4 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => toggleReportExpansion(report.id)}
                    >
                      <div className="flex items-center gap-4">
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10">
                          {expandedReports.has(report.id) ? (
                            <History className="h-4 w-4 text-primary" />
                          ) : (
                            <Archive className="h-4 w-4 text-primary" />
                          )}
                        </div>
                        <div>
                          <h4 className="font-medium">{report.name}</h4>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <span>{format(report.createdAt, 'MMM d, yyyy HH:mm')}</span>
                            <span>•</span>
                            <span>{report.size ? formatFileSize(report.size) : 'Unknown size'}</span>
                            <span>•</span>
                            <span>by {report.createdBy}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">
                          {report.type.replace('-', ' ')}
                        </Badge>
                        {report.tags.slice(0, 2).map((tag) => (
                          <Badge key={tag} variant="secondary" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="px-4 pb-4">
                      {loading.has(report.id) ? (
                        <div className="flex items-center justify-center py-8">
                          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                          <span className="ml-2">Loading version history...</span>
                        </div>
                      ) : historicalData.has(report.id) ? (
                        <div className="mt-4">
                          <h5 className="font-medium mb-3">Version History</h5>
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Version</TableHead>
                                <TableHead>Created</TableHead>
                                <TableHead>Changes</TableHead>
                                <TableHead>Size</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {historicalData.get(report.id)!.versions.map((version) => (
                                <TableRow key={version.version}>
                                  <TableCell>
                                    <Badge
                                      className={getVersionBadgeColor(
                                        version.version,
                                        historicalData.get(report.id)!.versions.length
                                      )}
                                    >
                                      v{version.version}
                                      {version.version === historicalData.get(report.id)!.versions.length && (
                                        <span className="ml-1">(Latest)</span>
                                      )}
                                    </Badge>
                                  </TableCell>
                                  <TableCell>
                                    <div className="text-sm">
                                      {format(version.createdAt, 'MMM d, yyyy HH:mm')}
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                      {formatDistanceToNow(version.createdAt, { addSuffix: true })}
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <div className="text-sm">
                                      {version.changes.join(', ')}
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    {formatFileSize(version.size)}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <div className="flex gap-1 justify-end">
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleDownloadVersion(report.id, version.version)}
                                      >
                                        <Download className="h-4 w-4" />
                                      </Button>
                                      <Button variant="ghost" size="sm">
                                        <Eye className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      ) : (
                        <div className="text-center py-4 text-muted-foreground">
                          Click to load version history
                        </div>
                      )}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}