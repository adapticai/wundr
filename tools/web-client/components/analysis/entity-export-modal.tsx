'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
// import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Download,
  FileText,
  FileSpreadsheet,
  Code,
  X,
  CheckCircle,
} from 'lucide-react';
import type { EntityData } from '@/app/api/analysis/entities/route';
import { exportToCSV, exportToJSON } from '@/lib/utils';

interface EntityExportModalProps {
  entities: EntityData[];
  onClose: () => void;
}

type ExportFormat = 'json' | 'csv' | 'markdown' | 'html';

interface ExportOptions {
  format: ExportFormat;
  includeFields: {
    name: boolean;
    type: boolean;
    file: boolean;
    line: boolean;
    column: boolean;
    exportType: boolean;
    complexity: boolean;
    dependencies: boolean;
    jsDoc: boolean;
    signature: boolean;
    members: boolean;
  };
  filters: {
    minComplexity?: number;
    maxComplexity?: number;
    types: string[];
    exportTypes: string[];
  };
}

export function EntityExportModal({ entities, onClose }: EntityExportModalProps) {
  const [exportOptions, setExportOptions] = useState<ExportOptions>({
    format: 'json',
    includeFields: {
      name: true,
      type: true,
      file: true,
      line: true,
      column: false,
      exportType: true,
      complexity: true,
      dependencies: true,
      jsDoc: false,
      signature: false,
      members: false,
    },
    filters: {
      types: [],
      exportTypes: [],
    },
  });

  const [isExporting, setIsExporting] = useState(false);
  const [exportComplete, setExportComplete] = useState(false);

  // Get unique values for filters
  const uniqueTypes = [...new Set(entities.map(e => e.type))];
  const uniqueExportTypes = [...new Set(entities.map(e => e.exportType))];

  // Filter entities based on export options
  const filteredEntities = entities.filter(entity => {
    // Type filter
    if (exportOptions.filters.types.length > 0 && 
        !exportOptions.filters.types.includes(entity.type)) {
      return false;
    }

    // Export type filter
    if (exportOptions.filters.exportTypes.length > 0 && 
        !exportOptions.filters.exportTypes.includes(entity.exportType)) {
      return false;
    }

    // Complexity filters
    const complexity = entity.complexity || 0;
    if (exportOptions.filters.minComplexity !== undefined && 
        complexity < exportOptions.filters.minComplexity) {
      return false;
    }
    if (exportOptions.filters.maxComplexity !== undefined && 
        complexity > exportOptions.filters.maxComplexity) {
      return false;
    }

    return true;
  });

  const handleFieldToggle = (field: keyof ExportOptions['includeFields']) => {
    setExportOptions(prev => ({
      ...prev,
      includeFields: {
        ...prev.includeFields,
        [field]: !prev.includeFields[field],
      },
    }));
  };

  const handleTypeFilter = (type: string, checked: boolean) => {
    setExportOptions(prev => ({
      ...prev,
      filters: {
        ...prev.filters,
        types: checked
          ? [...prev.filters.types, type]
          : prev.filters.types.filter(t => t !== type),
      },
    }));
  };

  const handleExportTypeFilter = (exportType: string, checked: boolean) => {
    setExportOptions(prev => ({
      ...prev,
      filters: {
        ...prev.filters,
        exportTypes: checked
          ? [...prev.filters.exportTypes, exportType]
          : prev.filters.exportTypes.filter(t => t !== exportType),
      },
    }));
  };

  const generateExportData = () => {
    const exportData = filteredEntities.map(entity => {
      const exportEntity: Record<string, unknown> = {};
      
      if (exportOptions.includeFields.name) exportEntity.name = entity.name;
      if (exportOptions.includeFields.type) exportEntity.type = entity.type;
      if (exportOptions.includeFields.file) exportEntity.file = entity.file;
      if (exportOptions.includeFields.line) exportEntity.line = entity.line;
      if (exportOptions.includeFields.column) exportEntity.column = 'column' in entity ? entity.column : undefined;
      if (exportOptions.includeFields.exportType) exportEntity.exportType = entity.exportType;
      if (exportOptions.includeFields.complexity) exportEntity.complexity = entity.complexity;
      if (exportOptions.includeFields.dependencies) exportEntity.dependencies = entity.dependencies;
      if (exportOptions.includeFields.jsDoc) exportEntity.jsDoc = 'jsDoc' in entity ? entity.jsDoc : undefined;
      if (exportOptions.includeFields.signature) exportEntity.signature = 'signature' in entity ? entity.signature : undefined;
      if (exportOptions.includeFields.members) exportEntity.members = 'members' in entity ? entity.members : undefined;
      
      return exportEntity;
    });

    return exportData;
  };


  const exportAsMarkdown = (data: Record<string, unknown>[]) => {
    if (data.length === 0) return new Blob(['# No data to export'], { type: 'text/markdown' });

    let markdown = '# Entity Analysis Export\n\n';
    markdown += `Generated on: ${new Date().toISOString()}\n`;
    markdown += `Total entities: ${data.length}\n\n`;

    const headers = Object.keys(data[0]);
    
    // Create table header
    markdown += '| ' + headers.map(h => h.charAt(0).toUpperCase() + h.slice(1)).join(' | ') + ' |\n';
    markdown += '| ' + headers.map(() => '---').join(' | ') + ' |\n';

    // Add rows
    data.forEach(row => {
      const values = headers.map(header => {
        const value = row[header];
        if (Array.isArray(value)) {
          return value.join(', ');
        }
        if (typeof value === 'object' && value !== null) {
          return JSON.stringify(value);
        }
        return value || '';
      });
      markdown += '| ' + values.join(' | ') + ' |\n';
    });

    const blob = new Blob([markdown], { type: 'text/markdown' });
    return blob;
  };

  const exportAsHTML = (data: Record<string, unknown>[]) => {
    if (data.length === 0) {
      const html = '<html><body><h1>No data to export</h1></body></html>';
      return new Blob([html], { type: 'text/html' });
    }

    const headers = Object.keys(data[0]);
    
    const html = `
<!DOCTYPE html>
<html>
<head>
    <title>Entity Analysis Export</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        table { border-collapse: collapse; width: 100%; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; font-weight: bold; }
        tr:nth-child(even) { background-color: #f9f9f9; }
        .meta { color: #666; margin-bottom: 20px; }
    </style>
</head>
<body>
    <h1>Entity Analysis Export</h1>
    <div class="meta">
        <p>Generated on: ${new Date().toISOString()}</p>
        <p>Total entities: ${data.length}</p>
    </div>
    <table>
        <thead>
            <tr>
                ${headers.map(h => `<th>${h.charAt(0).toUpperCase() + h.slice(1)}</th>`).join('')}
            </tr>
        </thead>
        <tbody>
            ${data.map(row => `
                <tr>
                    ${headers.map(header => {
                      const value = row[header];
                      if (Array.isArray(value)) {
                        return `<td>${value.join(', ')}</td>`;
                      }
                      if (typeof value === 'object' && value !== null) {
                        return `<td><pre>${JSON.stringify(value, null, 2)}</pre></td>`;
                      }
                      return `<td>${value || ''}</td>`;
                    }).join('')}
                </tr>
            `).join('')}
        </tbody>
    </table>
</body>
</html>`;

    const blob = new Blob([html], { type: 'text/html' });
    return blob;
  };

  const handleExport = async () => {
    setIsExporting(true);
    
    try {
      const data = generateExportData();
      const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
      let filename: string;

      switch (exportOptions.format) {
        case 'json':
          filename = `entities-export-${timestamp}.json`;
          exportToJSON({
            entities: data,
            filters: exportOptions.filters,
            fields: exportOptions.includeFields,
            exportedAt: new Date().toISOString(),
            totalEntities: filteredEntities.length
          }, {
            filename,
            pretty: true,
            autoDownload: true
          });
          break;
        case 'csv':
          filename = `entities-export-${timestamp}.csv`;
          exportToCSV(data, {
            filename,
            autoDownload: true
          });
          break;
        case 'markdown':
          const blob = exportAsMarkdown(data);
          filename = `entities-export-${timestamp}.md`;
          downloadBlob(blob, filename);
          break;
        case 'html':
          const htmlBlob = exportAsHTML(data);
          filename = `entities-export-${timestamp}.html`;
          downloadBlob(htmlBlob, filename);
          break;
        default:
          throw new Error('Invalid export format');
      }

      setExportComplete(true);
      setTimeout(() => {
        setExportComplete(false);
        onClose();
      }, 2000);
    } catch (_error) {
      // Error logged - details available in network tab;
    } finally {
      setIsExporting(false);
    }
  };

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getFormatIcon = (format: ExportFormat) => {
    switch (format) {
      case 'json': return <Code className="h-4 w-4" />;
      case 'csv': return <FileSpreadsheet className="h-4 w-4" />;
      case 'markdown': return <FileText className="h-4 w-4" />;
      case 'html': return <FileText className="h-4 w-4" />;
      default: return <FileText className="h-4 w-4" />;
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Export Entity Data
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Export Format */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Export Format</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { value: 'json', label: 'JSON', description: 'Structured data format' },
                  { value: 'csv', label: 'CSV', description: 'Spreadsheet format' },
                  { value: 'markdown', label: 'Markdown', description: 'Documentation format' },
                  { value: 'html', label: 'HTML', description: 'Web page format' },
                ].map((format) => (
                  <div
                    key={format.value}
                    className={`border rounded-lg p-3 cursor-pointer transition-colors ${
                      exportOptions.format === format.value
                        ? 'border-primary bg-primary/10'
                        : 'border-border hover:border-primary/50'
                    }`}
                    onClick={() => setExportOptions(prev => ({ ...prev, format: format.value as ExportFormat }))}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      {getFormatIcon(format.value as ExportFormat)}
                      <span className="font-medium">{format.label}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{format.description}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Fields to Include */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Fields to Include</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {Object.entries(exportOptions.includeFields).map(([field, included]) => (
                  <div key={field} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id={field}
                      checked={included}
                      onChange={() => handleFieldToggle(field as keyof ExportOptions['includeFields'])}
                      className="rounded border-gray-300"
                    />
                    <label htmlFor={field} className="text-sm font-medium capitalize cursor-pointer">
                      {field.replace(/([A-Z])/g, ' $1').trim()}
                    </label>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Filters */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Filters</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Entity Types */}
              <div>
                <label className="text-sm font-medium mb-2 block">Entity Types</label>
                <div className="flex flex-wrap gap-2">
                  {uniqueTypes.map((type) => (
                    <div key={type} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id={`type-${type}`}
                        checked={exportOptions.filters.types.includes(type)}
                        onChange={(e) => handleTypeFilter(type, e.target.checked)}
                        className="rounded border-gray-300"
                      />
                      <label htmlFor={`type-${type}`} className="text-sm capitalize cursor-pointer">
                        {type}
                      </label>
                    </div>
                  ))}
                  {exportOptions.filters.types.length === 0 && (
                    <Badge variant="secondary">All types included</Badge>
                  )}
                </div>
              </div>

              {/* Export Types */}
              <div>
                <label className="text-sm font-medium mb-2 block">Export Types</label>
                <div className="flex flex-wrap gap-2">
                  {uniqueExportTypes.map((exportType) => (
                    <div key={exportType} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id={`export-${exportType}`}
                        checked={exportOptions.filters.exportTypes.includes(exportType)}
                        onChange={(e) => handleExportTypeFilter(exportType, e.target.checked)}
                        className="rounded border-gray-300"
                      />
                      <label htmlFor={`export-${exportType}`} className="text-sm capitalize cursor-pointer">
                        {exportType}
                      </label>
                    </div>
                  ))}
                  {exportOptions.filters.exportTypes.length === 0 && (
                    <Badge variant="secondary">All export types included</Badge>
                  )}
                </div>
              </div>

              {/* Complexity Range */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Min Complexity</label>
                  <input
                    type="number"
                    min="0"
                    className="w-full border rounded px-3 py-2 text-sm"
                    value={exportOptions.filters.minComplexity || ''}
                    onChange={(e) => setExportOptions(prev => ({
                      ...prev,
                      filters: {
                        ...prev.filters,
                        minComplexity: e.target.value ? Number(e.target.value) : undefined,
                      },
                    }))}
                    placeholder="No minimum"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Max Complexity</label>
                  <input
                    type="number"
                    min="0"
                    className="w-full border rounded px-3 py-2 text-sm"
                    value={exportOptions.filters.maxComplexity || ''}
                    onChange={(e) => setExportOptions(prev => ({
                      ...prev,
                      filters: {
                        ...prev.filters,
                        maxComplexity: e.target.value ? Number(e.target.value) : undefined,
                      },
                    }))}
                    placeholder="No maximum"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Preview */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Export Preview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-muted-foreground space-y-1">
                <p>Format: <Badge variant="secondary">{exportOptions.format.toUpperCase()}</Badge></p>
                <p>Entities to export: <Badge variant="secondary">{filteredEntities.length}</Badge></p>
                <p>Fields included: <Badge variant="secondary">{Object.values(exportOptions.includeFields).filter(Boolean).length}</Badge></p>
              </div>
            </CardContent>
          </Card>
        </div>

        <DialogFooter>
          <div className="flex items-center gap-2 w-full justify-between">
            <Button variant="outline" onClick={onClose} disabled={isExporting}>
              Cancel
            </Button>
            <Button 
              onClick={handleExport} 
              disabled={isExporting || filteredEntities.length === 0}
              className="min-w-32"
            >
              {isExporting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Exporting...
                </>
              ) : exportComplete ? (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Exported!
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Export ({filteredEntities.length} entities)
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}