export interface FileInfo {
  id: string;
  path: string;
  name: string;
  size: number;
  type: 'file' | 'directory';
  modifiedAt: Date;
  extension?: string;
  children?: FileInfo[];
}

// For backwards compatibility
export interface FileSystemItem extends FileInfo {
  modified?: Date;
}

// Utility functions for file operations
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Utility function to format date for both legacy and new properties
export function formatDate(date: Date | string | undefined): string {
  if (!date) return '';
  const d = new Date(date);
  return d.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

import * as React from 'react';
import {
  FileText,
  Code,
  Globe,
  Palette,
  Database,
  Settings,
  Image,
  FileImage,
  Zap,
} from 'lucide-react';

export function getFileTypeInfo(fileName: string): {
  type: string;
  category: string;
  icon: React.ComponentType<any>;
  color: string;
} {
  const extension = fileName.toLowerCase().split('.').pop() || '';

  const typeMap: Record<
    string,
    {
      type: string;
      category: string;
      icon: React.ComponentType<any>;
      color: string;
    }
  > = {
    // Code files
    js: {
      type: 'JavaScript',
      category: 'Code',
      icon: Code,
      color: 'text-yellow-500',
    },
    ts: {
      type: 'TypeScript',
      category: 'Code',
      icon: Code,
      color: 'text-blue-600',
    },
    jsx: {
      type: 'React JSX',
      category: 'Code',
      icon: Code,
      color: 'text-cyan-400',
    },
    tsx: {
      type: 'React TSX',
      category: 'Code',
      icon: Code,
      color: 'text-cyan-400',
    },
    py: {
      type: 'Python',
      category: 'Code',
      icon: Code,
      color: 'text-blue-500',
    },
    java: {
      type: 'Java',
      category: 'Code',
      icon: Code,
      color: 'text-orange-500',
    },
    cpp: { type: 'C++', category: 'Code', icon: Code, color: 'text-blue-700' },
    c: { type: 'C', category: 'Code', icon: Code, color: 'text-gray-600' },
    go: { type: 'Go', category: 'Code', icon: Zap, color: 'text-cyan-500' },
    rs: {
      type: 'Rust',
      category: 'Code',
      icon: Code,
      color: 'text-orange-600',
    },
    php: {
      type: 'PHP',
      category: 'Code',
      icon: Code,
      color: 'text-indigo-600',
    },
    rb: { type: 'Ruby', category: 'Code', icon: Code, color: 'text-red-600' },

    // Web files
    html: {
      type: 'HTML',
      category: 'Web',
      icon: Globe,
      color: 'text-orange-500',
    },
    css: {
      type: 'CSS',
      category: 'Style',
      icon: Palette,
      color: 'text-blue-600',
    },
    scss: {
      type: 'SCSS',
      category: 'Style',
      icon: Palette,
      color: 'text-pink-500',
    },
    sass: {
      type: 'Sass',
      category: 'Style',
      icon: Palette,
      color: 'text-pink-500',
    },

    // Data files
    json: {
      type: 'JSON',
      category: 'Data',
      icon: Database,
      color: 'text-gray-700',
    },
    xml: {
      type: 'XML',
      category: 'Data',
      icon: FileText,
      color: 'text-blue-600',
    },
    yaml: {
      type: 'YAML',
      category: 'Config',
      icon: Settings,
      color: 'text-red-500',
    },
    yml: {
      type: 'YAML',
      category: 'Config',
      icon: Settings,
      color: 'text-red-500',
    },
    csv: {
      type: 'CSV',
      category: 'Data',
      icon: Database,
      color: 'text-green-600',
    },

    // Documentation
    md: {
      type: 'Markdown',
      category: 'Document',
      icon: FileText,
      color: 'text-blue-700',
    },
    txt: {
      type: 'Text',
      category: 'Document',
      icon: FileText,
      color: 'text-gray-600',
    },
    pdf: {
      type: 'PDF',
      category: 'Document',
      icon: FileText,
      color: 'text-red-500',
    },

    // Images
    png: {
      type: 'PNG Image',
      category: 'Image',
      icon: FileImage,
      color: 'text-purple-500',
    },
    jpg: {
      type: 'JPEG Image',
      category: 'Image',
      icon: FileImage,
      color: 'text-purple-500',
    },
    jpeg: {
      type: 'JPEG Image',
      category: 'Image',
      icon: FileImage,
      color: 'text-purple-500',
    },
    gif: {
      type: 'GIF Image',
      category: 'Image',
      icon: FileImage,
      color: 'text-purple-500',
    },
    svg: {
      type: 'SVG Image',
      category: 'Image',
      icon: Image,
      color: 'text-orange-400',
    },

    // Config files
    config: {
      type: 'Config',
      category: 'Config',
      icon: Settings,
      color: 'text-gray-500',
    },
    env: {
      type: 'Environment',
      category: 'Config',
      icon: Settings,
      color: 'text-gray-500',
    },
    gitignore: {
      type: 'Git Ignore',
      category: 'Config',
      icon: Settings,
      color: 'text-red-500',
    },
  };

  return (
    typeMap[extension] || {
      type: 'Unknown',
      category: 'Unknown',
      icon: FileText,
      color: 'text-gray-500',
    }
  );
}

export function sortFileSystemItems(
  items: FileInfo[],
  sortBy: 'name' | 'size' | 'modified' | 'modifiedAt' = 'name',
  sortOrder: 'asc' | 'desc' = 'asc'
): FileInfo[] {
  return [...items].sort((a, b) => {
    let comparison = 0;

    // Always sort directories first
    if (a.type === 'directory' && b.type === 'file') return -1;
    if (a.type === 'file' && b.type === 'directory') return 1;

    switch (sortBy) {
      case 'name':
        comparison = a.name.localeCompare(b.name, undefined, { numeric: true });
        break;
      case 'size':
        comparison = a.size - b.size;
        break;
      case 'modified':
      case 'modifiedAt':
        const aDate = 'modified' in a && a.modified ? a.modified : a.modifiedAt;
        const bDate = 'modified' in b && b.modified ? b.modified : b.modifiedAt;
        comparison =
          new Date((aDate as string | Date) || 0).getTime() -
          new Date((bDate as string | Date) || 0).getTime();
        break;
    }

    return sortOrder === 'asc' ? comparison : -comparison;
  });
}

export interface FileSystemError {
  code: string;
  message: string;
  path?: string;
}

export class FileSystemService {
  private baseUrl: string;

  constructor(baseUrl = '/api/files') {
    this.baseUrl = baseUrl;
  }

  async listFiles(path = '/'): Promise<FileInfo[]> {
    const response = await fetch(
      `${this.baseUrl}/list?path=${encodeURIComponent(path)}`
    );
    if (!response.ok) {
      throw new Error('Failed to list files');
    }
    return response.json();
  }

  async readFile(path: string): Promise<string> {
    const response = await fetch(
      `${this.baseUrl}/read?path=${encodeURIComponent(path)}`
    );
    if (!response.ok) {
      throw new Error('Failed to read file');
    }
    return response.text();
  }

  async writeFile(path: string, content: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/write`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, content }),
    });
    if (!response.ok) {
      throw new Error('Failed to write file');
    }
  }

  async deleteFile(path: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/delete`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path }),
    });
    if (!response.ok) {
      throw new Error('Failed to delete file');
    }
  }

  async createDirectory(path: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/mkdir`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path }),
    });
    if (!response.ok) {
      throw new Error('Failed to create directory');
    }
  }

  async moveFile(from: string, to: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/move`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to }),
    });
    if (!response.ok) {
      throw new Error('Failed to move file');
    }
  }

  async copyFile(from: string, to: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/copy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to }),
    });
    if (!response.ok) {
      throw new Error('Failed to copy file');
    }
  }

  async getFileInfo(path: string): Promise<FileInfo> {
    const response = await fetch(
      `${this.baseUrl}/info?path=${encodeURIComponent(path)}`
    );
    if (!response.ok) {
      throw new Error('Failed to get file info');
    }
    return response.json();
  }

  async searchFiles(query: string, path = '/'): Promise<FileInfo[]> {
    const response = await fetch(
      `${this.baseUrl}/search?query=${encodeURIComponent(query)}&path=${encodeURIComponent(path)}`
    );
    if (!response.ok) {
      throw new Error('Failed to search files');
    }
    return response.json();
  }
}

export const fileSystemService = new FileSystemService();

// Legacy function for backwards compatibility
export function filterFileSystemItems(
  items: FileSystemItem[],
  query: string,
  showHidden = false
): FileSystemItem[] {
  return items.filter(item => {
    // Filter by search query
    if (query && !item.name.toLowerCase().includes(query.toLowerCase())) {
      return false;
    }

    // Filter hidden files
    if (!showHidden && item.name.startsWith('.')) {
      return false;
    }

    return true;
  });
}
