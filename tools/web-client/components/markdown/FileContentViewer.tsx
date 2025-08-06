'use client';

import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  FileIcon,
  DownloadIcon,
  CopyIcon,
  EyeIcon,
  FileTextIcon,
  CodeIcon,
  AlertCircleIcon
} from 'lucide-react';
import { MarkdownRenderer } from './MarkdownRenderer';
import { parseMarkdown, detectFileType, formatFileSize } from '@/lib/markdown-utils';

interface FileContentViewerProps {
  filePath: string;
  fileName: string;
  fileSize?: number;
  content?: string;
  className?: string;
  maxPreviewSize?: number; // in bytes
}

interface FileInfo {
  name: string;
  type: string;
  size: number;
  isPreviewable: boolean;
  icon: React.ReactNode;
}

export function FileContentViewer({
  filePath: _filePath,
  fileName,
  fileSize = 0,
  content = '',
  className = '',
  maxPreviewSize = 1024 * 1024 // 1MB default
}: FileContentViewerProps) {
  const [fileContent] = useState<string>(content);
  const [isLoading, setIsLoading] = useState(!content);
  const [error] = useState<string | null>(null);
  const [showRawContent, setShowRawContent] = useState(false);

  const fileType = detectFileType(fileName);
  const isMarkdown = fileType === 'markdown' || fileType === 'mdx';
  const isTooLarge = fileSize > maxPreviewSize;

  const getFileInfo = (): FileInfo => {
    const getIcon = () => {
      switch (fileType) {
        case 'markdown':
        case 'mdx':
          return <FileTextIcon className="h-4 w-4" />;
        case 'javascript':
        case 'typescript':
        case 'json':
          return <CodeIcon className="h-4 w-4" />;
        case 'text':
          return <FileTextIcon className="h-4 w-4" />;
        default:
          return <FileIcon className="h-4 w-4" />;
      }
    };

    const isPreviewable = [
      'markdown', 'mdx', 'text', 'javascript', 'typescript', 'json', 'css', 'html', 'xml', 'yaml'
    ].includes(fileType);

    return {
      name: fileName,
      type: fileType,
      size: fileSize,
      isPreviewable,
      icon: getIcon()
    };
  };

  const fileInfo = getFileInfo();

  useEffect(() => {
    if (!content && !isTooLarge) {
      // In a real implementation, you would fetch the file content here
      // For now, we'll simulate loading
      setIsLoading(false);
    }
  }, [content, isTooLarge]);

  const handleCopyContent = async () => {
    try {
      await navigator.clipboard.writeText(fileContent);
      // You could add a toast notification here
    } catch (err) {
      console.error('Failed to copy content:', err);
    }
  };

  const handleDownload = () => {
    const blob = new Blob([fileContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const renderFileHeader = () => (
    <div className="flex items-center justify-between p-4 border-b">
      <div className="flex items-center gap-3">
        {fileInfo.icon}
        <div>
          <h3 className="font-medium text-foreground">{fileInfo.name}</h3>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="outline" className="text-xs">
              {fileInfo.type.toUpperCase()}
            </Badge>
            {fileSize > 0 && <span>{formatFileSize(fileSize)}</span>}
          </div>
        </div>
      </div>
      
      <div className="flex items-center gap-2">
        {fileContent && (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyContent}
              className="flex items-center gap-1"
            >
              <CopyIcon className="h-3 w-3" />
              Copy
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownload}
              className="flex items-center gap-1"
            >
              <DownloadIcon className="h-3 w-3" />
              Download
            </Button>
          </>
        )}
        
        {isMarkdown && fileContent && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowRawContent(!showRawContent)}
            className="flex items-center gap-1"
          >
            <EyeIcon className="h-3 w-3" />
            {showRawContent ? 'Rendered' : 'Raw'}
          </Button>
        )}
      </div>
    </div>
  );

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="p-6 space-y-3">
          <div className="animate-pulse space-y-2">
            <div className="h-4 bg-muted rounded w-3/4"></div>
            <div className="h-4 bg-muted rounded w-1/2"></div>
            <div className="h-4 bg-muted rounded w-5/6"></div>
          </div>
        </div>
      );
    }

    if (error) {
      return (
        <div className="p-6 text-center">
          <AlertCircleIcon className="h-12 w-12 text-destructive mx-auto mb-3" />
          <h4 className="font-medium text-destructive mb-2">Failed to load file</h4>
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      );
    }

    if (isTooLarge) {
      return (
        <div className="p-6 text-center">
          <AlertCircleIcon className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <h4 className="font-medium mb-2">File too large to preview</h4>
          <p className="text-sm text-muted-foreground mb-4">
            Files larger than {formatFileSize(maxPreviewSize)} cannot be previewed.
          </p>
          <Button onClick={handleDownload} className="flex items-center gap-2">
            <DownloadIcon className="h-4 w-4" />
            Download to view
          </Button>
        </div>
      );
    }

    if (!fileInfo.isPreviewable) {
      return (
        <div className="p-6 text-center">
          <FileIcon className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <h4 className="font-medium mb-2">Preview not available</h4>
          <p className="text-sm text-muted-foreground mb-4">
            This file type cannot be previewed in the browser.
          </p>
          <Button onClick={handleDownload} className="flex items-center gap-2">
            <DownloadIcon className="h-4 w-4" />
            Download file
          </Button>
        </div>
      );
    }

    if (!fileContent) {
      return (
        <div className="p-6 text-center text-muted-foreground">
          <FileTextIcon className="h-12 w-12 mx-auto mb-3" />
          <p>No content to display</p>
        </div>
      );
    }

    // Render markdown content
    if (isMarkdown && !showRawContent) {
      const parsed = parseMarkdown(fileContent);
      return (
        <div className="p-6">
          <MarkdownRenderer
            content={parsed.content}
            frontmatter={parsed.data}
            showMetadata={Object.keys(parsed.data).length > 0}
            showTableOfContents={parsed.content.length > 1000}
          />
        </div>
      );
    }

    // Render raw content or other file types
    return (
      <div className="p-6">
        <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm font-mono whitespace-pre-wrap break-words">
          <code className="text-foreground">{fileContent}</code>
        </pre>
      </div>
    );
  };

  return (
    <Card className={`file-content-viewer ${className}`}>
      {renderFileHeader()}
      {renderContent()}
    </Card>
  );
}

export default FileContentViewer;