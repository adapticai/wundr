'use client';

import { Check, Copy, Download } from 'lucide-react';
import React, { useState } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import {
  oneDark,
  oneLight,
} from 'react-syntax-highlighter/dist/esm/styles/prism';
import { useTheme } from 'next-themes';

import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export interface CodeBlockProps {
  code: string;
  language?: string;
  showLineNumbers?: boolean;
  highlightLines?: number[];
  fileName?: string;
  className?: string;
  maxHeight?: string;
  enableCopy?: boolean;
  enableDownload?: boolean;
}

export function CodeBlock({
  code,
  language = 'text',
  showLineNumbers = true,
  highlightLines = [],
  fileName,
  className,
  maxHeight = '500px',
  enableCopy = true,
  enableDownload = false,
}: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const { theme } = useTheme();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy code:', err);
    }
  };

  const handleDownload = () => {
    const extension = getFileExtension(language);
    const blob = new Blob([code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName || `code.${extension}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getFileExtension = (lang: string): string => {
    const extensionMap: Record<string, string> = {
      javascript: 'js',
      typescript: 'ts',
      jsx: 'jsx',
      tsx: 'tsx',
      python: 'py',
      java: 'java',
      csharp: 'cs',
      cpp: 'cpp',
      c: 'c',
      go: 'go',
      rust: 'rs',
      ruby: 'rb',
      php: 'php',
      swift: 'swift',
      kotlin: 'kt',
      scala: 'scala',
      html: 'html',
      css: 'css',
      scss: 'scss',
      json: 'json',
      yaml: 'yaml',
      markdown: 'md',
      bash: 'sh',
      shell: 'sh',
      sql: 'sql',
      graphql: 'graphql',
    };
    return extensionMap[lang.toLowerCase()] || 'txt';
  };

  const getLanguageDisplay = (lang: string): string => {
    const displayMap: Record<string, string> = {
      javascript: 'JavaScript',
      typescript: 'TypeScript',
      jsx: 'JSX',
      tsx: 'TSX',
      python: 'Python',
      java: 'Java',
      csharp: 'C#',
      cpp: 'C++',
      c: 'C',
      go: 'Go',
      rust: 'Rust',
      ruby: 'Ruby',
      php: 'PHP',
      swift: 'Swift',
      kotlin: 'Kotlin',
      scala: 'Scala',
      html: 'HTML',
      css: 'CSS',
      scss: 'SCSS',
      json: 'JSON',
      yaml: 'YAML',
      markdown: 'Markdown',
      bash: 'Bash',
      shell: 'Shell',
      sql: 'SQL',
      graphql: 'GraphQL',
    };
    return displayMap[lang.toLowerCase()] || lang.toUpperCase();
  };

  const isDark = theme === 'dark';
  const syntaxTheme = isDark ? oneDark : oneLight;

  return (
    <div
      className={cn(
        'relative rounded-lg border border-border overflow-hidden',
        className
      )}
    >
      {/* Header */}
      <div className='flex items-center justify-between bg-muted px-4 py-2 border-b border-border'>
        <div className='flex items-center gap-2'>
          <span className='text-xs font-medium text-muted-foreground'>
            {fileName || getLanguageDisplay(language)}
          </span>
          {fileName && (
            <span className='text-xs text-muted-foreground/60'>
              ({getLanguageDisplay(language)})
            </span>
          )}
        </div>
        <div className='flex items-center gap-1'>
          {enableDownload && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant='ghost'
                    size='sm'
                    onClick={handleDownload}
                    className='h-7 px-2'
                  >
                    <Download className='h-3.5 w-3.5' />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Download code</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          {enableCopy && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant='ghost'
                    size='sm'
                    onClick={handleCopy}
                    className='h-7 px-2'
                  >
                    {copied ? (
                      <Check className='h-3.5 w-3.5 text-green-500' />
                    ) : (
                      <Copy className='h-3.5 w-3.5' />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {copied ? 'Copied!' : 'Copy code'}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </div>

      {/* Code */}
      <div className='overflow-auto' style={{ maxHeight }}>
        <SyntaxHighlighter
          language={language}
          style={syntaxTheme}
          showLineNumbers={showLineNumbers}
          wrapLines={true}
          lineProps={lineNumber => {
            const isHighlighted = highlightLines.includes(lineNumber);
            return {
              style: {
                backgroundColor: isHighlighted
                  ? isDark
                    ? 'rgba(255, 255, 255, 0.1)'
                    : 'rgba(0, 0, 0, 0.05)'
                  : 'transparent',
                display: 'block',
                width: '100%',
              },
            };
          }}
          customStyle={{
            margin: 0,
            padding: '1rem',
            fontSize: '0.875rem',
            lineHeight: '1.5',
            background: 'transparent',
          }}
          codeTagProps={{
            style: {
              fontFamily:
                'ui-monospace, SFMono-Regular, SF Mono, Menlo, Consolas, Liberation Mono, monospace',
            },
          }}
        >
          {code}
        </SyntaxHighlighter>
      </div>
    </div>
  );
}

export default CodeBlock;
