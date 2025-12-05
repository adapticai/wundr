/**
 * Message formatting utilities for AI messages
 */

export interface FormatMessageOptions {
  enableEmoji?: boolean;
  enableMentions?: boolean;
  enableLinks?: boolean;
  truncate?: number;
}

/**
 * Format a message with various transformations
 */
export function formatMessage(
  content: string,
  options: FormatMessageOptions = {}
): string {
  let formatted = content;

  if (options.enableLinks !== false) {
    formatted = linkify(formatted);
  }

  if (options.enableMentions) {
    formatted = mentionify(formatted);
  }

  if (options.truncate) {
    formatted = truncate(formatted, options.truncate);
  }

  return formatted;
}

/**
 * Convert URLs to markdown links
 */
export function linkify(text: string): string {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  return text.replace(urlRegex, url => {
    const cleanUrl = url.replace(/[.,;:!?)]$/, '');
    return `[${cleanUrl}](${cleanUrl})`;
  });
}

/**
 * Convert @mentions to markdown links
 */
export function mentionify(text: string): string {
  const mentionRegex = /@(\w+)/g;
  return text.replace(mentionRegex, '[@$1](#mention-$1)');
}

/**
 * Truncate text with ellipsis
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

/**
 * Extract code blocks from markdown
 */
export function extractCodeBlocks(markdown: string): Array<{
  language: string;
  code: string;
  index: number;
}> {
  const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
  const blocks: Array<{ language: string; code: string; index: number }> = [];
  let match;

  while ((match = codeBlockRegex.exec(markdown)) !== null) {
    blocks.push({
      language: match[1] || 'text',
      code: match[2].trim(),
      index: match.index,
    });
  }

  return blocks;
}

/**
 * Extract inline code from markdown
 */
export function extractInlineCode(markdown: string): string[] {
  const inlineCodeRegex = /`([^`]+)`/g;
  const codes: string[] = [];
  let match;

  while ((match = inlineCodeRegex.exec(markdown)) !== null) {
    codes.push(match[1]);
  }

  return codes;
}

/**
 * Strip markdown formatting
 */
export function stripMarkdown(markdown: string): string {
  let text = markdown;

  // Remove code blocks
  text = text.replace(/```[\s\S]*?```/g, '');

  // Remove inline code
  text = text.replace(/`([^`]+)`/g, '$1');

  // Remove images
  text = text.replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1');

  // Remove links
  text = text.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1');

  // Remove bold/italic
  text = text.replace(/(\*\*|__)(.*?)\1/g, '$2');
  text = text.replace(/(\*|_)(.*?)\1/g, '$2');

  // Remove headings
  text = text.replace(/^#{1,6}\s+/gm, '');

  // Remove blockquotes
  text = text.replace(/^>\s+/gm, '');

  // Remove horizontal rules
  text = text.replace(/^(-{3,}|\*{3,}|_{3,})$/gm, '');

  // Remove list markers
  text = text.replace(/^[\s]*[-*+]\s+/gm, '');
  text = text.replace(/^\d+\.\s+/gm, '');

  return text.trim();
}

/**
 * Count words in text
 */
export function countWords(text: string): number {
  return text.trim().split(/\s+/).length;
}

/**
 * Estimate reading time in minutes
 */
export function estimateReadingTime(text: string): number {
  const wordsPerMinute = 200;
  const words = countWords(text);
  return Math.ceil(words / wordsPerMinute);
}

/**
 * Extract citations from text
 */
export function extractCitations(text: string): Array<{
  text: string;
  source?: string;
  index: number;
}> {
  const citationRegex = /\[(\d+)\](?:\(([^)]+)\))?/g;
  const citations: Array<{ text: string; source?: string; index: number }> = [];
  let match;

  while ((match = citationRegex.exec(text)) !== null) {
    citations.push({
      text: match[1],
      source: match[2],
      index: match.index,
    });
  }

  return citations;
}

/**
 * Format citations
 */
export function formatCitation(number: number, source?: string): string {
  if (source) {
    return `[${number}](${source})`;
  }
  return `[${number}]`;
}

/**
 * Detect language from code content
 */
export function detectLanguage(code: string): string {
  // Simple heuristics for language detection
  if (code.includes('import React') || code.includes('useState')) {
    return 'typescript';
  }
  if (code.includes('def ') && code.includes(':')) {
    return 'python';
  }
  if (code.includes('function') || code.includes('const ')) {
    return 'javascript';
  }
  if (code.includes('public class') || code.includes('private ')) {
    return 'java';
  }
  if (code.includes('<?php')) {
    return 'php';
  }
  if (code.includes('#include') || code.includes('std::')) {
    return 'cpp';
  }
  if (code.includes('package main') || code.includes('func ')) {
    return 'go';
  }
  if (code.includes('fn ') && code.includes('->')) {
    return 'rust';
  }

  return 'text';
}

/**
 * Highlight search terms in text
 */
export function highlightSearchTerms(text: string, searchTerm: string): string {
  if (!searchTerm) return text;

  const regex = new RegExp(`(${escapeRegex(searchTerm)})`, 'gi');
  return text.replace(regex, '**$1**');
}

/**
 * Escape regex special characters
 */
export function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Parse LaTeX equations
 */
export function extractLatex(text: string): Array<{
  latex: string;
  inline: boolean;
  index: number;
}> {
  const equations: Array<{ latex: string; inline: boolean; index: number }> =
    [];

  // Block equations: $$ ... $$
  const blockRegex = /\$\$([\s\S]*?)\$\$/g;
  let match;
  while ((match = blockRegex.exec(text)) !== null) {
    equations.push({
      latex: match[1].trim(),
      inline: false,
      index: match.index,
    });
  }

  // Inline equations: $ ... $
  const inlineRegex = /\$([^\$]+)\$/g;
  while ((match = inlineRegex.exec(text)) !== null) {
    equations.push({
      latex: match[1].trim(),
      inline: true,
      index: match.index,
    });
  }

  return equations;
}

/**
 * Format timestamp
 */
export function formatTimestamp(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return d.toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}

/**
 * Generate message preview
 */
export function generatePreview(content: string, maxLength = 100): string {
  const stripped = stripMarkdown(content);
  return truncate(stripped, maxLength);
}

/**
 * Validate message content
 */
export function validateMessage(content: string): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!content || content.trim().length === 0) {
    errors.push('Message cannot be empty');
  }

  if (content.length > 32000) {
    errors.push('Message exceeds maximum length');
  }

  // Check for balanced code blocks
  const codeBlockCount = (content.match(/```/g) || []).length;
  if (codeBlockCount % 2 !== 0) {
    errors.push('Unbalanced code blocks');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export default {
  formatMessage,
  linkify,
  mentionify,
  truncate,
  extractCodeBlocks,
  extractInlineCode,
  stripMarkdown,
  countWords,
  estimateReadingTime,
  extractCitations,
  formatCitation,
  detectLanguage,
  highlightSearchTerms,
  extractLatex,
  formatTimestamp,
  generatePreview,
  validateMessage,
};
