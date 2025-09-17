'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { FileSystemItem } from '@/lib/file-system';

// Dynamically import FileBrowser to avoid SSR issues
const FileBrowser = dynamic(
  () => import('@/components/file-browser/file-browser').then(mod => mod.FileBrowser),
  { 
    ssr: false,
    loading: () => <div>Loading file browser...</div>
  }
);

export default function FilesPage() {
  const handleFileSelect = (_file: FileSystemItem) => {
    // File selection handler - could implement file preview logic
  };

  const handleFileDoubleClick = (_file: FileSystemItem) => {
    // File double-click handler - could implement file opening logic
    // For example, opening in a new tab, editor, etc.
  };

  return (
    <div className="h-full flex flex-col">
      <div className="border-b bg-background p-4">
        <div>
          <h1 className="text-2xl font-bold">File Browser</h1>
          <p className="text-sm text-muted-foreground">
            Browse and manage repository files with advanced filtering and preview capabilities
          </p>
        </div>
      </div>
      
      <div className="flex-1 overflow-hidden">
        <FileBrowser
          rootPath="/"
          onFileSelect={handleFileSelect}
          onFileDoubleClick={handleFileDoubleClick}
          showPreview={true}
          defaultViewMode="list"
          className="h-full"
        />
      </div>
    </div>
  );
}