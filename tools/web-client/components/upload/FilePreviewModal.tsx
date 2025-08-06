'use client';

import React from 'react';
import { X, FileText, Database, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FileUploadItem } from '@/hooks/use-file-upload';

interface FilePreviewModalProps {
  file: FileUploadItem | null;
  onClose: () => void;
}

export function FilePreviewModal({ file, onClose }: FilePreviewModalProps) {
  if (!file || !file.preview) return null;

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const renderJsonPreview = () => {
    if (file.preview.type !== 'json') return null;

    return (
      <div className="space-y-6">
        {/* Structure Overview */}
        <div className="space-y-3">
          <div className="flex items-center space-x-2">
            <Database className="h-5 w-5 text-blue-500" />
            <h4 className="font-semibold">Structure Overview</h4>
          </div>
          
          <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
            <div>
              <p className="text-sm font-medium">Data Type</p>
              <p className="text-sm text-muted-foreground">JSON Object</p>
            </div>
            <div>
              <p className="text-sm font-medium">Properties</p>
              <p className="text-sm text-muted-foreground">{file.preview.size} top-level</p>
            </div>
          </div>

          <div>
            <p className="text-sm font-medium mb-3">Top-level Properties</p>
            <div className="flex flex-wrap gap-2">
              {file.preview.keys.map((key: string, index: number) => (
                <Badge key={index} variant="outline" className="font-mono text-xs">
                  {key}
                </Badge>
              ))}
              {file.preview.keys.length >= 10 && (
                <Badge variant="secondary" className="text-xs">
                  +{file.preview.size - 10} more
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Sample Content */}
        <div className="space-y-3">
          <div className="flex items-center space-x-2">
            <FileText className="h-5 w-5 text-green-500" />
            <h4 className="font-semibold">Sample Content</h4>
          </div>
          
          <ScrollArea className="h-64 w-full rounded-md border">
            <pre className="p-4 text-xs font-mono whitespace-pre-wrap">
              {file.preview.sample}
            </pre>
          </ScrollArea>
        </div>
      </div>
    );
  };

  const renderCsvPreview = () => {
    if (file.preview.type !== 'csv') return null;

    return (
      <div className="space-y-6">
        {/* Structure Overview */}
        <div className="space-y-3">
          <div className="flex items-center space-x-2">
            <Database className="h-5 w-5 text-green-500" />
            <h4 className="font-semibold">CSV Structure</h4>
          </div>
          
          <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
            <div>
              <p className="text-sm font-medium">Rows</p>
              <p className="text-sm text-muted-foreground">{file.preview.rows.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-sm font-medium">Columns</p>
              <p className="text-sm text-muted-foreground">{file.preview.headers?.length || 0}</p>
            </div>
          </div>

          <div>
            <p className="text-sm font-medium mb-3">Column Headers</p>
            <div className="flex flex-wrap gap-2">
              {file.preview.headers?.map((header: string, index: number) => (
                <Badge key={index} variant="outline" className="font-mono text-xs">
                  {header}
                </Badge>
              ))}
              {file.preview.headers?.length >= 10 && (
                <Badge variant="secondary" className="text-xs">
                  +{file.preview.headers.length - 10} more
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Sample Data */}
        <div className="space-y-3">
          <div className="flex items-center space-x-2">
            <FileText className="h-5 w-5 text-blue-500" />
            <h4 className="font-semibold">Sample Data</h4>
          </div>
          
          <ScrollArea className="h-64 w-full rounded-md border">
            <pre className="p-4 text-xs font-mono whitespace-pre-wrap">
              {file.preview.sample}
            </pre>
          </ScrollArea>
        </div>
      </div>
    );
  };

  const renderErrorPreview = () => {
    if (file.preview.type !== 'error') return null;

    return (
      <div className="space-y-4">
        <div className="flex items-center space-x-2 text-destructive">
          <AlertCircle className="h-5 w-5" />
          <h4 className="font-semibold">Preview Error</h4>
        </div>
        
        <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
          <p className="text-sm text-destructive font-medium mb-2">
            {file.preview.error}
          </p>
          <p className="text-xs text-muted-foreground">
            The file might be corrupted, too large, or in an unsupported format.
          </p>
        </div>

        {file.preview.sample && (
          <div className="space-y-2">
            <h5 className="font-medium">Raw Content Sample</h5>
            <ScrollArea className="h-32 w-full rounded-md border">
              <pre className="p-4 text-xs font-mono whitespace-pre-wrap">
                {file.preview.sample}
              </pre>
            </ScrollArea>
          </div>
        )}
      </div>
    );
  };

  const renderUnknownPreview = () => {
    if (file.preview.type !== 'unknown') return null;

    return (
      <div className="space-y-4">
        <div className="flex items-center space-x-2">
          <FileText className="h-5 w-5 text-muted-foreground" />
          <h4 className="font-semibold">File Information</h4>
        </div>
        
        <div className="p-4 bg-muted/50 rounded-lg">
          <p className="text-sm text-muted-foreground">
            Preview is not available for this file type. The file will be processed during upload.
          </p>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-4xl max-h-[85vh] flex flex-col">
        <CardHeader className="flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="text-lg">{file.file.name}</CardTitle>
              <CardDescription>
                {formatFileSize(file.file.size)} • File Preview
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={onClose}
              className="flex-shrink-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        
        <CardContent className="flex-1 overflow-hidden">
          <ScrollArea className="h-full pr-4">
            {file.preview.type === 'json' && renderJsonPreview()}
            {file.preview.type === 'csv' && renderCsvPreview()}
            {file.preview.type === 'error' && renderErrorPreview()}
            {file.preview.type === 'unknown' && renderUnknownPreview()}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}