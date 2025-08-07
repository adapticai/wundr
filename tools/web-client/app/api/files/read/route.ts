import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs-extra';
import * as path from 'path';

function isBinaryFile(buffer: Buffer): boolean {
  // Simple binary detection - check for null bytes in first 1024 bytes
  const sample = buffer.slice(0, Math.min(1024, buffer.length));
  for (let i = 0; i < sample.length; i++) {
    if (sample[i] === 0) {
      return true;
    }
  }
  return false;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const filePath = searchParams.get('path');
    
    if (!filePath) {
      return NextResponse.json(
        { error: 'File path is required' },
        { status: 400 }
      );
    }

    // Validate path to prevent directory traversal
    const rootPath = process.cwd();
    const resolvedPath = path.resolve(filePath);
    
    if (!resolvedPath.startsWith(rootPath)) {
      return NextResponse.json(
        { error: 'Access denied: Path outside of allowed directory' },
        { status: 403 }
      );
    }

    // Check if file exists
    const exists = await fs.pathExists(resolvedPath);
    if (!exists) {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      );
    }

    const stats = await fs.stat(resolvedPath);
    
    // Skip binary files and very large files
    if (stats.size > 10 * 1024 * 1024) { // 10MB limit
      return NextResponse.json(
        { error: 'File too large to read (max 10MB)' },
        { status: 413 }
      );
    }
    
    // Check if file is binary
    const buffer = await fs.readFile(resolvedPath);
    if (isBinaryFile(buffer)) {
      return NextResponse.json(
        { error: 'Cannot read binary file' },
        { status: 415 }
      );
    }
    
    const content = buffer.toString('utf8');
    
    return NextResponse.json({
      content,
      size: stats.size,
      modified: stats.mtime,
      path: resolvedPath,
      name: path.basename(resolvedPath)
    });
  } catch (error) {
    console.error('Error reading file:', error);
    return NextResponse.json(
      { error: 'Failed to read file' },
      { status: 500 }
    );
  }
}