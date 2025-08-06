import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Info, FileText, GitBranch, Package, BarChart3, Table } from 'lucide-react';
import { 
  ReportLoader,
  DuplicatesVisualization,
  DependencyGraph,
  CircularDependencyDiagram,
  MetricsOverview,
  DataTable,
  Column
} from './index';
import { 
  AnalysisReport, 
  DuplicateFile, 
  DependencyNode, 
  CircularDependency,
  Vulnerability,
  PackageInfo
} from '@/types/report';

interface ReportDashboardProps {
  initialReport?: AnalysisReport;
}

export const ReportDashboard: React.FC<ReportDashboardProps> = ({ initialReport }) => {
  const [report, setReport] = useState<AnalysisReport | null>(initialReport || null);
  const [selectedFile, setSelectedFile] = useState<DuplicateFile | null>(null);
  const [selectedDependency, setSelectedDependency] = useState<DependencyNode | null>(null);
  const [selectedCircularDep, setSelectedCircularDep] = useState<CircularDependency | null>(null);
  const [selectedVulnerability, setSelectedVulnerability] = useState<Vulnerability | null>(null);

  const handleReportLoad = (newReport: AnalysisReport) => {
    setReport(newReport);
    // Reset selections
    setSelectedFile(null);
    setSelectedDependency(null);
    setSelectedCircularDep(null);
    setSelectedVulnerability(null);
  };

  // Define columns for data tables
  const duplicateColumns: Column<DuplicateFile>[] = [
    { key: 'path', title: 'File Path', sortable: true, width: 'w-96' },
    { key: 'type', title: 'Type', sortable: true, filterable: true },
    { 
      key: 'duplicateScore', 
      title: 'Similarity', 
      sortable: true,
      render: (value) => (
        <Badge variant={value > 0.9 ? 'destructive' : value > 0.8 ? 'default' : 'secondary'}>
          {(value * 100).toFixed(1)}%
        </Badge>
      )
    },
    { key: 'size', title: 'Size (bytes)', sortable: true },
    { 
      key: 'similarFiles', 
      title: 'Similar Files', 
      render: (value) => value.length 
    }
  ];

  const packageColumns: Column<PackageInfo>[] = [
    { key: 'name', title: 'Package Name', sortable: true },
    { key: 'version', title: 'Version', sortable: true },
    { key: 'path', title: 'Path', sortable: true, width: 'w-64' },
    { key: 'size', title: 'Size (bytes)', sortable: true },
    { key: 'files', title: 'Files', sortable: true },
    { 
      key: 'dependencies', 
      title: 'Dependencies', 
      render: (value) => value.length 
    },
    { 
      key: 'lastModified', 
      title: 'Last Modified', 
      sortable: true,
      render: (value) => new Date(value).toLocaleDateString()
    }
  ];

  const vulnerabilityColumns: Column<Vulnerability>[] = [
    { key: 'package', title: 'Package', sortable: true },
    { key: 'title', title: 'Vulnerability', sortable: true, width: 'w-64' },
    { 
      key: 'severity', 
      title: 'Severity', 
      sortable: true, 
      filterable: true,
      render: (value) => (
        <Badge variant={
          value === 'critical' ? 'destructive' :
          value === 'high' ? 'destructive' :
          value === 'medium' ? 'default' : 'secondary'
        }>
          {value.toUpperCase()}
        </Badge>
      )
    },
    { key: 'description', title: 'Description', width: 'w-96' },
    { 
      key: 'patchedVersions', 
      title: 'Patched Versions',
      render: (value) => value.join(', ') || 'None'
    }
  ];

  if (!report) {
    return (
      <div className="container mx-auto py-8">
        <ReportLoader onReportLoad={handleReportLoad} />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Report Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                {report.projectName} Analysis Report
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Version {report.version} • Generated on {new Date(report.timestamp).toLocaleString()}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <ReportLoader onReportLoad={handleReportLoad} />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">{report.summary.totalFiles}</div>
              <div className="text-sm text-muted-foreground">Total Files</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-info">{report.summary.totalPackages}</div>
              <div className="text-sm text-muted-foreground">Packages</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-warning">{report.summary.duplicateCount}</div>
              <div className="text-sm text-muted-foreground">Duplicates</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-error">{report.summary.circularDependencyCount}</div>
              <div className="text-sm text-muted-foreground">Circular Deps</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Content Tabs */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="overview" className="flex items-center gap-1">
            <BarChart3 className="h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="duplicates" className="flex items-center gap-1">
            <FileText className="h-4 w-4" />
            Duplicates
          </TabsTrigger>
          <TabsTrigger value="dependencies" className="flex items-center gap-1">
            <Package className="h-4 w-4" />
            Dependencies
          </TabsTrigger>
          <TabsTrigger value="circular" className="flex items-center gap-1">
            <GitBranch className="h-4 w-4" />
            Circular Deps
          </TabsTrigger>
          <TabsTrigger value="packages" className="flex items-center gap-1">
            <Package className="h-4 w-4" />
            Packages
          </TabsTrigger>
          <TabsTrigger value="data" className="flex items-center gap-1">
            <Table className="h-4 w-4" />
            Data Tables
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <MetricsOverview 
            metrics={report.metrics} 
            summary={report.summary}
          />
        </TabsContent>

        <TabsContent value="duplicates" className="space-y-6">
          <DuplicatesVisualization
            data={report.duplicates}
            duplicateFiles={report.duplicates.duplicateFiles}
            onFileSelect={setSelectedFile}
          />
          
          {selectedFile && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                <strong>Selected File:</strong> {selectedFile.path}
                <br />
                <strong>Similarity Score:</strong> {(selectedFile.duplicateScore * 100).toFixed(1)}%
                <br />
                <strong>Similar Files:</strong> {selectedFile.similarFiles.length}
                <br />
                <strong>Size:</strong> {selectedFile.size} bytes
              </AlertDescription>
            </Alert>
          )}
        </TabsContent>

        <TabsContent value="dependencies" className="space-y-6">
          <DependencyGraph
            data={report.dependencies}
            onNodeSelect={setSelectedDependency}
            onVulnerabilitySelect={setSelectedVulnerability}
          />
          
          {selectedDependency && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                <strong>Selected Dependency:</strong> {selectedDependency.name}@{selectedDependency.version}
                <br />
                <strong>Type:</strong> {selectedDependency.type}
                <br />
                <strong>Dependencies:</strong> {selectedDependency.dependencies?.length || 0}
                {selectedDependency.size && (
                  <>
                    <br />
                    <strong>Size:</strong> {(selectedDependency.size / 1024).toFixed(1)} KB
                  </>
                )}
              </AlertDescription>
            </Alert>
          )}

          {selectedVulnerability && (
            <Alert variant="destructive">
              <Info className="h-4 w-4" />
              <AlertDescription>
                <strong>Vulnerability:</strong> {selectedVulnerability.title}
                <br />
                <strong>Package:</strong> {selectedVulnerability.package}
                <br />
                <strong>Severity:</strong> {selectedVulnerability.severity.toUpperCase()}
                <br />
                <strong>Description:</strong> {selectedVulnerability.description}
              </AlertDescription>
            </Alert>
          )}
        </TabsContent>

        <TabsContent value="circular" className="space-y-6">
          <CircularDependencyDiagram
            dependencies={report.circularDependencies}
            onDependencySelect={setSelectedCircularDep}
          />
          
          {selectedCircularDep && (
            <Alert variant="destructive">
              <Info className="h-4 w-4" />
              <AlertDescription>
                <strong>Circular Dependency:</strong> {selectedCircularDep.cycle.join(' → ')} → {selectedCircularDep.cycle[0]}
                <br />
                <strong>Severity:</strong> {selectedCircularDep.severity.toUpperCase()}
                <br />
                <strong>Impact Score:</strong> {selectedCircularDep.impactScore}
                <br />
                <strong>Affected Files:</strong> {selectedCircularDep.affectedFiles.length}
              </AlertDescription>
            </Alert>
          )}
        </TabsContent>

        <TabsContent value="packages" className="space-y-6">
          <DataTable
            data={report.packages}
            columns={packageColumns}
            title="Package Information"
            searchable
            exportable
            pagination
            pageSize={15}
          />
        </TabsContent>

        <TabsContent value="data" className="space-y-6">
          <div className="grid gap-6">
            {/* Duplicate Files Table */}
            <DataTable
              data={report.duplicates.duplicateFiles}
              columns={duplicateColumns}
              title="Duplicate Files"
              searchable
              exportable
              pagination
              pageSize={10}
              onRowSelect={setSelectedFile}
            />

            {/* Vulnerabilities Table */}
            {report.dependencies.vulnerabilities.length > 0 && (
              <DataTable
                data={report.dependencies.vulnerabilities}
                columns={vulnerabilityColumns}
                title="Security Vulnerabilities"
                searchable
                exportable
                pagination
                pageSize={10}
                onRowSelect={setSelectedVulnerability}
              />
            )}

            {/* Circular Dependencies as Table */}
            {report.circularDependencies.length > 0 && (
              <DataTable
                data={report.circularDependencies.map(dep => ({
                  ...dep,
                  cycleString: dep.cycle.join(' → ') + ' → ' + dep.cycle[0],
                  affectedFilesCount: dep.affectedFiles.length
                }))}
                columns={[
                  { key: 'cycleString', title: 'Dependency Cycle', sortable: true, width: 'w-96' },
                  { 
                    key: 'severity', 
                    title: 'Severity', 
                    sortable: true, 
                    filterable: true,
                    render: (value) => (
                      <Badge variant={
                        value === 'high' ? 'destructive' :
                        value === 'medium' ? 'default' : 'secondary'
                      }>
                        {value.toUpperCase()}
                      </Badge>
                    )
                  },
                  { key: 'impactScore', title: 'Impact Score', sortable: true },
                  { key: 'affectedFilesCount', title: 'Affected Files', sortable: true }
                ]}
                title="Circular Dependencies"
                searchable
                exportable
                pagination
                pageSize={10}
              />
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};