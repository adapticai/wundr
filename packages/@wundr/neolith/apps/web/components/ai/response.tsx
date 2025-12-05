'use client';

import { Copy, Check } from 'lucide-react';
import { useTheme } from 'next-themes';
import * as React from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import {
  oneDark,
  oneLight,
} from 'react-syntax-highlighter/dist/cjs/styles/prism';
import remarkGfm from 'remark-gfm';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import type { Components } from 'react-markdown';

interface ResponseProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: string;
  isStreaming?: boolean;
  showCursor?: boolean;
}

/**
 * Auto-complete incomplete markdown during streaming
 * Handles unclosed bold, italic, code blocks, and hides incomplete links
 */
function parseIncompleteMarkdown(text: string): string {
  if (!text) {
    return '';
  }

  let result = text;

  // Auto-close bold
  const boldMatches = result.match(/\*\*/g) || [];
  if (boldMatches.length % 2 !== 0) {
    result += '**';
  }

  // Auto-close italic
  const italicMatches = result.match(/(?<!\*)\*(?!\*)/g) || [];
  if (italicMatches.length % 2 !== 0) {
    result += '*';
  }

  // Auto-close inline code
  const codeMatches = result.match(/`(?!``)/g) || [];
  if (codeMatches.length % 2 !== 0) {
    result += '`';
  }

  // Hide incomplete links
  result = result.replace(/\[([^\]]*$)/g, '');

  return result;
}

/**
 * AI Response Renderer with Markdown Streaming Support
 * Optimized for streaming text with auto-completion of incomplete formatting
 * Includes syntax-highlighted code blocks and rich markdown support
 */
export function Response({
  children,
  isStreaming = false,
  showCursor = true,
  className,
  ...props
}: ResponseProps) {
  const content =
    typeof children === 'string'
      ? isStreaming
        ? parseIncompleteMarkdown(children)
        : children
      : '';

  return (
    <div
      className={cn(
        'prose prose-sm dark:prose-invert max-w-none',
        'prose-headings:font-semibold prose-headings:tracking-tight',
        'prose-p:leading-7 prose-p:text-muted-foreground',
        'prose-a:text-primary prose-a:no-underline hover:prose-a:underline',
        'prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-code:font-mono',
        'prose-pre:bg-transparent prose-pre:p-0',
        'prose-blockquote:border-l-primary prose-blockquote:text-muted-foreground',
        'prose-table:border prose-th:bg-muted prose-th:px-3 prose-th:py-2',
        'prose-td:px-3 prose-td:py-2 prose-td:border',
        className
      )}
      {...props}
    >
      {content ? (
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={
            {
              code({ className, children, ...props }) {
                const match = /language-(\w+)/.exec(className || '');
                const language = match ? match[1] : '';
                const isCodeBlock = !!language;

                if (isCodeBlock) {
                  return (
                    <CodeBlock language={language}>
                      {String(children).replace(/\n$/, '')}
                    </CodeBlock>
                  );
                }

                return (
                  <code className={className} {...props}>
                    {children}
                  </code>
                );
              },
              pre({ children }) {
                return <>{children}</>;
              },
              a({ href, children }) {
                return (
                  <a href={href} target='_blank' rel='noopener noreferrer'>
                    {children}
                  </a>
                );
              },
              h1({ children }) {
                return (
                  <h1 className='text-2xl font-bold tracking-tight mt-6 mb-4'>
                    {children}
                  </h1>
                );
              },
              h2({ children }) {
                return (
                  <h2 className='text-xl font-semibold tracking-tight mt-5 mb-3'>
                    {children}
                  </h2>
                );
              },
              h3({ children }) {
                return (
                  <h3 className='text-lg font-semibold tracking-tight mt-4 mb-2'>
                    {children}
                  </h3>
                );
              },
              ul({ children }) {
                return (
                  <ul className='list-disc pl-6 my-4 space-y-2'>{children}</ul>
                );
              },
              ol({ children }) {
                return (
                  <ol className='list-decimal pl-6 my-4 space-y-2'>
                    {children}
                  </ol>
                );
              },
              blockquote({ children }) {
                return (
                  <blockquote className='border-l-4 border-primary pl-4 italic my-4'>
                    {children}
                  </blockquote>
                );
              },
              table({ children }) {
                return (
                  <div className='overflow-x-auto my-4'>
                    <table className='min-w-full divide-y divide-border rounded-lg'>
                      {children}
                    </table>
                  </div>
                );
              },
            } as Components
          }
        >
          {content}
        </ReactMarkdown>
      ) : (
        children
      )}
      {isStreaming && showCursor && (
        <span className='inline-block w-1 h-4 bg-current animate-pulse ml-0.5' />
      )}
    </div>
  );
}

