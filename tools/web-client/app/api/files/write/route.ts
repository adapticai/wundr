import { NextRequest, NextResponse } from 'next/server';

// Force dynamic rendering to allow fs access
export const dynamic = 'force-dynamic'
// Ensure this runs only on Node.js runtime
export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    // Dynamic imports for Node.js modules
    const fs = await import('fs-extra');
    const path = await import('path');
    
    const body = await request.json();
    const { path: filePath, content } = body;
    
    if (!filePath) {
      return NextResponse.json(
        { error: 'File path is required' },
        { status: 400 }
      );
    }
    
    if (typeof content !== 'string') {
      return NextResponse.json(
        { error: 'Content must be a string' },
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

    // Ensure directory exists
    await fs.ensureDir(path.dirname(resolvedPath));
    
    // Write file
    await fs.writeFile(resolvedPath, content, 'utf8');
    
    // Get file stats for response
    const stats = await fs.stat(resolvedPath);
    
    return NextResponse.json({
      success: true,
      path: resolvedPath,
      name: path.basename(resolvedPath),
      size: stats.size,
      modified: stats.mtime
    });
  } catch (_error) {
    // Error logged - details available in network tab;
    return NextResponse.json(
      { error: 'Failed to write file' },
      { status: 500 }
    );
  }
}