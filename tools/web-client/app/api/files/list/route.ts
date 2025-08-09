import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export interface FileSystemItem {
  id: string;
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  modified?: Date;
  children?: FileSystemItem[];
  extension?: string;
  isHidden?: boolean;
}

function getFileExtension(fileName: string): string {
  const parts = fileName.split('.');
  return parts.length > 1 ? parts.pop()! : '';
}

async function traverseDirectory(dirPath: string, maxDepth: number = 10, currentDepth: number = 0): Promise<FileSystemItem[]> {
  if (currentDepth >= maxDepth) {
    return [];
  }

  const fs = await import('fs-extra');
  const path = await import('path');

  const items: FileSystemItem[] = [];
  
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      const stats = await fs.stat(fullPath);
      
      // Skip hidden files and directories (except important ones)
      const isHidden = entry.name.startsWith('.') && 
        !['git', 'env', 'gitignore', 'gitkeep', 'npmrc'].some(suffix => entry.name.includes(suffix));
      
      // Skip node_modules, .git, dist, build directories for performance
      const skipDirs = ['node_modules', '.git', 'dist', 'build', '.next', 'coverage'];
      if (entry.isDirectory() && skipDirs.includes(entry.name)) {
        continue;
      }

      const item: FileSystemItem = {
        id: fullPath,
        name: entry.name,
        path: fullPath,
        type: entry.isDirectory() ? 'directory' : 'file',
        size: stats.size,
        modified: stats.mtime,
        extension: entry.isFile() ? getFileExtension(entry.name) : undefined,
        isHidden
      };

      if (entry.isDirectory()) {
        item.children = await traverseDirectory(fullPath, maxDepth, currentDepth + 1);
      }

      items.push(item);
    }
  } catch (error) {
    console.error(`Error reading directory ${dirPath}:`, error);
    // Continue processing other directories
  }

  return items.sort((a, b) => {
    // Directories first, then files
    if (a.type !== b.type) {
      return a.type === 'directory' ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });
}

export async function GET(request: NextRequest) {
  try {
    const fs = await import('fs-extra');
    const path = await import('path');
    
    const searchParams = request.nextUrl.searchParams;
    const requestedPath = searchParams.get('path') || process.cwd();
    const maxDepth = parseInt(searchParams.get('maxDepth') || '5', 10);

    // Validate path to prevent directory traversal
    const rootPath = process.cwd();
    const resolvedPath = path.resolve(requestedPath);
    
    if (!resolvedPath.startsWith(rootPath)) {
      return NextResponse.json(
        { error: 'Access denied: Path outside of allowed directory' },
        { status: 403 }
      );
    }

    // Check if path exists
    const exists = await fs.pathExists(resolvedPath);
    if (!exists) {
      return NextResponse.json(
        { error: 'Path not found' },
        { status: 404 }
      );
    }

    const stats = await fs.stat(resolvedPath);
    
    if (stats.isDirectory()) {
      // Return directory listing
      const items = await traverseDirectory(resolvedPath, maxDepth);
      
      const result: FileSystemItem = {
        id: resolvedPath,
        name: path.basename(resolvedPath) || 'Root',
        path: resolvedPath,
        type: 'directory',
        size: stats.size,
        modified: stats.mtime,
        children: items
      };

      return NextResponse.json(result);
    } else {
      // Return single file info
      const result: FileSystemItem = {
        id: resolvedPath,
        name: path.basename(resolvedPath),
        path: resolvedPath,
        type: 'file',
        size: stats.size,
        modified: stats.mtime,
        extension: getFileExtension(path.basename(resolvedPath)),
        isHidden: path.basename(resolvedPath).startsWith('.')
      };

      return NextResponse.json(result);
    }
  } catch (error) {
    console.error('Error in files/list API:', error);
    return NextResponse.json(
      { error: 'Failed to list files' },
      { status: 500 }
    );
  }
}