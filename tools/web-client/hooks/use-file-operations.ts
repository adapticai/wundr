'use client';

import { useCallback, useState } from 'react';
import { FileSystemItem } from '@/lib/file-system';

export interface FileOperationResult {
  success: boolean;
  message?: string;
  error?: string;
}

export function useFileOperations() {
  const [isLoading, setIsLoading] = useState(false);

  const downloadFile = useCallback(async (file: FileSystemItem): Promise<FileOperationResult> => {
    try {
      setIsLoading(true);
      
      // In a real implementation, you would fetch the file content from your API
      // For now, we'll simulate the download
      const response = await fetch(`/api/files${file.path}`);
      
      if (!response.ok) {
        throw new Error(`Failed to download file: ${response.statusText}`);
      }
      
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      return { success: true, message: 'File downloaded successfully' };
    } catch (error) {
      console.error('Download failed:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Download failed' 
      };
    } finally {
      setIsLoading(false);
    }
  }, []);

  const copyFilePath = useCallback(async (file: FileSystemItem): Promise<FileOperationResult> => {
    try {
      await navigator.clipboard.writeText(file.path);
      return { success: true, message: 'File path copied to clipboard' };
    } catch (error) {
      console.error('Copy failed:', error);
      return { 
        success: false, 
        error: 'Failed to copy path to clipboard' 
      };
    }
  }, []);

  const getFileContent = useCallback(async (file: FileSystemItem): Promise<string | null> => {
    try {
      setIsLoading(true);
      
      // In a real implementation, you would fetch from your API
      const response = await fetch(`/api/files${file.path}/content`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch file content: ${response.statusText}`);
      }
      
      return await response.text();
    } catch (error) {
      console.error('Failed to get file content:', error);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const previewFile = useCallback(async (file: FileSystemItem): Promise<FileOperationResult> => {
    try {
      // This would typically open a modal or navigate to a preview page
      const content = await getFileContent(file);
      
      if (content === null) {
        return { success: false, error: 'Failed to load file content' };
      }
      
      // For now, just log the content (in a real app, you'd show it in a modal)
      console.log('File content:', content);
      
      return { success: true, message: 'File preview opened' };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Preview failed' 
      };
    }
  }, [getFileContent]);

  const editFile = useCallback(async (file: FileSystemItem): Promise<FileOperationResult> => {
    try {
      // This would typically navigate to an editor or open an editor modal
      const content = await getFileContent(file);
      
      if (content === null) {
        return { success: false, error: 'Failed to load file content' };
      }
      
      // For now, just log (in a real app, you'd open an editor)
      console.log('Opening file for editing:', file.path);
      
      return { success: true, message: 'File opened in editor' };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to open editor' 
      };
    }
  }, [getFileContent]);

  const refreshDirectory = useCallback(async (path: string): Promise<FileSystemItem[]> => {
    try {
      setIsLoading(true);
      
      // In a real implementation, you would fetch from your API
      const response = await fetch(`/api/files${path}`);
      
      if (!response.ok) {
        throw new Error(`Failed to refresh directory: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Failed to refresh directory:', error);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    isLoading,
    downloadFile,
    copyFilePath,
    getFileContent,
    previewFile,
    editFile,
    refreshDirectory,
  };
}

export default useFileOperations;