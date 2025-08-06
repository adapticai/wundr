'use client';

import React, { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CalendarIcon, UserIcon, TagIcon, ClockIcon } from 'lucide-react';
import { markdownToHtml, ParsedMarkdown, extractTableOfContents } from '@/lib/markdown-utils';

interface MarkdownRendererProps {
  content: string;
  frontmatter?: ParsedMarkdown['data'];
  showMetadata?: boolean;
  showTableOfContents?: boolean;
  className?: string;
}

interface TocItem {
  level: number;
  title: string;
  id: string;
}

export function MarkdownRenderer({
  content,
  frontmatter = {},
  showMetadata = true,
  showTableOfContents = true,
  className = ''
}: MarkdownRendererProps) {
  const [htmlContent, setHtmlContent] = useState<string>('');
  const [toc, setToc] = useState<TocItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const renderMarkdown = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        const html = await markdownToHtml(content);
        setHtmlContent(html);
        
        if (showTableOfContents) {
          const tocItems = extractTableOfContents(content);
          setToc(tocItems);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to render markdown');
      } finally {
        setIsLoading(false);
      }
    };

    if (content) {
      renderMarkdown();
    }
  }, [content, showTableOfContents]);

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch {
      return dateString;
    }
  };

  const estimateReadingTime = (text: string) => {
    const wordsPerMinute = 200;
    const wordCount = text.split(/\s+/).length;
    return Math.ceil(wordCount / wordsPerMinute);
  };

  if (isLoading) {
    return (
      <div className={`animate-pulse space-y-4 ${className}`}>
        <div className="h-4 bg-muted rounded w-3/4"></div>
        <div className="h-4 bg-muted rounded w-1/2"></div>
        <div className="h-4 bg-muted rounded w-5/6"></div>
      </div>
    );
  }

  if (error) {
    return (
      <Card className={`p-6 border-destructive ${className}`}>
        <div className="text-destructive">
          <h3 className="font-semibold mb-2">Failed to render markdown</h3>
          <p className="text-sm">{error}</p>
        </div>
      </Card>
    );
  }

  return (
    <div className={`markdown-renderer ${className}`}>
      {/* Metadata Section */}
      {showMetadata && Object.keys(frontmatter).length > 0 && (
        <Card className="mb-6 p-6 bg-muted/50">
          <div className="space-y-4">
            {frontmatter.title && (
              <h1 className="text-3xl font-bold text-foreground">
                {frontmatter.title}
              </h1>
            )}
            
            {frontmatter.description && (
              <p className="text-lg text-muted-foreground">
                {frontmatter.description}
              </p>
            )}

            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
              {frontmatter.author && (
                <div className="flex items-center gap-1">
                  <UserIcon className="h-4 w-4" />
                  <span>{frontmatter.author}</span>
                </div>
              )}
              
              {frontmatter.date && (
                <div className="flex items-center gap-1">
                  <CalendarIcon className="h-4 w-4" />
                  <span>{formatDate(frontmatter.date)}</span>
                </div>
              )}
              
              <div className="flex items-center gap-1">
                <ClockIcon className="h-4 w-4" />
                <span>{estimateReadingTime(content)} min read</span>
              </div>
            </div>

            {frontmatter.tags && frontmatter.tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                <TagIcon className="h-4 w-4 text-muted-foreground mt-1" />
                {frontmatter.tags.map((tag, index) => (
                  <Badge key={index} variant="secondary" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </Card>
      )}

      <div className="flex gap-6">
        {/* Table of Contents */}
        {showTableOfContents && toc.length > 0 && (
          <aside className="hidden lg:block w-64 shrink-0">
            <Card className="p-4 sticky top-4">
              <h3 className="font-semibold mb-3 text-sm uppercase tracking-wide text-muted-foreground">
                Table of Contents
              </h3>
              <nav className="space-y-1">
                {toc.map((item, index) => (
                  <a
                    key={index}
                    href={`#${item.id}`}
                    className={`
                      block text-sm hover:text-primary transition-colors
                      ${item.level === 1 ? 'font-medium' : ''}
                      ${item.level === 2 ? 'ml-3 text-muted-foreground' : ''}
                      ${item.level === 3 ? 'ml-6 text-muted-foreground' : ''}
                      ${item.level >= 4 ? 'ml-9 text-muted-foreground' : ''}
                    `}
                  >
                    {item.title}
                  </a>
                ))}
              </nav>
            </Card>
          </aside>
        )}

        {/* Main Content */}
        <div className="flex-1 min-w-0">
          <Card className="p-6">
            <div
              className="markdown-content prose prose-neutral dark:prose-invert max-w-none
                prose-headings:scroll-mt-20
                prose-h1:text-2xl prose-h1:font-bold prose-h1:mb-4
                prose-h2:text-xl prose-h2:font-semibold prose-h2:mb-3 prose-h2:mt-6
                prose-h3:text-lg prose-h3:font-medium prose-h3:mb-2 prose-h3:mt-4
                prose-p:mb-4 prose-p:leading-relaxed
                prose-a:text-primary prose-a:no-underline hover:prose-a:underline
                prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-sm
                prose-pre:!bg-transparent prose-pre:!border-0 prose-pre:!p-0 prose-pre:!rounded-none prose-pre:!overflow-visible
                prose-blockquote:border-l-4 prose-blockquote:border-primary prose-blockquote:pl-4 prose-blockquote:italic
                prose-ul:mb-4 prose-ol:mb-4
                prose-li:mb-1
                prose-table:w-full prose-table:border-collapse
                prose-th:border prose-th:border-border prose-th:bg-muted prose-th:p-2 prose-th:text-left
                prose-td:border prose-td:border-border prose-td:p-2
                prose-img:rounded-lg prose-img:shadow-sm
                prose-hr:border-border prose-hr:my-6"
              dangerouslySetInnerHTML={{ __html: htmlContent }}
            />
          </Card>
        </div>
      </div>
    </div>
  );
}

export default MarkdownRenderer;