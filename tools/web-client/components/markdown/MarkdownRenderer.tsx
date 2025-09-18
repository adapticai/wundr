'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  CalendarIcon,
  UserIcon,
  TagIcon,
  ClockIcon,
  Copy,
  Check,
  ExternalLink,
} from 'lucide-react';
import {
  markdownToHtml,
  ParsedMarkdown,
  extractTableOfContents,
  extractFrontMatter,
  highlightCode,
  detectFileType,
} from '@/lib/markdown-utils';

// Local interface definition to avoid server-side dependency
interface DocFrontmatter {
  title: string;
  description?: string;
  version?: string;
  category?: string;
  tags?: string[];
  author?: string;
  lastUpdated?: string;
  draft?: boolean;
  private?: boolean;
  weight?: number;
}

// Simple header extraction function
function extractDocHeaders(
  content: string
): Array<{ title: string; level: number; id: string }> {
  const headers = [];
  const lines = content.split('\n');

  for (const line of lines) {
    const match = line.match(/^(#{1,6})\s+(.+)$/);
    if (match) {
      const level = match[1].length;
      const title = match[2].trim();
      const id = title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      headers.push({ title, level, id });
    }
  }

  return headers;
}

// Import highlight.js styles
import 'highlight.js/styles/github-dark.css';

interface MarkdownRendererProps {
  content: string;
  frontmatter?: DocFrontmatter | Record<string, unknown>;
  showMetadata?: boolean;
  showTableOfContents?: boolean;
  enableSyntaxHighlighting?: boolean;
  enableMath?: boolean;
  enableMermaid?: boolean;
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
  enableSyntaxHighlighting = true,
  enableMath = false,
  enableMermaid = false,
  className = '',
}: MarkdownRendererProps) {
  const [htmlContent, setHtmlContent] = useState<string>('');
  const [processedFrontmatter, setProcessedFrontmatter] =
    useState<DocFrontmatter>({} as DocFrontmatter);
  const [toc, setToc] = useState<TocItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedSections, setCopiedSections] = useState<Set<string>>(new Set());
  const [activeTocId, setActiveTocId] = useState<string>('');

  // Enhanced HTML content processing
  const enhanceHtmlContent = useMemo(() => {
    return (html: string, enableHighlighting: boolean): string => {
      if (!enableHighlighting) return html;

      // Add copy buttons to pre elements via DOM manipulation class
      let processedHtml = html;

      // Add IDs to headings for anchor links
      processedHtml = processedHtml.replace(
        /<(h[1-6])([^>]*)>([^<]+)<\/h[1-6]>/gi,
        (match, tag, attrs, content) => {
          const id = content
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
          const hasId = attrs.includes('id=');
          const newAttrs = hasId ? attrs : `${attrs} id="${id}"`;
          return `<${tag}${newAttrs} class="group scroll-mt-20">${content}<a href="#${id}" class="anchor-link opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-primary ml-2" aria-label="Link to this section">#</a></${tag}>`;
        }
      );

      // Enhance code blocks
      processedHtml = processedHtml.replace(
        /<pre><code([^>]*)>([\s\S]*?)<\/code><\/pre>/gi,
        (match, attrs, code) => {
          const classMatch = attrs.match(/class="language-([^"]*)"/i);
          const language = classMatch ? classMatch[1] : 'text';
          const codeId = `code-${Math.random().toString(36).substr(2, 9)}`;

          return `
            <div class="relative group my-4 code-block" data-code="${encodeURIComponent(code.replace(/<[^>]*>/g, ''))}" data-id="${codeId}">
              <div class="flex items-center justify-between bg-muted/50 px-4 py-2 rounded-t-lg border-b">
                <span class="text-xs font-medium text-muted-foreground uppercase">${language}</span>
                <button class="copy-btn opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-primary" data-copy-id="${codeId}">
                  <svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
                  </svg>
                </button>
              </div>
              <pre class="bg-muted p-4 rounded-b-lg overflow-x-auto text-sm border-t-0"><code${attrs}>${code}</code></pre>
            </div>
          `;
        }
      );

      return processedHtml;
    };
  }, []);

  // Enhanced markdown processing
  useEffect(() => {
    const renderContent = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // Extract frontmatter from content if not provided
        let processedContent = content;
        let extractedFrontmatter = frontmatter;

        if (!frontmatter || Object.keys(frontmatter).length === 0) {
          const { data: metadata, content: contentWithoutFrontmatter } =
            extractFrontMatter(content);
          extractedFrontmatter = metadata;
          processedContent = contentWithoutFrontmatter;
        }

        setProcessedFrontmatter(extractedFrontmatter as DocFrontmatter);

        // Generate table of contents
        if (showTableOfContents) {
          const sections = extractDocHeaders(processedContent);
          const tocItems = sections.map(section => ({
            level: section.level,
            title: section.title,
            id: section.id,
          }));
          setToc(tocItems);
        }

        // Convert markdown to HTML with enhanced processing
        let html = await markdownToHtml(processedContent);

        // Post-process HTML for better presentation
        html = enhanceHtmlContent(html, enableSyntaxHighlighting);

        setHtmlContent(html);
      } catch (err) {
        console.error('Markdown rendering error:', err);
        setError(
          err instanceof Error ? err.message : 'Failed to render content'
        );
      } finally {
        setIsLoading(false);
      }
    };

    if (content) {
      renderContent();
    }
  }, [
    content,
    frontmatter,
    showTableOfContents,
    enableSyntaxHighlighting,
    enableMath,
    enableMermaid,
    enhanceHtmlContent,
  ]);

  // Track active TOC section
  useEffect(() => {
    if (!showTableOfContents || toc.length === 0) return;

    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            setActiveTocId(entry.target.id);
          }
        });
      },
      {
        rootMargin: '-20% 0% -35% 0%',
        threshold: 0,
      }
    );

    toc.forEach(item => {
      const element = document.getElementById(item.id);
      if (element) {
        observer.observe(element);
      }
    });

    return () => observer.disconnect();
  }, [toc, showTableOfContents]);

  // Utility functions
  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
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

  const copyToClipboard = async (text: string, sectionId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedSections(prev => new Set([...prev, sectionId]));
      setTimeout(() => {
        setCopiedSections(prev => {
          const newSet = new Set(prev);
          newSet.delete(sectionId);
          return newSet;
        });
      }, 2000);
    } catch (err) {
      console.error('Failed to copy text:', err);
    }
  };

  if (isLoading) {
    return (
      <div className={`animate-pulse space-y-4 ${className}`}>
        <div className='h-4 bg-muted rounded w-3/4'></div>
        <div className='h-4 bg-muted rounded w-1/2'></div>
        <div className='h-4 bg-muted rounded w-5/6'></div>
      </div>
    );
  }

  if (error) {
    return (
      <Card className={`p-6 border-destructive ${className}`}>
        <div className='text-destructive'>
          <h3 className='font-semibold mb-2'>Failed to render markdown</h3>
          <p className='text-sm'>{error}</p>
        </div>
      </Card>
    );
  }

  return (
    <div className={`markdown-renderer ${className}`}>
      {/* Metadata Section */}
      {showMetadata && Object.keys(processedFrontmatter).length > 0 && (
        <Card className='mb-6 p-6 bg-muted/50'>
          <div className='space-y-4'>
            {processedFrontmatter.title && (
              <h1 className='text-3xl font-bold text-foreground'>
                {processedFrontmatter.title}
              </h1>
            )}

            {processedFrontmatter.description && (
              <p className='text-lg text-muted-foreground'>
                {processedFrontmatter.description}
              </p>
            )}

            <div className='flex flex-wrap gap-4 text-sm text-muted-foreground'>
              {'author' in processedFrontmatter &&
                processedFrontmatter.author && (
                  <div className='flex items-center gap-1'>
                    <UserIcon className='h-4 w-4' />
                    <span>{processedFrontmatter.author}</span>
                  </div>
                )}

              {(processedFrontmatter as any).date && (
                <div className='flex items-center gap-1'>
                  <CalendarIcon className='h-4 w-4' />
                  <span>
                    {formatDate((processedFrontmatter as any).date as string)}
                  </span>
                </div>
              )}

              <div className='flex items-center gap-1'>
                <ClockIcon className='h-4 w-4' />
                <span>{estimateReadingTime(content)} min read</span>
              </div>
            </div>

            {processedFrontmatter.tags &&
              processedFrontmatter.tags.length > 0 && (
                <div className='flex flex-wrap gap-2'>
                  <TagIcon className='h-4 w-4 text-muted-foreground mt-1' />
                  {processedFrontmatter.tags.map((tag, index) => (
                    <Badge key={index} variant='secondary' className='text-xs'>
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}
          </div>
        </Card>
      )}

      <div className='flex gap-6'>
        {/* Enhanced Table of Contents */}
        {showTableOfContents && toc.length > 0 && (
          <aside className='hidden lg:block w-64 shrink-0'>
            <Card className='p-4 sticky top-4 max-h-[calc(100vh-2rem)] overflow-y-auto'>
              <h3 className='font-semibold mb-3 text-sm uppercase tracking-wide text-muted-foreground'>
                Table of Contents
              </h3>
              <nav className='space-y-1'>
                {toc.map((item, index) => {
                  const isActive = activeTocId === item.id;
                  return (
                    <a
                      key={index}
                      href={`#${item.id}`}
                      className={`
                        block text-sm transition-all duration-200 py-1 px-2 rounded
                        ${
                          isActive
                            ? 'text-primary bg-primary/10 font-medium border-l-2 border-primary'
                            : 'hover:text-primary hover:bg-muted'
                        }
                        ${item.level === 1 ? 'font-medium' : ''}
                        ${item.level === 2 ? 'ml-3 text-muted-foreground' : ''}
                        ${item.level === 3 ? 'ml-6 text-muted-foreground' : ''}
                        ${item.level >= 4 ? 'ml-9 text-muted-foreground' : ''}
                      `}
                      onClick={e => {
                        e.preventDefault();
                        const element = document.getElementById(item.id);
                        element?.scrollIntoView({
                          behavior: 'smooth',
                          block: 'start',
                        });
                      }}
                    >
                      {item.title}
                    </a>
                  );
                })}
              </nav>
            </Card>
          </aside>
        )}

        {/* Enhanced Main Content */}
        <div className='flex-1 min-w-0'>
          <Card className='p-6'>
            <div
              className='markdown-content prose prose-neutral dark:prose-invert max-w-none
                prose-headings:scroll-mt-20
                prose-p:leading-relaxed
                prose-a:text-primary prose-a:underline-offset-4
                prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-code:font-mono
                prose-pre:!bg-transparent prose-pre:!p-0 prose-pre:!m-0
                prose-blockquote:border-l-4 prose-blockquote:border-primary prose-blockquote:pl-4 prose-blockquote:bg-muted/30 prose-blockquote:py-2
                prose-ul:mb-4 prose-ol:mb-4 prose-li:mb-1
                prose-table:w-full prose-table:border-collapse prose-table:my-6
                prose-th:border prose-th:border-border prose-th:bg-muted prose-th:p-3 prose-th:text-left prose-th:font-semibold
                prose-td:border prose-td:border-border prose-td:p-3
                prose-img:rounded-lg prose-img:shadow-lg prose-img:my-6
                prose-hr:border-border prose-hr:my-8'
            >
              {/* Render processed HTML content */}
              <MarkdownContent
                htmlContent={htmlContent}
                copiedSections={copiedSections}
                onCopy={copyToClipboard}
              />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

// Separate component to handle the HTML content with interactive features
const MarkdownContent: React.FC<{
  htmlContent: string;
  copiedSections: Set<string>;
  onCopy: (text: string, sectionId: string) => void;
}> = ({ htmlContent, copiedSections, onCopy }) => {
  useEffect(() => {
    // Add click handlers for copy buttons after content is rendered
    const handleCopyClick = (event: Event) => {
      const target = event.target as HTMLElement;
      const copyBtn = target.closest('.copy-btn');
      if (copyBtn) {
        const codeBlock = copyBtn.closest('.code-block');
        if (codeBlock) {
          const codeData = codeBlock.getAttribute('data-code');
          const codeId = codeBlock.getAttribute('data-id');
          if (codeData && codeId) {
            const decodedCode = decodeURIComponent(codeData);
            onCopy(decodedCode, codeId);

            // Visual feedback
            const icon = copyBtn.querySelector('svg');
            if (icon) {
              icon.innerHTML = `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>`;
              setTimeout(() => {
                icon.innerHTML = `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path>`;
              }, 2000);
            }
          }
        }
      }
    };

    // Add scroll behavior for anchor links
    const handleAnchorClick = (event: Event) => {
      const target = event.target as HTMLElement;
      const anchorLink = target.closest('.anchor-link');
      if (anchorLink) {
        event.preventDefault();
        const href = anchorLink.getAttribute('href');
        if (href && href.startsWith('#')) {
          const elementId = href.substring(1);
          const element = document.getElementById(elementId);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'start' });
            window.history.pushState(null, '', href);
          }
        }
      }
    };

    document.addEventListener('click', handleCopyClick);
    document.addEventListener('click', handleAnchorClick);

    return () => {
      document.removeEventListener('click', handleCopyClick);
      document.removeEventListener('click', handleAnchorClick);
    };
  }, [htmlContent, onCopy]);

  return <div dangerouslySetInnerHTML={{ __html: htmlContent }} />;
};

export default MarkdownRenderer;