interface CodeBlockProps {
  language: string;
  children: string;
}

/**
 * Code block with copy button and theme-aware syntax highlighting
 */
function CodeBlock({ language, children }: CodeBlockProps) {
  const [copied, setCopied] = React.useState(false);
  const { theme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  // Prevent hydration mismatch by only rendering theme-dependent content after mount
  React.useEffect(() => {
    setMounted(true);
  }, []);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(children);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Use resolvedTheme or theme to determine the current theme
  const currentTheme: string = mounted
    ? (resolvedTheme ?? theme ?? 'light')
    : 'light';
  const syntaxStyle = currentTheme === 'dark' ? oneDark : oneLight;

  return (
    <div className='relative group rounded-lg overflow-hidden border border-border my-4'>
      <div className='flex items-center justify-between bg-muted/50 px-4 py-2 border-b border-border'>
        <span className='text-xs font-mono text-muted-foreground uppercase'>
          {language}
        </span>
        <Button
          variant='ghost'
          size='sm'
          className='h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity'
          onClick={handleCopy}
          aria-label={copied ? 'Copied!' : 'Copy code'}
        >
          {copied ? (
            <Check className='h-3 w-3 text-green-500' />
          ) : (
            <Copy className='h-3 w-3' />
          )}
        </Button>
      </div>
      {mounted ? (
        <SyntaxHighlighter
          language={language}
          style={syntaxStyle}
          customStyle={{
            margin: 0,
            borderRadius: 0,
            fontSize: '0.875rem',
            background: 'transparent',
          }}
          showLineNumbers
          wrapLines
          lineNumberStyle={{
            minWidth: '2.5em',
            paddingRight: '1em',
            color: currentTheme === 'dark' ? '#6B7280' : '#9CA3AF',
            userSelect: 'none',
          }}
        >
          {children}
        </SyntaxHighlighter>
      ) : (
        <div className='p-4 font-mono text-sm'>
          <pre>{children}</pre>
        </div>
      )}
    </div>
  );
}

interface ResponseSectionProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
}

export function ResponseSection({
  title,
  children,
  className,
  ...props
}: ResponseSectionProps) {
  return (
    <div className={cn('space-y-2', className)} {...props}>
      {title && (
        <h3 className='text-sm font-semibold text-foreground'>{title}</h3>
      )}
      <div className='text-sm text-muted-foreground'>{children}</div>
    </div>
  );
}

interface ResponseCodeProps extends React.HTMLAttributes<HTMLDivElement> {
  language?: string;
}

export function ResponseCode({
  language,
  children,
  className,
  ...props
}: ResponseCodeProps) {
  return (
    <div
      className={cn('relative rounded-lg border bg-muted/50', className)}
      {...props}
    >
      {language && (
        <div className='px-3 py-1 text-xs text-muted-foreground border-b'>
          {language}
        </div>
      )}
      <pre className='p-3 overflow-x-auto'>
        <code>{children}</code>
      </pre>
    </div>
  );
}

interface ResponseListProps {
  items: React.ReactNode[];
  ordered?: boolean;
  className?: string;
}

export function ResponseList({
  items,
  ordered = false,
  className,
}: ResponseListProps) {
  const Component = ordered ? 'ol' : 'ul';

  return (
    <Component
      className={cn(
        ordered ? 'list-decimal' : 'list-disc',
        'list-inside space-y-1 text-sm',
        className
      )}
    >
      {items.map((item, index) => (
        <li key={index}>{item}</li>
      ))}
    </Component>
  );
}
