'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useAnalysis } from '@/lib/contexts/analysis-context';
import { useChartTheme } from '@/hooks/chart/useChartTheme';
import { useDataCache } from '@/hooks/use-data-cache';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { DashboardCharts } from '@/components/dashboard/dashboard-charts';
import { SummaryCard } from '@/components/dashboard/summary-card';
import {
  FileText,
  Calendar,
  HardDrive,
  Download,
  Upload,
  RefreshCw,
  Search,
  // Filter,
  BarChart3,
  // PieChart,
  TrendingUp,
  GitCompare,
  CheckCircle,
  AlertTriangle,
  // XCircle,
  Database,
  // Clock,
  // Users,
  Code,
  FileCode,
  Copy,
  GitBranch,
  FileX,
  Bug,
  // Share2,
  // Eye,
  Trash2,
  // Plus,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Bar, Line, Doughnut } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface LoadedReport {
  id: string;
  name: string;
  fileName: string;
  uploadDate: string;
  fileSize: number;
  analysisData: Record<string, unknown>;
  summary: {
    totalFiles: number;
    totalEntities: number;
    duplicateClusters: number;
    circularDependencies: number;
    unusedExports: number;
    codeSmells: number;
  };
  metadata: {
    version: string;
    generator: string;
    environment: string;
    duration: number;
  };
}

interface ComparisonMetrics {
  reportA: LoadedReport;
  reportB: LoadedReport;
  changes: {
    totalFiles: number;
    totalEntities: number;
    duplicateClusters: number;
    circularDependencies: number;
    unusedExports: number;
    codeSmells: number;
  };
  trends: {
    improving: number;
    degrading: number;
    stable: number;
  };
}

