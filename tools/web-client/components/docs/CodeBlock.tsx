'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Copy, Check, Play, Terminal } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CodeBlockProps {
  children: string;
  language?: string;
  filename?: string;
  showLineNumbers?: boolean;
  className?: string;
  copyable?: boolean;
  executable?: boolean;
}

export function CodeBlock({
  children,
  language = 'text',
  filename,
  showLineNumbers = false,
  className = '',
  copyable = true,
  executable = false
}: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(children);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy code:', err);
    }
  };

  const handleExecute = async () => {
    // This would integrate with a code execution service
    // For demo purposes, we'll just simulate execution
    setIsExecuting(true);
    setTimeout(() => setIsExecuting(false), 2000);
  };

  const getLanguageColor = (lang: string) => {
    const colors = {
      javascript: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
      typescript: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      bash: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      json: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
      css: 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200',
      html: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
      python: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
      sql: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
    };
    return colors[lang as keyof typeof colors] || 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
  };

  const lines = children.split('\n');

  return (
    <div className={cn('relative group', className)}>
      {/* Header */}
      {(filename || language || copyable || executable) && (
        <div className="flex items-center justify-between px-4 py-2 bg-muted border border-b-0 rounded-t-lg">
          <div className="flex items-center gap-2">
            {filename && (
              <span className="text-sm font-mono text-muted-foreground">
                {filename}
              </span>
            )}
            {language && (
              <Badge variant="secondary" className={cn('text-xs', getLanguageColor(language))}>
                {language}
              </Badge>
            )}
          </div>
          
          <div className="flex items-center gap-1">
            {executable && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleExecute}
                disabled={isExecuting}
                className="h-8 w-8 p-0"
                title="Execute code"
              >
                {isExecuting ? (
                  <div className="animate-spin h-3 w-3 border-2 border-current border-t-transparent rounded-full" />
                ) : language === 'bash' ? (
                  <Terminal className="h-3 w-3" />
                ) : (
                  <Play className="h-3 w-3" />
                )}
              </Button>
            )}
            
            {copyable && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopy}
                className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                title={copied ? 'Copied!' : 'Copy code'}
              >
                {copied ? (
                  <Check className="h-3 w-3 text-green-500" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Code Content */}
      <div className={cn(
        'relative overflow-x-auto',
        filename || language || copyable || executable 
          ? 'rounded-b-lg border border-t-0' 
          : 'rounded-lg border'
      )}>
        <pre className="bg-muted p-4 text-sm">
          <code className="block">
            {showLineNumbers ? (
              <div className="table w-full">
                {lines.map((line, index) => (
                  <div key={index} className="table-row">
                    <div className="table-cell pr-4 text-muted-foreground text-right select-none w-8">
                      {index + 1}
                    </div>
                    <div className="table-cell">
                      {line || '\u00A0' /* Non-breaking space for empty lines */}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              children
            )}
          </code>
        </pre>
      </div>

      {/* Execution Result */}
      {isExecuting && (
        <div className="mt-2 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
          <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-300">
            <Terminal className="h-4 w-4" />
            <span>Executing...</span>
          </div>
        </div>
      )}
    </div>
  );
}

// Enhanced markdown code block component that integrates with our markdown renderer
export function MarkdownCodeBlock({ 
  children, 
  className, 
  ..._ 
}: { 
  children: string; 
  className?: string; 
  [key: string]: unknown; 
}) {
  // Extract language from className (e.g., "language-javascript" -> "javascript")
  const language = className?.replace('language-', '') || 'text';
  
  // Detect if this is a bash/shell command
  const isBashCommand = ['bash', 'sh', 'shell', 'zsh', 'fish'].includes(language);
  
  return (
    <CodeBlock
      language={language}
      executable={isBashCommand}
      showLineNumbers={children.split('\n').length > 10}
      className="my-4"
    >
      {children}
    </CodeBlock>
  );
}

export default CodeBlock;