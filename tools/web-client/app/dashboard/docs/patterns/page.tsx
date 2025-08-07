import React from 'react';
import { DocsLayout } from '@/components/docs/DocsLayout';
import { MarkdownRenderer } from '@/components/markdown/MarkdownRenderer';
import { SearchableContent } from '@/components/docs/SearchableContent';
import { generateDocSlug, DocPage } from '@/lib/docs-utils';
import * as fs from 'fs-extra';
import * as path from 'path';
import matter from 'gray-matter';
import { notFound } from 'next/navigation';

// Server-side function to load patterns page
async function loadPatternsPage(): Promise<DocPage | null> {
  try {
    const DOCS_ROOT = path.join(process.cwd(), '../../docs');
    
    // Try multiple potential file locations
    const possiblePaths = [
      path.join(DOCS_ROOT, 'standards', 'GOLDEN_STANDARDS.md'),
      path.join(DOCS_ROOT, 'standards', 'PATTERN_EXAMPLES.md'),
      path.join(DOCS_ROOT, 'GOLDEN_STANDARDS.md')
    ];
    
    for (const filePath of possiblePaths) {
      try {
        const exists = await fs.pathExists(filePath);
        if (!exists) continue;
        
        const fileContents = await fs.readFile(filePath, 'utf8');
        const { data, content } = matter(fileContents);
        const stats = await fs.stat(filePath);
        
        return {
          id: 'patterns',
          slug: generateDocSlug('Golden Patterns & Standards'),
          title: data.title || 'Golden Patterns & Standards',
          description: data.description || 'Best practices and recommended patterns for code organization',
          content,
          html: '', // Will be processed by MarkdownRenderer
          frontmatter: {
            title: data.title || 'Golden Patterns & Standards',
            description: data.description || 'Best practices and recommended patterns for code organization',
            category: data.category || 'standards',
            tags: data.tags || ['patterns', 'standards', 'best-practices'],
            version: data.version,
            deprecated: data.deprecated,
            lastUpdated: data.lastUpdated,
            author: data.author,
            order: data.order || 1,
            api: data.api,
            toc: data.toc !== false
          },
          path: 'standards/patterns',
          category: data.category || 'standards',
          sections: [], // Will be extracted by MarkdownRenderer
          lastUpdated: stats.mtime,
          searchTerms: [],
          wordCount: content.split(/\s+/).length
        };
      } catch (error) {
        console.warn(`Could not read ${filePath}:`, error);
        continue;
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error loading patterns page:', error);
    return null;
  }
}

export default async function PatternsPage() {
  const docPage = await loadPatternsPage();
  
  if (!docPage) {
    notFound();
  }

  const currentPage = {
    title: docPage.title,
    slug: docPage.slug,
    path: '/dashboard/docs/patterns',
    category: docPage.category,
    description: docPage.description,
    tags: docPage.frontmatter.tags,
    order: docPage.frontmatter.order || 3,
    lastUpdated: docPage.lastUpdated,
    version: docPage.frontmatter.version,
    deprecated: docPage.frontmatter.deprecated,
    wordCount: docPage.wordCount
  };

  return (
    <DocsLayout currentPage={currentPage}>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Version notice if deprecated */}
        {docPage.frontmatter.deprecated && (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-400 p-4 rounded">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                  Deprecated Content
                </h3>
                <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                  This documentation is deprecated. Please refer to the latest version for current best practices.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Enhanced search functionality */}
        <SearchableContent 
          content={docPage.content}
          onNavigate={(sectionId) => {
            const element = document.getElementById(sectionId);
            if (element) {
              element.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
          }}
        />

        {/* Document metadata */}
        <div className="bg-muted/30 rounded-lg p-4 text-sm text-muted-foreground">
          <div className="flex flex-wrap gap-4">
            {docPage.frontmatter.author && (
              <span>Author: {docPage.frontmatter.author}</span>
            )}
            <span>Last updated: {docPage.lastUpdated.toLocaleDateString()}</span>
            <span>Words: {docPage.wordCount.toLocaleString()}</span>
            {docPage.frontmatter.version && (
              <span>Version: {docPage.frontmatter.version}</span>
            )}
          </div>
        </div>

        {/* Main content with enhanced rendering */}
        <MarkdownRenderer
          content={docPage.content}
          frontmatter={docPage.frontmatter}
          showMetadata={false} // Already shown above
          showTableOfContents={docPage.frontmatter.toc !== false}
          enableSyntaxHighlighting={true}
          enableMath={false}
          enableMermaid={false}
        />

        {/* Related pages or next steps */}
        <div className="mt-12 pt-8 border-t border-border">
          <h3 className="text-lg font-semibold mb-4">Related Documentation</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <a 
              href="/dashboard/docs/api"
              className="block p-4 rounded-lg border border-border hover:border-primary/50 transition-colors"
            >
              <h4 className="font-medium mb-2">API Reference</h4>
              <p className="text-sm text-muted-foreground">
                Detailed API documentation and type definitions
              </p>
            </a>
            <a 
              href="/dashboard/docs/getting-started"
              className="block p-4 rounded-lg border border-border hover:border-primary/50 transition-colors"
            >
              <h4 className="font-medium mb-2">Getting Started</h4>
              <p className="text-sm text-muted-foreground">
                Quick start guide and setup instructions
              </p>
            </a>
          </div>
        </div>
      </div>
    </DocsLayout>
  );
}