export default function LoadReportPage() {
  const { data, loading, error, loadFromFile } = useAnalysis();
  const chartTheme = useChartTheme();
  const { cache } = useDataCache<LoadedReport>('load-reports');
  
  const [loadedReports, setLoadedReports] = useState<LoadedReport[]>([]);
  const [selectedReport, setSelectedReport] = useState<LoadedReport | null>(null);
  const [comparisonMode, setComparisonMode] = useState(false);
  const [comparisonReports, setComparisonReports] = useState<[LoadedReport | null, LoadedReport | null]>([null, null]);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'date' | 'size'>('date');
  const [filterBy, setFilterBy] = useState<'all' | 'recent' | 'large' | 'complex'>('all');
  const [isUploading, setIsUploading] = useState(false);

  // Load reports from cache on mount
  useEffect(() => {
    const savedReports = localStorage.getItem('wundr-loaded-reports');
    if (savedReports) {
      try {
        const reports = JSON.parse(savedReports);
        setLoadedReports(reports);
        if (reports.length > 0 && !selectedReport) {
          setSelectedReport(reports[0]);
        }
      } catch (error) {
        console.error('Failed to load saved reports:', error);
      }
    }
  }, [selectedReport]);

  // Save reports to localStorage when updated
  useEffect(() => {
    if (loadedReports.length > 0) {
      localStorage.setItem('wundr-loaded-reports', JSON.stringify(loadedReports));
    }
  }, [loadedReports]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const text = await file.text();
      const analysisData = JSON.parse(text);
      
      const newReport: LoadedReport = {
        id: `report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: file.name.replace(/\.[^/.]+$/, ''),
        fileName: file.name,
        uploadDate: new Date().toISOString(),
        fileSize: file.size,
        analysisData,
        summary: analysisData.summary || {
          totalFiles: 0,
          totalEntities: 0,
          duplicateClusters: 0,
          circularDependencies: 0,
          unusedExports: 0,
          codeSmells: 0,
        },
        metadata: {
          version: analysisData.version || 'Unknown',
          generator: analysisData.generator || 'Wundr Analysis',
          environment: analysisData.environment || 'Production',
          duration: analysisData.metadata?.duration || 0,
        },
      };

      setLoadedReports(prev => [newReport, ...prev]);
      setSelectedReport(newReport);
      
      // Also load into analysis context for full dashboard features
      await loadFromFile(file);
      
      cache.set(newReport.id, newReport);
    } catch (error) {
      console.error('Failed to parse analysis file:', error);
      alert('Failed to parse analysis file. Please ensure it\'s a valid JSON file.');
    } finally {
      setIsUploading(false);
      // Reset file input
      event.target.value = '';
    }
  };

  const handleExportReport = (report: LoadedReport) => {
    const dataStr = JSON.stringify(report.analysisData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${report.name}_export.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const handleDeleteReport = (reportId: string) => {
    setLoadedReports(prev => prev.filter(r => r.id !== reportId));
    if (selectedReport?.id === reportId) {
      const remaining = loadedReports.filter(r => r.id !== reportId);
      setSelectedReport(remaining[0] || null);
    }
    cache.delete(reportId);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const filteredAndSortedReports = useMemo(() => {
    const filtered = loadedReports.filter(report => {
      const matchesSearch = report.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           report.fileName.toLowerCase().includes(searchTerm.toLowerCase());
      
      if (!matchesSearch) return false;

      switch (filterBy) {
        case 'recent':
          return new Date(report.uploadDate) > new Date(Date.now() - 24 * 60 * 60 * 1000);
        case 'large':
          return report.fileSize > 1024 * 1024; // > 1MB
        case 'complex':
          return report.summary.totalEntities > 100;
        default:
          return true;
      }
    });

    return filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'size':
          return b.fileSize - a.fileSize;
        case 'date':
        default:
          return new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime();
      }
    });
  }, [loadedReports, searchTerm, sortBy, filterBy]);

  const comparisonMetrics = useMemo((): ComparisonMetrics | null => {
    if (!comparisonReports[0] || !comparisonReports[1]) return null;

    const [reportA, reportB] = comparisonReports;
    const changes = {
      totalFiles: reportB.summary.totalFiles - reportA.summary.totalFiles,
      totalEntities: reportB.summary.totalEntities - reportA.summary.totalEntities,
      duplicateClusters: reportB.summary.duplicateClusters - reportA.summary.duplicateClusters,
      circularDependencies: reportB.summary.circularDependencies - reportA.summary.circularDependencies,
      unusedExports: reportB.summary.unusedExports - reportA.summary.unusedExports,
      codeSmells: reportB.summary.codeSmells - reportA.summary.codeSmells,
    };

    const totalChanges = Object.values(changes).length;
    const improving = Object.values(changes).filter(change => change < 0).length;
    const degrading = Object.values(changes).filter(change => change > 0).length;
    const stable = totalChanges - improving - degrading;

    return {
      reportA,
      reportB,
      changes,
      trends: { improving, degrading, stable },
    };
  }, [comparisonReports]);

  const renderComparisonChart = () => {
    if (!comparisonMetrics) return null;

    const labels = ['Total Files', 'Entities', 'Duplicates', 'Circular Deps', 'Unused Exports', 'Code Smells'];
    const reportAData = Object.values(comparisonMetrics.reportA.summary);
    const reportBData = Object.values(comparisonMetrics.reportB.summary);

    const chartData = {
      labels,
      datasets: [
        {
          label: comparisonMetrics.reportA.name,
          data: reportAData,
          backgroundColor: chartTheme.colors.primary,
          borderColor: chartTheme.colors.primary,
        },
        {
          label: comparisonMetrics.reportB.name,
          data: reportBData,
          backgroundColor: chartTheme.colors.secondary,
          borderColor: chartTheme.colors.secondary,
        },
      ],
    };

    const options = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top' as const,
        },
        tooltip: {
          backgroundColor: chartTheme.tooltip.backgroundColor,
          titleColor: chartTheme.tooltip.titleColor,
          bodyColor: chartTheme.tooltip.bodyColor,
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            color: chartTheme.ticks.color,
          },
          grid: {
            color: chartTheme.grid.color,
          },
        },
        x: {
          ticks: {
            color: chartTheme.ticks.color,
          },
          grid: {
            display: false,
          },
        },
      },
    };

    return (
      <div className="h-[400px]">
        <Bar data={chartData} options={options} />
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Load Analysis Report</h1>
        </div>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="text-muted-foreground">Loading analysis data...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Load Analysis Report</h1>
          <p className="text-sm text-muted-foreground">
            Upload, view, and compare analysis reports with detailed insights
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setComparisonMode(!comparisonMode)}
          >
            <GitCompare className="mr-2 h-4 w-4" />
            {comparisonMode ? 'Exit Compare' : 'Compare'}
          </Button>
          <Label htmlFor="file-upload" className="cursor-pointer">
            <Button disabled={isUploading} asChild>
              <span>
                {isUploading ? (
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="mr-2 h-4 w-4" />
                )}
                {isUploading ? 'Uploading...' : 'Upload Report'}
              </span>
            </Button>
          </Label>
          <Input
            id="file-upload"
            type="file"
            accept=".json"
            onChange={handleFileUpload}
            className="hidden"
            disabled={isUploading}
          />
        </div>
      </div>

      {loadedReports.length === 0 ? (
        <Card className="flex-1">
          <CardContent className="flex items-center justify-center min-h-[400px]">
            <div className="text-center space-y-4">
              <Database className="mx-auto h-12 w-12 text-muted-foreground" />
              <h2 className="text-xl font-semibold">No Reports Loaded</h2>
              <p className="text-muted-foreground max-w-md">
                Upload an analysis report JSON file to view detailed metrics, charts, and insights about your codebase.
              </p>
              <Label htmlFor="file-upload-empty" className="cursor-pointer">
                <Button asChild>
                  <span>
                    <Upload className="mr-2 h-4 w-4" />
                    Upload Your First Report
                  </span>
                </Button>
              </Label>
              <Input
                id="file-upload-empty"
                type="file"
                accept=".json"
                onChange={handleFileUpload}
                className="hidden"
                disabled={isUploading}
              />
            </div>
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="reports" className="flex-1">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="reports">
              <FileText className="mr-2 h-4 w-4" />
              Reports ({loadedReports.length})
            </TabsTrigger>
            <TabsTrigger value="analysis" disabled={!selectedReport}>
              <BarChart3 className="mr-2 h-4 w-4" />
              Analysis
            </TabsTrigger>
            <TabsTrigger value="comparison" disabled={!comparisonMode}>
              <GitCompare className="mr-2 h-4 w-4" />
              Comparison
            </TabsTrigger>
          </TabsList>

          <TabsContent value="reports" className="space-y-4">
            {/* Search and Filter Controls */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Report Library</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <Label htmlFor="search">Search Reports</Label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="search"
                        placeholder="Search by name or filename..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="sort">Sort By</Label>
                    <select
                      id="sort"
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as 'date' | 'name' | 'size')}
                      className="w-full px-3 py-2 border border-input bg-background rounded-md"
                    >
                      <option value="date">Upload Date</option>
                      <option value="name">Name</option>
                      <option value="size">File Size</option>
                    </select>
                  </div>
                  <div>
                    <Label htmlFor="filter">Filter</Label>
                    <select
                      id="filter"
                      value={filterBy}
                      onChange={(e) => setFilterBy(e.target.value as 'all' | 'recent' | 'large' | 'complex')}
                      className="w-full px-3 py-2 border border-input bg-background rounded-md"
                    >
                      <option value="all">All Reports</option>
                      <option value="recent">Recent (24h)</option>
                      <option value="large">Large Files</option>
                      <option value="complex">Complex Projects</option>
                    </select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Reports Grid */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredAndSortedReports.map((report) => (
                <Card
                  key={report.id}
                  className={`cursor-pointer transition-all hover:shadow-md ${
                    selectedReport?.id === report.id ? 'ring-2 ring-primary' : ''
                  } ${
                    comparisonMode && comparisonReports.includes(report) ? 'ring-2 ring-blue-500' : ''
                  }`}
                  onClick={() => {
                    if (comparisonMode) {
                      setComparisonReports(prev => {
                        if (prev[0] === report) return [null, prev[1]];
                        if (prev[1] === report) return [prev[0], null];
                        if (!prev[0]) return [report, prev[1]];
                        if (!prev[1]) return [prev[0], report];
                        return [report, prev[1]];
                      });
                    } else {
                      setSelectedReport(report);
                    }
                  }}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <CardTitle className="text-base truncate">{report.name}</CardTitle>
                        <p className="text-sm text-muted-foreground truncate">{report.fileName}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleExportReport(report);
                          }}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteReport(report.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        {formatDistanceToNow(new Date(report.uploadDate), { addSuffix: true })}
                      </div>
                      <div className="flex items-center gap-1">
                        <HardDrive className="h-4 w-4" />
                        {formatFileSize(report.fileSize)}
                      </div>
                    </div>
                    <Separator />
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Files:</span>
                        <Badge variant="outline">{report.summary.totalFiles}</Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Entities:</span>
                        <Badge variant="outline">{report.summary.totalEntities}</Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Duplicates:</span>
                        <Badge variant={report.summary.duplicateClusters > 0 ? "destructive" : "outline"}>
                          {report.summary.duplicateClusters}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Issues:</span>
                        <Badge variant={report.summary.codeSmells > 0 ? "destructive" : "outline"}>
                          {report.summary.codeSmells}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="analysis" className="space-y-4">
            {selectedReport && (
              <>
                {/* Report Metadata */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>{selectedReport.name}</CardTitle>
                        <p className="text-sm text-muted-foreground">
                          Uploaded {format(new Date(selectedReport.uploadDate), 'PPpp')} • {formatFileSize(selectedReport.fileSize)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{selectedReport.metadata.version}</Badge>
                        <Badge variant="outline">{selectedReport.metadata.environment}</Badge>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleExportReport(selectedReport)}
                        >
                          <Download className="mr-2 h-4 w-4" />
                          Export
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div className="space-y-1">
                        <p className="text-muted-foreground">Generator</p>
                        <p className="font-medium">{selectedReport.metadata.generator}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-muted-foreground">Analysis Duration</p>
                        <p className="font-medium">
                          {selectedReport.metadata.duration > 0 
                            ? `${(selectedReport.metadata.duration / 1000).toFixed(2)}s`
                            : 'Unknown'
                          }
                        </p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-muted-foreground">File Size</p>
                        <p className="font-medium">{formatFileSize(selectedReport.fileSize)}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-muted-foreground">Upload Date</p>
                        <p className="font-medium">{format(new Date(selectedReport.uploadDate), 'PPP')}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Summary Cards */}
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                  <SummaryCard
                    title="Total Files"
                    value={selectedReport.summary.totalFiles}
                    icon={FileCode}
                  />
                  <SummaryCard
                    title="Total Entities"
                    value={selectedReport.summary.totalEntities}
                    icon={Code}
                  />
                  <SummaryCard
                    title="Duplicate Clusters"
                    value={selectedReport.summary.duplicateClusters}
                    icon={Copy}
                    variant={selectedReport.summary.duplicateClusters > 0 ? "critical" : "default"}
                  />
                  <SummaryCard
                    title="Circular Dependencies"
                    value={selectedReport.summary.circularDependencies}
                    icon={GitBranch}
                    variant={selectedReport.summary.circularDependencies > 0 ? "warning" : "default"}
                  />
                  <SummaryCard
                    title="Unused Exports"
                    value={selectedReport.summary.unusedExports}
                    icon={FileX}
                    variant="info"
                  />
                  <SummaryCard
                    title="Code Smells"
                    value={selectedReport.summary.codeSmells}
                    icon={Bug}
                    variant={selectedReport.summary.codeSmells > 0 ? "critical" : "default"}
                  />
                </div>

                {/* Charts */}
                <DashboardCharts data={selectedReport.analysisData} />
              </>
            )}
          </TabsContent>

          <TabsContent value="comparison" className="space-y-4">
            {comparisonMode && (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle>Report Comparison</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Select two reports from the Reports tab to compare their metrics and identify trends.
                    </p>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Report A (Baseline)</Label>
                        <div className="p-3 border rounded-lg">
                          {comparisonReports[0] ? (
                            <div>
                              <p className="font-medium">{comparisonReports[0].name}</p>
                              <p className="text-sm text-muted-foreground">
                                {format(new Date(comparisonReports[0].uploadDate), 'PPP')}
                              </p>
                            </div>
                          ) : (
                            <p className="text-muted-foreground">Select first report</p>
                          )}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Report B (Comparison)</Label>
                        <div className="p-3 border rounded-lg">
                          {comparisonReports[1] ? (
                            <div>
                              <p className="font-medium">{comparisonReports[1].name}</p>
                              <p className="text-sm text-muted-foreground">
                                {format(new Date(comparisonReports[1].uploadDate), 'PPP')}
                              </p>
                            </div>
                          ) : (
                            <p className="text-muted-foreground">Select second report</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {comparisonMetrics && (
                  <>
                    {/* Trend Summary */}
                    <div className="grid gap-4 md:grid-cols-3">
                      <Card>
                        <CardContent className="pt-6">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium text-green-600 dark:text-green-400">Improving</p>
                              <p className="text-2xl font-bold">{comparisonMetrics.trends.improving}</p>
                            </div>
                            <TrendingUp className="h-8 w-8 text-green-600 dark:text-green-400" />
                          </div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="pt-6">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium text-red-600 dark:text-red-400">Degrading</p>
                              <p className="text-2xl font-bold">{comparisonMetrics.trends.degrading}</p>
                            </div>
                            <AlertTriangle className="h-8 w-8 text-red-600 dark:text-red-400" />
                          </div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="pt-6">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium text-blue-600 dark:text-blue-400">Stable</p>
                              <p className="text-2xl font-bold">{comparisonMetrics.trends.stable}</p>
                            </div>
                            <CheckCircle className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Detailed Changes */}
                    <Card>
                      <CardHeader>
                        <CardTitle>Metric Changes</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {Object.entries(comparisonMetrics.changes).map(([key, change]) => {
                            const isImproving = (key === 'duplicateClusters' || key === 'circularDependencies' || key === 'unusedExports' || key === 'codeSmells') ? change < 0 : change > 0;
                            const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
                            
                            return (
                              <div key={key} className="flex items-center justify-between p-3 border rounded-lg">
                                <span className="font-medium">{label}</span>
                                <div className="flex items-center gap-2">
                                  <Badge
                                    variant={change === 0 ? "outline" : isImproving ? "default" : "destructive"}
                                  >
                                    {change > 0 ? '+' : ''}{change}
                                  </Badge>
                                  {change !== 0 && (
                                    isImproving ? (
                                      <TrendingUp className="h-4 w-4 text-green-600" />
                                    ) : (
                                      <AlertTriangle className="h-4 w-4 text-red-600" />
                                    )
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </CardContent>
                    </Card>

                    {/* Comparison Chart */}
                    <Card>
                      <CardHeader>
                        <CardTitle>Side-by-Side Comparison</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {renderComparisonChart()}
                      </CardContent>
                    </Card>
                  </>
                )}
              </>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}