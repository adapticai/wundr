import fs from 'fs';
import path from 'path';
import { parseMarkdown, extractFrontMatter, markdownToHtml, type ParsedMarkdown } from '@/lib/markdown-utils';

interface ExtendedMarkdown {
  html: string;
  frontmatter: Record<string, any>;
  tableOfContents: any[];
  wordCount: number;
  readingTime: number;
}

/**
 * Server-side utilities for reading markdown files
 * These functions should only be used in server components or API routes
 */

/**
 * Read and parse a markdown file from the filesystem (server-side only)
 */
export async function readMarkdownFile(filePath: string): Promise<ExtendedMarkdown | null> {
  try {
    if (!fs.existsSync(filePath)) {
      return null;
    }

    const fileContent = fs.readFileSync(filePath, 'utf8');
    const { metadata, content: extractedContent } = extractFrontMatter(fileContent);
    const htmlContent = await markdownToHtml(extractedContent);
    
    return {
      html: htmlContent,
      frontmatter: metadata,
      tableOfContents: [],
      wordCount: extractedContent.split(/\s+/).length,
      readingTime: Math.ceil(extractedContent.split(/\s+/).length / 200) // Assuming 200 words per minute
    };
  } catch (error) {
    console.error(`Error reading markdown file ${filePath}:`, error);
    return null;
  }
}

/**
 * Get all markdown files in a directory (server-side only)
 */
export function getMarkdownFiles(dirPath: string, recursive = true): string[] {
  try {
    if (!fs.existsSync(dirPath) || !fs.statSync(dirPath).isDirectory()) {
      return [];
    }

    const files: string[] = [];
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      
      if (entry.isDirectory() && recursive) {
        files.push(...getMarkdownFiles(fullPath, recursive));
      } else if (entry.isFile() && (entry.name.endsWith('.md') || entry.name.endsWith('.mdx'))) {
        files.push(fullPath);
      }
    }

    return files;
  } catch (error) {
    console.error(`Error reading directory ${dirPath}:`, error);
    return [];
  }
}

/**
 * Read multiple markdown files and return their parsed content
 */
export async function readMultipleMarkdownFiles(filePaths: string[]): Promise<Array<{ path: string; content: ExtendedMarkdown | null }>> {
  const results = await Promise.all(
    filePaths.map(async (filePath) => ({
      path: filePath,
      content: await readMarkdownFile(filePath)
    }))
  );

  return results;
}

/**
 * Get file stats for a given path
 */
export function getFileStats(filePath: string) {
  try {
    const stats = fs.statSync(filePath);
    return {
      size: stats.size,
      modified: stats.mtime,
      created: stats.birthtime,
      isDirectory: stats.isDirectory(),
      isFile: stats.isFile()
    };
  } catch (error) {
    console.error(`Error getting file stats for ${filePath}:`, error);
    return null;
  }
}