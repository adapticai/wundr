import { NextRequest, NextResponse } from 'next/server';
import matter from 'gray-matter';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export interface DocFrontmatter {
  title: string;
  description: string;
  category: string;
  tags: string[];
  version?: string;
  deprecated?: boolean;
  lastUpdated?: string;
  author?: string;
  order?: number;
  api?: boolean;
  toc?: boolean;
}

export interface DocFile {
  id: string;
  path: string;
  relativePath: string;
  frontmatter: DocFrontmatter;
  lastModified: Date;
}

// Base paths for documentation
const DOCS_ROOT = process.cwd() + '/../../docs';

async function getAllDocFiles(docsDir: string): Promise<DocFile[]> {
  const fs = await import('fs-extra');
  const path = await import('path');
  
  const files: DocFile[] = [];
  
  async function scanDirectory(dir: string, relativeTo: string): Promise<void> {
    try {
      const exists = await fs.pathExists(dir);
      if (!exists) return;
      
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relativePath = path.relative(relativeTo, fullPath);
        
        if (entry.isDirectory()) {
          await scanDirectory(fullPath, relativeTo);
        } else if (entry.isFile() && (entry.name.endsWith('.md') || entry.name.endsWith('.mdx'))) {
          try {
            const fileContents = await fs.readFile(fullPath, 'utf8');
            const { data } = matter(fileContents);
            const stats = await fs.stat(fullPath);
            
            const frontmatter: DocFrontmatter = {
              title: data.title || path.basename(entry.name, path.extname(entry.name)),
              description: data.description || '',
              category: data.category || 'general',
              tags: data.tags || [],
              version: data.version,
              deprecated: data.deprecated,
              lastUpdated: data.lastUpdated,
              author: data.author,
              order: data.order,
              api: data.api,
              toc: data.toc !== false
            };
            
            files.push({
              id: relativePath.replace(/\.(md|mdx)$/, ''),
              path: fullPath,
              relativePath,
              frontmatter,
              lastModified: stats.mtime
            });
          } catch (error) {
            console.warn(`Failed to process doc file ${fullPath}:`, error);
          }
        }
      }
    } catch (error) {
      console.error(`Error scanning directory ${dir}:`, error);
    }
  }
  
  await scanDirectory(docsDir, docsDir);
  return files;
}

export async function GET(request: NextRequest) {
  try {
    const fs = await import('fs-extra');
    const path = await import('path');
    
    const searchParams = request.nextUrl.searchParams;
    const docsPath = searchParams.get('path') || DOCS_ROOT;
    const category = searchParams.get('category');
    const tag = searchParams.get('tag');
    
    // Resolve and validate path
    const resolvedDocsPath = path.resolve(docsPath);
    
    // Get all doc files
    const docFiles = await getAllDocFiles(resolvedDocsPath);
    
    // Filter by category if specified
    let filteredFiles = docFiles;
    if (category) {
      filteredFiles = filteredFiles.filter(file => file.frontmatter.category === category);
    }
    
    // Filter by tag if specified
    if (tag) {
      filteredFiles = filteredFiles.filter(file => 
        file.frontmatter.tags.includes(tag)
      );
    }
    
    // Sort files
    filteredFiles.sort((a, b) => {
      // Sort by category first, then by order, then by title
      const categoryCompare = a.frontmatter.category.localeCompare(b.frontmatter.category);
      if (categoryCompare !== 0) return categoryCompare;
      
      const orderA = a.frontmatter.order || 999;
      const orderB = b.frontmatter.order || 999;
      if (orderA !== orderB) return orderA - orderB;
      
      return a.frontmatter.title.localeCompare(b.frontmatter.title);
    });
    
    return NextResponse.json({
      files: filteredFiles,
      total: filteredFiles.length,
      categories: [...new Set(docFiles.map(f => f.frontmatter.category))].sort(),
      tags: [...new Set(docFiles.flatMap(f => f.frontmatter.tags))].sort()
    });
  } catch (error) {
    console.error('Error listing docs:', error);
    return NextResponse.json(
      { error: 'Failed to list documentation files' },
      { status: 500 }
    );
  }
}