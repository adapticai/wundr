import React, { useRef, useEffect, useState } from 'react';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, ArcElement, Title, Tooltip, Legend, ChartOptions } from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Download, Eye, BarChart3, PieChart } from 'lucide-react';
import { DuplicateAnalysis, DuplicateFile } from '@/types/report';
import { useChartTheme } from '@/hooks/useChartTheme';
import { exportChart } from '@/utils/chartExport';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Title, Tooltip, Legend);

interface DuplicatesVisualizationProps {
  data: DuplicateAnalysis;
  duplicateFiles: DuplicateFile[];
  onFileSelect?: (file: DuplicateFile) => void;
}

type ViewMode = 'overview' | 'by-type' | 'by-score' | 'files';
type ChartType = 'bar' | 'doughnut';

export const DuplicatesVisualization: React.FC<DuplicatesVisualizationProps> = ({
  data,
  duplicateFiles,
  onFileSelect
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>('overview');
  const [chartType, setChartType] = useState<ChartType>('bar');
  const [selectedScoreRange, setSelectedScoreRange] = useState<string>('all');
  const chartRef = useRef<ChartJS>(null);
  const { colors, chartDefaults, getColorPalette } = useChartTheme();

  const scoreRanges = [
    { value: 'all', label: 'All Scores' },
    { value: '0.9-1.0', label: '90-100% (Exact)' },
    { value: '0.8-0.9', label: '80-90% (Very Similar)' },
    { value: '0.7-0.8', label: '70-80% (Similar)' },
    { value: '0.6-0.7', label: '60-70% (Somewhat Similar)' }
  ];

  const getFilteredFiles = () => {
    if (selectedScoreRange === 'all') return duplicateFiles;
    
    const [min, max] = selectedScoreRange.split('-').map(Number);
    return duplicateFiles.filter(file => 
      file.duplicateScore >= min && file.duplicateScore <= max
    );
  };

  const getOverviewData = () => {
    const filteredFiles = getFilteredFiles();
    const typeData = data.duplicatesByType;
    
    return {
      labels: Object.keys(typeData),
      datasets: [{
        label: 'Duplicate Count',
        data: Object.values(typeData),
        backgroundColor: getColorPalette(Object.keys(typeData).length),
        borderColor: colors.border,
        borderWidth: 1
      }]
    };
  };

  const getScoreDistributionData = () => {
    const filteredFiles = getFilteredFiles();
    const scoreRanges = {
      '0.9-1.0': 0,
      '0.8-0.9': 0,
      '0.7-0.8': 0,
      '0.6-0.7': 0,
      'Below 0.6': 0
    };

    filteredFiles.forEach(file => {
      const score = file.duplicateScore;
      if (score >= 0.9) scoreRanges['0.9-1.0']++;
      else if (score >= 0.8) scoreRanges['0.8-0.9']++;
      else if (score >= 0.7) scoreRanges['0.7-0.8']++;
      else if (score >= 0.6) scoreRanges['0.6-0.7']++;
      else scoreRanges['Below 0.6']++;
    });

    return {
      labels: Object.keys(scoreRanges),
      datasets: [{
        label: 'Files Count',
        data: Object.values(scoreRanges),
        backgroundColor: [
          colors.error,
          colors.warning,
          colors.info,
          colors.secondary,
          colors.primary
        ],
        borderColor: colors.border,
        borderWidth: 1
      }]
    };
  };

  const getFileSizesData = () => {
    const filteredFiles = getFilteredFiles();
    const topFiles = filteredFiles
      .sort((a, b) => b.size - a.size)
      .slice(0, 10);

    return {
      labels: topFiles.map(file => file.path.split('/').pop() || file.path),
      datasets: [{
        label: 'File Size (bytes)',
        data: topFiles.map(file => file.size),
        backgroundColor: colors.primary,
        borderColor: colors.border,
        borderWidth: 1
      }]
    };
  };

  const getCurrentChartData = () => {
    switch (viewMode) {
      case 'overview':
      case 'by-type':
        return getOverviewData();
      case 'by-score':
        return getScoreDistributionData();
      case 'files':
        return getFileSizesData();
      default:
        return getOverviewData();
    }
  };

  const getChartOptions = (): ChartOptions => {
    const baseOptions = {
      ...chartDefaults,
      onClick: (event: any, elements: any[]) => {
        if (elements.length > 0 && viewMode === 'files') {
          const index = elements[0].index;
          const filteredFiles = getFilteredFiles();
          const topFiles = filteredFiles
            .sort((a, b) => b.size - a.size)
            .slice(0, 10);
          const selectedFile = topFiles[index];
          if (selectedFile && onFileSelect) {
            onFileSelect(selectedFile);
          }
        }
      }
    };

    if (chartType === 'doughnut') {
      return {
        ...baseOptions,
        plugins: {
          ...baseOptions.plugins,
          legend: {
            ...baseOptions.plugins?.legend,
            position: 'right' as const
          }
        }
      };
    }

    return {
      ...baseOptions,
      scales: {
        ...baseOptions.scales,
        y: {
          ...baseOptions.scales?.y,
          beginAtZero: true,
          title: {
            display: true,
            text: viewMode === 'files' ? 'File Size (bytes)' : 'Count',
            color: colors.text
          }
        },
        x: {
          ...baseOptions.scales?.x,
          title: {
            display: true,
            text: viewMode === 'files' ? 'Files' : 'Categories',
            color: colors.text
          }
        }
      }
    };
  };

  const handleExport = async (format: 'png' | 'pdf' | 'csv' | 'json') => {
    if (chartRef.current) {
      await exportChart(chartRef.current, {
        format,
        filename: `duplicates-${viewMode}`,
        includeData: format === 'csv' || format === 'json'
      });
    }
  };

  const getViewModeTitle = () => {
    switch (viewMode) {
      case 'overview':
      case 'by-type':
        return 'Duplicates by Type';
      case 'by-score':
        return 'Duplicate Score Distribution';
      case 'files':
        return 'Largest Duplicate Files';
      default:
        return 'Duplicates Overview';
    }
  };

  const chartData = getCurrentChartData();
  const filteredFiles = getFilteredFiles();

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <CardTitle className="flex items-center gap-2">
            {chartType === 'bar' ? <BarChart3 className="h-5 w-5" /> : <PieChart className="h-5 w-5" />}
            {getViewModeTitle()}
          </CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={viewMode} onValueChange={(value: ViewMode) => setViewMode(value)}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="overview">Overview</SelectItem>
                <SelectItem value="by-type">By Type</SelectItem>
                <SelectItem value="by-score">By Score</SelectItem>
                <SelectItem value="files">Top Files</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={chartType} onValueChange={(value: ChartType) => setChartType(value)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bar">Bar Chart</SelectItem>
                <SelectItem value="doughnut">Doughnut</SelectItem>
              </SelectContent>
            </Select>

            <Select value={selectedScoreRange} onValueChange={setSelectedScoreRange}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {scoreRanges.map(range => (
                  <SelectItem key={range.value} value={range.value}>
                    {range.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              size="sm"
              onClick={() => handleExport('png')}
              className="flex items-center gap-1"
            >
              <Download className="h-4 w-4" />
              Export
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="p-3 bg-muted rounded-lg">
            <div className="text-2xl font-bold text-primary">{data.totalDuplicates}</div>
            <div className="text-sm text-muted-foreground">Total Duplicates</div>
          </div>
          <div className="p-3 bg-muted rounded-lg">
            <div className="text-2xl font-bold text-warning">{filteredFiles.length}</div>
            <div className="text-sm text-muted-foreground">Filtered Files</div>
          </div>
          <div className="p-3 bg-muted rounded-lg">
            <div className="text-2xl font-bold text-info">
              {(data.similarityThreshold * 100).toFixed(0)}%
            </div>
            <div className="text-sm text-muted-foreground">Threshold</div>
          </div>
          <div className="p-3 bg-muted rounded-lg">
            <div className="text-2xl font-bold text-success">
              {filteredFiles.length > 0 
                ? (filteredFiles.reduce((sum, file) => sum + file.duplicateScore, 0) / filteredFiles.length * 100).toFixed(1)
                : 0}%
            </div>
            <div className="text-sm text-muted-foreground">Avg Score</div>
          </div>
        </div>

        {/* Chart */}
        <div className="h-96 w-full">
          {chartType === 'bar' ? (
            <Bar ref={chartRef} data={chartData} options={getChartOptions()} />
          ) : (
            <Doughnut ref={chartRef} data={chartData} options={getChartOptions()} />
          )}
        </div>

        {/* File List for Files View */}
        {viewMode === 'files' && (
          <div className="space-y-2">
            <h4 className="font-medium">Duplicate Files ({filteredFiles.length})</h4>
            <div className="max-h-48 overflow-y-auto space-y-2">
              {filteredFiles
                .sort((a, b) => b.duplicateScore - a.duplicateScore)
                .slice(0, 20)
                .map((file, index) => (
                  <div
                    key={file.id}
                    className="flex items-center justify-between p-2 bg-muted rounded cursor-pointer hover:bg-muted/80"
                    onClick={() => onFileSelect?.(file)}
                  >
                    <div className="flex-1">
                      <div className="font-mono text-sm truncate">{file.path}</div>
                      <div className="text-xs text-muted-foreground">
                        {file.size} bytes • {file.similarFiles.length} similar files
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">
                        {(file.duplicateScore * 100).toFixed(1)}%
                      </Badge>
                      <Button variant="ghost" size="sm">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};