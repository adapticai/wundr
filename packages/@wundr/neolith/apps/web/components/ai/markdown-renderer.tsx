'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';
import type { Components } from 'react-markdown';
import rehypeKatex from 'rehype-katex';
import remarkGfm from 'remark-gfm';
import 'katex/dist/katex.min.css';

import { cn } from '@/lib/utils';

import { CodeBlock } from './code-block';

export interface MarkdownRendererProps {
  content: string;
  className?: string;
  enableLatex?: boolean;
  enableGfm?: boolean;
  components?: Partial<Components>;
}

export function MarkdownRenderer({
  content,
  className,
  enableLatex = true,
  enableGfm = true,
  components: customComponents,
}: MarkdownRendererProps) {
  const rehypePlugins = enableLatex ? [rehypeKatex] : [];
  const remarkPlugins = enableGfm ? [remarkGfm] : [];

  const components: Components = {
    // Code blocks with syntax highlighting
    code: ({ node, className: codeClassName, children, ...props }) => {
      const inline = !('inline' in props) || props.inline !== false;
      const match = /language-(\w+)/.exec(codeClassName || '');
      const language = match ? match[1] : '';
      const code = String(children).replace(/\n$/, '');

      if (!inline && language) {
        return (
          <CodeBlock
            code={code}
            language={language}
            showLineNumbers={code.split('\n').length > 3}
            className='my-4'
          />
        );
      }

      return (
        <code
          className={cn(
            'relative rounded bg-muted px-[0.3rem] py-[0.2rem] font-mono text-sm',
            codeClassName
          )}
          {...props}
        >
          {children}
        </code>
      );
    },

    // Links with proper handling
    a: ({ node, href, children, ...props }) => {
      const isExternal = href?.startsWith('http');
      const isAnchor = href?.startsWith('#');

      return (
        <a
          href={href}
          className={cn(
            'font-medium underline underline-offset-4 hover:text-primary transition-colors',
            isExternal && 'text-blue-600 dark:text-blue-400'
          )}
          target={isExternal ? '_blank' : undefined}
          rel={isExternal ? 'noopener noreferrer' : undefined}
          {...props}
        >
          {children}
          {isExternal && (
            <svg
              className='inline-block w-3 h-3 ml-1'
              fill='none'
              stroke='currentColor'
              viewBox='0 0 24 24'
            >
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth={2}
                d='M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14'
              />
            </svg>
          )}
        </a>
      );
    },

    // Images with proper rendering
    img: ({ node, src, alt, ...props }) => {
      return (
        <span className='block my-4'>
          <img
            src={src}
            alt={alt || ''}
            className='rounded-lg max-w-full h-auto'
            loading='lazy'
            {...props}
          />
          {alt && (
            <span className='block text-sm text-muted-foreground text-center mt-2'>
              {alt}
            </span>
          )}
        </span>
      );
    },

    // Tables
    table: ({ node, children, ...props }) => (
      <div className='my-4 overflow-x-auto'>
        <table
          className='w-full border-collapse border border-border rounded-lg'
          {...props}
        >
          {children}
        </table>
      </div>
    ),
    thead: ({ node, children, ...props }) => (
      <thead className='bg-muted' {...props}>
        {children}
      </thead>
    ),
    th: ({ node, children, ...props }) => (
      <th
        className='border border-border px-4 py-2 text-left font-semibold'
        {...props}
      >
        {children}
      </th>
    ),
    td: ({ node, children, ...props }) => (
      <td className='border border-border px-4 py-2' {...props}>
        {children}
      </td>
    ),

    // Lists
    ul: ({ node, children, ...props }) => (
      <ul className='list-disc list-inside space-y-2 my-4' {...props}>
        {children}
      </ul>
    ),
    ol: ({ node, children, ...props }) => (
      <ol className='list-decimal list-inside space-y-2 my-4' {...props}>
        {children}
      </ol>
    ),
    li: ({ node, children, ...props }) => (
      <li className='ml-4' {...props}>
        {children}
      </li>
    ),

    // Headings
    h1: ({ node, children, ...props }) => (
      <h1 className='text-3xl font-bold tracking-tight mt-6 mb-4' {...props}>
        {children}
      </h1>
    ),
    h2: ({ node, children, ...props }) => (
      <h2
        className='text-2xl font-semibold tracking-tight mt-5 mb-3'
        {...props}
      >
        {children}
      </h2>
    ),
    h3: ({ node, children, ...props }) => (
      <h3 className='text-xl font-semibold tracking-tight mt-4 mb-2' {...props}>
        {children}
      </h3>
    ),
    h4: ({ node, children, ...props }) => (
      <h4 className='text-lg font-semibold mt-3 mb-2' {...props}>
        {children}
      </h4>
    ),

    // Blockquote
    blockquote: ({ node, children, ...props }) => (
      <blockquote
        className='border-l-4 border-primary pl-4 italic my-4 text-muted-foreground'
        {...props}
      >
        {children}
      </blockquote>
    ),

    // Horizontal rule
    hr: ({ node, ...props }) => (
      <hr className='my-6 border-border' {...props} />
    ),

    // Paragraphs
    p: ({ node, children, ...props }) => (
      <p className='mb-4 last:mb-0 leading-7' {...props}>
        {children}
      </p>
    ),

    // Strong/bold
    strong: ({ node, children, ...props }) => (
      <strong className='font-semibold' {...props}>
        {children}
      </strong>
    ),

    // Emphasis/italic
    em: ({ node, children, ...props }) => (
      <em className='italic' {...props}>
        {children}
      </em>
    ),

    // Task lists (from GFM)
    input: ({ node, type, checked, ...props }) => {
      if (type === 'checkbox') {
        return (
          <input
            type='checkbox'
            checked={checked}
            disabled
            className='mr-2 cursor-default'
            {...props}
          />
        );
      }
      return <input type={type} {...props} />;
    },

    // Merge custom components
    ...customComponents,
  };

  return (
    <div
      className={cn(
        'prose prose-sm dark:prose-invert max-w-none',
        'prose-headings:scroll-mt-20',
        'prose-code:before:content-none prose-code:after:content-none',
        'prose-pre:p-0 prose-pre:m-0 prose-pre:bg-transparent',
        className
      )}
    >
      <ReactMarkdown
        remarkPlugins={remarkPlugins}
        rehypePlugins={rehypePlugins}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

export default MarkdownRenderer;
