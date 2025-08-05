import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Upload, FileText, AlertCircle, CheckCircle } from 'lucide-react';
import { AnalysisReport } from '@/types/report';

interface ReportLoaderProps {
  onReportLoad: (report: AnalysisReport) => void;
  onError?: (error: string) => void;
}

export const ReportLoader: React.FC<ReportLoaderProps> = ({
  onReportLoad,
  onError
}) => {
  const [loading, setLoading] = useState(false);
  const [loadedReport, setLoadedReport] = useState<AnalysisReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  const validateReport = (data: any): data is AnalysisReport => {
    const requiredFields = ['id', 'timestamp', 'projectName', 'summary', 'duplicates', 'dependencies', 'metrics'];
    return requiredFields.every(field => field in data);
  };

  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError(null);

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      if (!validateReport(data)) {
        throw new Error('Invalid report format. Please ensure the JSON contains all required fields.');
      }

      setLoadedReport(data);
      onReportLoad(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load report';
      setError(errorMessage);
      onError?.(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [onReportLoad, onError]);

  const handleUrlLoad = useCallback(async (url: string) => {
    if (!url.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch report: ${response.statusText}`);
      }

      const data = await response.json();

      if (!validateReport(data)) {
        throw new Error('Invalid report format from URL');
      }

      setLoadedReport(data);
      onReportLoad(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load report from URL';
      setError(errorMessage);
      onError?.(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [onReportLoad, onError]);

  const handleSampleReport = useCallback(() => {
    const sampleReport: AnalysisReport = {
      id: 'sample-001',
      timestamp: new Date().toISOString(),
      projectName: 'Sample Project',
      version: '1.0.0',
      summary: {
        totalFiles: 150,
        totalPackages: 12,
        duplicateCount: 23,
        circularDependencyCount: 3,
        codebaseSize: 52000,
        testCoverage: 78.5
      },
      duplicates: {
        totalDuplicates: 23,
        duplicatesByType: {
          'exact': 12,
          'similar': 11
        },
        duplicateFiles: [],
        similarityThreshold: 0.85
      },
      dependencies: {
        totalDependencies: 145,
        directDependencies: 32,
        devDependencies: 28,
        peerDependencies: 5,
        dependencyTree: [],
        vulnerabilities: []
      },
      circularDependencies: [],
      metrics: {
        codeQuality: {
          linesOfCode: 52000,
          technicalDebt: 15,
          codeSmells: 8,
          duplicateLines: 1200,
          testCoverage: 78.5
        },
        performance: {
          buildTime: 45.2,
          bundleSize: 2.4,
          loadTime: 1.8,
          memoryUsage: 128
        },
        maintainability: {
          maintainabilityIndex: 72,
          cyclomaticComplexity: 8.5,
          cognitiveComplexity: 12.3,
          afferentCoupling: 5,
          efferentCoupling: 12
        },
        complexity: {
          averageComplexity: 8.5,
          maxComplexity: 45,
          complexityDistribution: {
            'low': 85,
            'medium': 12,
            'high': 3
          }
        }
      },
      packages: []
    };

    setLoadedReport(sampleReport);
    onReportLoad(sampleReport);
  }, [onReportLoad]);

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Load Analysis Report
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {loadedReport && (
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              Successfully loaded report: <strong>{loadedReport.projectName}</strong> 
              ({new Date(loadedReport.timestamp).toLocaleDateString()})
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Upload JSON Report File</label>
            <div className="flex items-center gap-2">
              <Input
                type="file"
                accept=".json"
                onChange={handleFileUpload}
                disabled={loading}
                className="file:mr-2 file:px-4 file:py-2 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
              />
              <Upload className="h-4 w-4 text-muted-foreground" />
            </div>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">Or</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Load from URL</label>
            <div className="flex gap-2">
              <Input
                type="url"
                placeholder="https://example.com/report.json"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleUrlLoad((e.target as HTMLInputElement).value);
                  }
                }}
                disabled={loading}
              />
              <Button
                onClick={() => {
                  const input = document.querySelector('input[type="url"]') as HTMLInputElement;
                  handleUrlLoad(input.value);
                }}
                disabled={loading}
                variant="outline"
              >
                Load
              </Button>
            </div>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">Or</span>
            </div>
          </div>

          <Button
            onClick={handleSampleReport}
            variant="outline"
            className="w-full"
            disabled={loading}
          >
            Load Sample Report
          </Button>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};