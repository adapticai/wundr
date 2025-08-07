'use client';

import React, { useState, useCallback } from 'react';
import { FileText, Download, Clock, Trash2, RefreshCw, Upload } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useFileUpload } from '@/hooks/use-file-upload';
import { FileUploadZone, FileUploadItem, FilePreviewModal } from '@/components/upload';
import { useToast } from '@/hooks/use-toast';

interface RecentUpload {
  id: string;
  name: string;
  type: string;
  size: number;
  uploadedAt: Date;
  status: 'completed' | 'processing' | 'error';
  records?: number;
}

const ACCEPTED_FILE_TYPES = {
  'application/json': ['.json'],
  'text/csv': ['.csv'],
  'application/vnd.ms-excel': ['.xls'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx']
};

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_FILES = 10;

export default function UploadPage() {
  const { toast } = useToast();
  const [selectedFile, setSelectedFile] = useState<any>(null);
  const [recentUploads, setRecentUploads] = useState<RecentUpload[]>([
    {
      id: '1',
      name: 'analysis-report-2024-01.json',
      type: 'JSON',
      size: 1024576,
      uploadedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      status: 'completed',
      records: 1250
    },
    {
      id: '2',
      name: 'metrics-data.csv',
      type: 'CSV',
      size: 2048576,
      uploadedAt: new Date(Date.now() - 5 * 60 * 60 * 1000),
      status: 'completed',
      records: 5680
    },
    {
      id: '3',
      name: 'performance-report.json',
      type: 'JSON',
      size: 512000,
      uploadedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      status: 'processing'
    }
  ]);

  const {
    uploads,
    isDragOver,
    fileInputRef,
    removeUpload,
    clearUploads,
    retryUpload,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleFileSelect,
    openFileDialog,
    stats
  } = useFileUpload({
    maxFileSize: MAX_FILE_SIZE,
    maxFiles: MAX_FILES,
    acceptedTypes: ACCEPTED_FILE_TYPES,
    onUploadComplete: (file) => {
      toast({
        title: "Upload Complete",
        description: `${file.file.name} has been uploaded successfully.`,
      });

      // Add to recent uploads
      setRecentUploads(prev => [{
        id: file.id,
        name: file.file.name,
        type: file.file.name.endsWith('.json') ? 'JSON' : 'CSV',
        size: file.file.size,
        uploadedAt: new Date(),
        status: 'completed',
        records: Math.floor(Math.random() * 5000) + 100
      }, ...prev]);
    },
    onUploadError: (file, error) => {
      toast({
        title: "Upload Error",
        description: error,
        variant: "destructive",
      });
    }
  });

  const removeRecentUpload = useCallback((uploadId: string) => {
    setRecentUploads(prev => prev.filter(upload => upload.id !== uploadId));
  }, []);

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (date: Date): string => {
    return new Intl.RelativeTimeFormat('en', { numeric: 'auto' }).format(
      Math.ceil((date.getTime() - Date.now()) / (1000 * 60 * 60)),
      'hour'
    );
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="default" className="text-xs">Completed</Badge>;
      case 'processing':
        return <Badge variant="secondary" className="text-xs">Processing</Badge>;
      case 'error':
        return <Badge variant="destructive" className="text-xs">Error</Badge>;
      default:
        return <Badge variant="outline" className="text-xs">Unknown</Badge>;
    }
  };

  return (
    <div className="flex-1 space-y-8 p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Upload Analysis Reports</h2>
          <p className="text-muted-foreground">
            Upload JSON and CSV files for analysis processing
          </p>
        </div>
        
        {uploads.length > 0 && (
          <div className="flex items-center space-x-4">
            <div className="text-sm text-muted-foreground">
              {stats.total} files • {stats.completed} completed • {stats.uploading + stats.processing} in progress
            </div>
            <Button variant="outline" size="sm" onClick={clearUploads}>
              Clear All
            </Button>
          </div>
        )}
      </div>

      <Tabs defaultValue="upload" className="space-y-4">
        <TabsList>
          <TabsTrigger value="upload">Upload Files</TabsTrigger>
          <TabsTrigger value="history">Upload History ({recentUploads.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="upload" className="space-y-4">
          {/* Upload Area */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Upload className="h-5 w-5" />
                <span>File Upload</span>
              </CardTitle>
              <CardDescription>
                Drag and drop files or click to browse. Supports JSON and CSV files up to 10MB each.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FileUploadZone
                isDragOver={isDragOver}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onFileSelect={handleFileSelect}
                fileInputRef={fileInputRef as React.RefObject<HTMLInputElement>}
                maxFileSize={MAX_FILE_SIZE}
                maxFiles={MAX_FILES}
                acceptedTypes={['.json', '.csv', '.xlsx', '.xls']}
                disabled={uploads.length >= MAX_FILES}
              />
              
              {uploads.length >= MAX_FILES && (
                <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md">
                  <p className="text-sm text-yellow-700 dark:text-yellow-300">
                    Maximum file limit reached ({MAX_FILES}). Please remove some files before uploading more.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Upload Queue */}
          {uploads.length > 0 && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Upload Queue ({uploads.length})</CardTitle>
                    <CardDescription>
                      Monitor file upload progress and preview content
                    </CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      uploads
                        .filter(u => u.status === 'error')
                        .forEach(u => retryUpload(u.id));
                    }}
                    disabled={stats.error === 0}
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Retry Failed
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {uploads.map((upload) => (
                    <FileUploadItem
                      key={upload.id}
                      upload={upload}
                      onRemove={removeUpload}
                      onPreview={setSelectedFile}
                      onRetry={retryUpload}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          {/* Recent Uploads */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Uploads</CardTitle>
              <CardDescription>
                View and manage previously uploaded files
              </CardDescription>
            </CardHeader>
            <CardContent>
              {recentUploads.length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">No uploads yet</h3>
                  <p className="text-muted-foreground">
                    Upload your first analysis report to get started.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {recentUploads.map((upload) => (
                    <div key={upload.id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <FileText className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <p className="font-medium">{upload.name}</p>
                            <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                              <span>{formatFileSize(upload.size)}</span>
                              <span>•</span>
                              <span>{upload.type}</span>
                              {upload.records && (
                                <>
                                  <span>•</span>
                                  <span>{upload.records.toLocaleString()} records</span>
                                </>
                              )}
                              <span>•</span>
                              <span>{formatDate(upload.uploadedAt)}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          {getStatusIcon(upload.status)}
                          <Button variant="outline" size="sm">
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => removeRecentUpload(upload.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      
                      {upload.status === 'processing' && (
                        <div className="mt-3 flex items-center space-x-2 text-sm text-muted-foreground">
                          <Clock className="h-4 w-4" />
                          <span>Processing file content...</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* File Preview Modal */}
      <FilePreviewModal
        file={selectedFile}
        onClose={() => setSelectedFile(null)}
      />
    </div>
  );
}