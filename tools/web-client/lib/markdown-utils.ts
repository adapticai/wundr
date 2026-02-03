/**
 * Markdown Processing Utilities
 * Comprehensive markdown parsing, rendering, and manipulation tools
 */

export interface MarkdownNode {
  type:
    | 'heading'
    | 'paragraph'
    | 'list'
    | 'code'
    | 'blockquote'
    | 'table'
    | 'image'
    | 'link';
  level?: number;
  content: string;
  children?: MarkdownNode[];
  metadata?: Record<string, any>;
}

export interface MarkdownParseOptions {
  preserveWhitespace?: boolean;
  extractFrontmatter?: boolean;
  parseCodeBlocks?: boolean;
  parseTables?: boolean;
  customElements?: string[];
}

export interface MarkdownRenderOptions {
  sanitize?: boolean;
  allowHtml?: boolean;
  customRenderers?: Record<string, (node: MarkdownNode) => string>;
  theme?: 'github' | 'minimal' | 'professional';
  includeCSS?: boolean;
}

export interface FrontMatter {
  [key: string]: any;
}

export interface ParsedMarkdown {
  frontmatter: FrontMatter;
  content: string;
  ast: MarkdownNode[];
  metadata: {
    wordCount: number;
    readingTime: number;
    headings: Array<{ level: number; text: string; id: string }>;
  };
}

/**
 * Main Markdown Parser and Processor
 */
export class MarkdownProcessor {
  private options: MarkdownParseOptions;

  constructor(options: MarkdownParseOptions = {}) {
    this.options = {
      preserveWhitespace: false,
      extractFrontmatter: true,
      parseCodeBlocks: true,
      parseTables: true,
      customElements: [],
      ...options,
    };
  }

  /**
   * Parse markdown content into structured data
   */
  parse(markdown: string): ParsedMarkdown {
    let content = markdown;
    let frontmatter: FrontMatter = {};

    // Extract frontmatter if enabled
    if (this.options.extractFrontmatter) {
      const frontmatterResult = this.extractFrontmatter(content);
      frontmatter = frontmatterResult.frontmatter;
      content = frontmatterResult.content;
    }

    // Parse into AST
    const ast = this.parseToAST(content);

    // Generate metadata
    const metadata = this.generateMetadata(content, ast);

    return {
      frontmatter,
      content,
      ast,
      metadata,
    };
  }

  /**
   * Render parsed markdown to HTML
   */
  render(parsed: ParsedMarkdown, options: MarkdownRenderOptions = {}): string {
    const renderOptions = {
      sanitize: true,
      allowHtml: false,
      theme: 'github' as const,
      includeCSS: false,
      ...options,
    };

    let html = this.renderAST(parsed.ast, renderOptions);

    if (renderOptions.includeCSS) {
      html = this.wrapWithCSS(html, renderOptions.theme);
    }

    if (renderOptions.sanitize) {
      html = this.sanitizeHTML(html);
    }

    return html;
  }

  /**
   * Convert markdown directly to HTML (convenience method)
   */
  static toHTML(markdown: string, options: MarkdownRenderOptions = {}): string {
    const processor = new MarkdownProcessor();
    const parsed = processor.parse(markdown);
    return processor.render(parsed, options);
  }

  /**
   * Extract table of contents from markdown
   */
  static extractTOC(
    markdown: string
  ): Array<{ level: number; text: string; id: string }> {
    const processor = new MarkdownProcessor();
    const parsed = processor.parse(markdown);
    return parsed.metadata.headings;
  }

  /**
   * Extract frontmatter from markdown
   */
  private extractFrontmatter(content: string): {
    frontmatter: FrontMatter;
    content: string;
  } {
    const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/;
    const match = content.match(frontmatterRegex);

    if (!match) {
      return { frontmatter: {}, content };
    }

    try {
      const frontmatter = this.parseYAML(match[1]);
      return { frontmatter, content: match[2] };
    } catch (error) {
      console.warn('Failed to parse frontmatter:', error);
      return { frontmatter: {}, content };
    }
  }

  /**
   * Simple YAML parser for frontmatter
   */
  private parseYAML(yamlString: string): FrontMatter {
    const result: FrontMatter = {};
    const lines = yamlString.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      const colonIndex = trimmed.indexOf(':');
      if (colonIndex === -1) continue;

      const key = trimmed.substring(0, colonIndex).trim();
      let value = trimmed.substring(colonIndex + 1).trim();

      // Remove quotes
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      // Try to parse as number or boolean
      if (value === 'true') {
        result[key] = true;
      } else if (value === 'false') {
        result[key] = false;
      } else if (!isNaN(Number(value)) && value !== '') {
        result[key] = Number(value);
      } else {
        result[key] = value;
      }
    }

    return result;
  }

  /**
   * Parse markdown content to Abstract Syntax Tree
   */
  private parseToAST(content: string): MarkdownNode[] {
    const lines = content.split('\n');
    const nodes: MarkdownNode[] = [];
    let currentNode: MarkdownNode | null = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Skip empty lines unless preserveWhitespace is true
      if (!trimmed && !this.options.preserveWhitespace) {
        if (currentNode && currentNode.type === 'paragraph') {
          nodes.push(currentNode);
          currentNode = null;
        }
        continue;
      }

      // Headings
      const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
      if (headingMatch) {
        if (currentNode) {
          nodes.push(currentNode);
        }
        nodes.push({
          type: 'heading',
          level: headingMatch[1].length,
          content: headingMatch[2],
          metadata: { id: this.createHeadingId(headingMatch[2]) },
        });
        currentNode = null;
        continue;
      }

      // Code blocks
      if (trimmed.startsWith('```') && this.options.parseCodeBlocks) {
        if (currentNode) {
          nodes.push(currentNode);
          currentNode = null;
        }

        const language = trimmed.substring(3).trim();
        const codeLines: string[] = [];
        i++;

        while (i < lines.length && !lines[i].trim().startsWith('```')) {
          codeLines.push(lines[i]);
          i++;
        }

        nodes.push({
          type: 'code',
          content: codeLines.join('\n'),
          metadata: { language },
        });
        continue;
      }

      // Lists
      const listMatch = line.match(/^(\s*)([-*+]|\d+\.)\s+(.+)$/);
      if (listMatch) {
        if (currentNode && currentNode.type !== 'list') {
          nodes.push(currentNode);
          currentNode = null;
        }

        if (!currentNode || currentNode.type !== 'list') {
          currentNode = {
            type: 'list',
            content: '',
            children: [],
          };
        }

        currentNode.children!.push({
          type: 'paragraph',
          content: listMatch[3],
          metadata: { indent: listMatch[1].length },
        });
        continue;
      }

      // Tables
      if (trimmed.includes('|') && this.options.parseTables) {
        if (currentNode) {
          nodes.push(currentNode);
          currentNode = null;
        }

        const tableLines = [line];
        i++;

        // Collect table lines
        while (i < lines.length && lines[i].trim().includes('|')) {
          tableLines.push(lines[i]);
          i++;
        }
        i--; // Back up one line

        nodes.push({
          type: 'table',
          content: tableLines.join('\n'),
          metadata: { rows: tableLines.length },
        });
        continue;
      }

      // Blockquotes
      if (trimmed.startsWith('>')) {
        if (currentNode && currentNode.type !== 'blockquote') {
          nodes.push(currentNode);
          currentNode = null;
        }

        if (!currentNode || currentNode.type !== 'blockquote') {
          currentNode = {
            type: 'blockquote',
            content: '',
            children: [],
          };
        }

        currentNode.content += trimmed.substring(1).trim() + '\n';
        continue;
      }

      // Regular paragraphs
      if (!currentNode || currentNode.type !== 'paragraph') {
        if (currentNode) {
          nodes.push(currentNode);
        }
        currentNode = {
          type: 'paragraph',
          content: '',
        };
      }

      currentNode.content += (currentNode.content ? '\n' : '') + line;
    }

    if (currentNode) {
      nodes.push(currentNode);
    }

    return nodes;
  }

  /**
   * Render AST to HTML
   */
  private renderAST(
    nodes: MarkdownNode[],
    options: MarkdownRenderOptions
  ): string {
    return nodes.map(node => this.renderNode(node, options)).join('\n');
  }

  /**
   * Render individual node to HTML
   */
  private renderNode(
    node: MarkdownNode,
    options: MarkdownRenderOptions
  ): string {
    if (options.customRenderers?.[node.type]) {
      return options.customRenderers[node.type](node);
    }

    switch (node.type) {
      case 'heading':
        const id = node.metadata?.id || '';
        return `<h${node.level} id="${id}">${this.processInlineMarkdown(node.content)}</h${node.level}>`;

      case 'paragraph':
        return `<p>${this.processInlineMarkdown(node.content)}</p>`;

      case 'code':
        const language = node.metadata?.language || '';
        return `<pre><code class="language-${language}">${this.escapeHTML(node.content)}</code></pre>`;

      case 'blockquote':
        return `<blockquote>${this.processInlineMarkdown(node.content)}</blockquote>`;

      case 'list':
        const items =
          node.children
            ?.map(child => `<li>${this.renderNode(child, options)}</li>`)
            .join('\n') || '';
        return `<ul>\n${items}\n</ul>`;

      case 'table':
        return this.renderTable(node.content);

      default:
        return `<div>${this.escapeHTML(node.content)}</div>`;
    }
  }

  /**
   * Process inline markdown (bold, italic, links, etc.)
   */
  private processInlineMarkdown(content: string): string {
    let result = content;

    // Bold
    result = result.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    result = result.replace(/__(.*?)__/g, '<strong>$1</strong>');

    // Italic
    result = result.replace(/\*(.*?)\*/g, '<em>$1</em>');
    result = result.replace(/_(.*?)_/g, '<em>$1</em>');

    // Code
    result = result.replace(/`(.*?)`/g, '<code>$1</code>');

    // Links
    result = result.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

    // Images
    result = result.replace(
      /!\[([^\]]*)\]\(([^)]+)\)/g,
      '<img src="$2" alt="$1">'
    );

    return result;
  }

  /**
   * Render table markdown to HTML
   */
  private renderTable(content: string): string {
    const lines = content.split('\n').filter(line => line.trim());
    if (lines.length < 2) return '<table></table>';

    const headers = this.parseTableRow(lines[0]);
    const rows = lines.slice(2).map(line => this.parseTableRow(line)); // Skip separator line

    let html = '<table>\n<thead>\n<tr>\n';
    headers.forEach(header => {
      html += `<th>${this.processInlineMarkdown(header)}</th>\n`;
    });
    html += '</tr>\n</thead>\n<tbody>\n';

    rows.forEach(row => {
      html += '<tr>\n';
      row.forEach(cell => {
        html += `<td>${this.processInlineMarkdown(cell)}</td>\n`;
      });
      html += '</tr>\n';
    });

    html += '</tbody>\n</table>';
    return html;
  }

  /**
   * Parse table row into cells
   */
  private parseTableRow(row: string): string[] {
    return row
      .split('|')
      .map(cell => cell.trim())
      .filter((_, index, array) => index !== 0 && index !== array.length - 1); // Remove empty first/last
  }

  /**
   * Generate metadata from content
   */
  private generateMetadata(
    content: string,
    ast: MarkdownNode[]
  ): ParsedMarkdown['metadata'] {
    const words = content.split(/\s+/).length;
    const readingTime = Math.ceil(words / 200); // Average 200 WPM

    const headings = ast
      .filter(node => node.type === 'heading')
      .map(node => ({
        level: node.level!,
        text: node.content,
        id: node.metadata?.id || this.createHeadingId(node.content),
      }));

    return {
      wordCount: words,
      readingTime,
      headings,
    };
  }

  /**
   * Create URL-friendly ID from heading text
   */
  private createHeadingId(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  /**
   * Escape HTML characters
   */
  private escapeHTML(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Sanitize HTML content
   */
  private sanitizeHTML(html: string): string {
    // Simple sanitization - in production, use a proper library like DOMPurify
    return html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '');
  }

  /**
   * Wrap content with CSS
   */
  private wrapWithCSS(html: string, theme: string): string {
    const css = this.getThemeCSS(theme);
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>${css}</style>
</head>
<body class="markdown-body">
  ${html}
</body>
</html>
    `;
  }

  /**
   * Get CSS for theme
   */
  private getThemeCSS(theme: string): string {
    const baseCSS = `
      .markdown-body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
        font-size: 16px;
        line-height: 1.6;
        color: #24292f;
        max-width: 980px;
        margin: 0 auto;
        padding: 45px;
      }
      .markdown-body h1, .markdown-body h2, .markdown-body h3,
      .markdown-body h4, .markdown-body h5, .markdown-body h6 {
        margin-top: 24px;
        margin-bottom: 16px;
        font-weight: 600;
        line-height: 1.25;
      }
      .markdown-body p { margin-bottom: 16px; }
      .markdown-body code {
        background-color: rgba(175,184,193,0.2);
        padding: 0.2em 0.4em;
        border-radius: 6px;
        font-size: 85%;
      }
      .markdown-body pre {
        background-color: #f6f8fa;
        border-radius: 6px;
        padding: 16px;
        overflow: auto;
      }
      .markdown-body blockquote {
        border-left: 0.25em solid #d0d7de;
        color: #656d76;
        padding-left: 1em;
        margin-left: 0;
      }
      .markdown-body table {
        border-collapse: collapse;
        border-spacing: 0;
        width: 100%;
      }
      .markdown-body th, .markdown-body td {
        border: 1px solid #d0d7de;
        padding: 6px 13px;
      }
      .markdown-body th {
        background-color: #f6f8fa;
        font-weight: 600;
      }
    `;

    switch (theme) {
      case 'minimal':
        return (
          baseCSS +
          `
          .markdown-body { color: #333; }
          .markdown-body pre { background-color: #f5f5f5; }
        `
        );
      case 'professional':
        return (
          baseCSS +
          `
          .markdown-body { 
            font-family: 'Times New Roman', serif;
            color: #2c3e50;
          }
          .markdown-body h1, .markdown-body h2, .markdown-body h3 {
            color: #34495e;
          }
        `
        );
      default:
        return baseCSS;
    }
  }
}

/**
 * Utility functions for markdown processing
 */
export const MarkdownUtils = {
  /**
   * Convert HTML back to markdown (basic implementation)
   */
  htmlToMarkdown(html: string): string {
    return html
      .replace(
        /<h([1-6])[^>]*>(.*?)<\/h[1-6]>/g,
        (_, level, content) =>
          '#'.repeat(Number(level)) + ' ' + content.trim() + '\n\n'
      )
      .replace(/<p[^>]*>(.*?)<\/p>/g, '$1\n\n')
      .replace(/<strong[^>]*>(.*?)<\/strong>/g, '**$1**')
      .replace(/<em[^>]*>(.*?)<\/em>/g, '*$1*')
      .replace(/<code[^>]*>(.*?)<\/code>/g, '`$1`')
      .replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/g, '[$2]($1)')
      .replace(/<img[^>]*src="([^"]*)"[^>]*alt="([^"]*)"[^>]*>/g, '![$2]($1)')
      .replace(/<br\s*\/?>/g, '\n')
      .replace(/\n\n+/g, '\n\n')
      .trim();
  },

  /**
   * Extract all links from markdown
   */
  extractLinks(
    markdown: string
  ): Array<{ text: string; url: string; type: 'link' | 'image' }> {
    const links: Array<{ text: string; url: string; type: 'link' | 'image' }> =
      [];

    // Regular links
    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    let linkMatch;
    while ((linkMatch = linkRegex.exec(markdown)) !== null) {
      links.push({ text: linkMatch[1], url: linkMatch[2], type: 'link' });
    }

    // Images
    const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
    let imageMatch;
    while ((imageMatch = imageRegex.exec(markdown)) !== null) {
      links.push({ text: imageMatch[1], url: imageMatch[2], type: 'image' });
    }

    return links;
  },

  /**
   * Count words in markdown content
   */
  countWords(markdown: string): number {
    return markdown
      .replace(/[#*`_~\[\]()]/g, '') // Remove markdown characters
      .replace(/\s+/g, ' ') // Normalize whitespace
      .split(' ')
      .filter(word => word.length > 0).length;
  },

  /**
   * Estimate reading time
   */
  estimateReadingTime(markdown: string, wpm = 200): number {
    const wordCount = this.countWords(markdown);
    return Math.ceil(wordCount / wpm);
  },

  /**
   * Validate markdown syntax
   */
  validateSyntax(markdown: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check for unclosed code blocks
    const codeBlockMatches = markdown.match(/```/g);
    if (codeBlockMatches && codeBlockMatches.length % 2 !== 0) {
      errors.push('Unclosed code block detected');
    }

    // Check for malformed links
    const malformedLinks = markdown.match(/\[[^\]]*\]\([^)]*$/g);
    if (malformedLinks) {
      errors.push('Malformed link syntax detected');
    }

    // Check for malformed tables
    const tableLines = markdown.split('\n').filter(line => line.includes('|'));
    for (const line of tableLines) {
      if (line.trim().startsWith('|') !== line.trim().endsWith('|')) {
        errors.push('Malformed table syntax detected');
        break;
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  },
};

/**
 * Named exports for compatibility with server-utils.ts
 */

/**
 * Parse markdown content into structured data
 * @param markdown - The markdown content to parse
 * @returns Parsed markdown with frontmatter, content, AST, and metadata
 */
export function parseMarkdown(markdown: string): ParsedMarkdown {
  const processor = new MarkdownProcessor();
  return processor.parse(markdown);
}

/**
 * Extract frontmatter from markdown content
 * @param content - The markdown content with potential frontmatter
 * @returns Object with metadata (frontmatter) and content
 */
export function extractFrontMatter(content: string): {
  metadata: FrontMatter;
  content: string;
} {
  const processor = new MarkdownProcessor();
  const result = processor['extractFrontmatter'](content);
  return {
    metadata: result.frontmatter,
    content: result.content,
  };
}

/**
 * Convert markdown to HTML
 * @param markdown - The markdown content to convert
 * @param options - Optional rendering options
 * @returns HTML string
 */
export function markdownToHtml(
  markdown: string,
  options: MarkdownRenderOptions = {}
): Promise<string> {
  return Promise.resolve(MarkdownProcessor.toHTML(markdown, options));
}

/**
 * Extract table of contents from markdown
 * @param markdown - The markdown content to analyze
 * @returns Array of heading objects with level, text, and id
 */
export function extractTableOfContents(
  markdown: string
): Array<{ level: number; text: string; id: string }> {
  return MarkdownProcessor.extractTOC(markdown);
}

/**
 * Highlight code syntax (placeholder - requires highlight.js in client environment)
 * @param code - The code to highlight
 * @param language - The programming language
 * @returns Highlighted HTML string
 */
export function highlightCode(code: string, language?: string): string {
  // Basic fallback without highlight.js
  return `<pre><code class="language-${language || ''}">${escapeHTML(code)}</code></pre>`;
}

/**
 * Detect file type based on extension
 * @param filename - The filename to analyze
 * @returns File type string
 */
export function detectFileType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || '';

  const typeMap: Record<string, string> = {
    md: 'markdown',
    mdx: 'mdx',
    js: 'javascript',
    jsx: 'javascript',
    ts: 'typescript',
    tsx: 'typescript',
    py: 'python',
    java: 'java',
    cpp: 'cpp',
    c: 'c',
    css: 'css',
    html: 'html',
    json: 'json',
    xml: 'xml',
    yaml: 'yaml',
    yml: 'yaml',
    txt: 'text',
    log: 'text',
  };

  return typeMap[ext] || 'text';
}

/**
 * Format file size in human-readable format
 * @param bytes - Size in bytes
 * @returns Formatted size string
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Format report number with proper padding
 * @param number - The report number
 * @param padding - Number of digits for padding
 * @returns Formatted report number
 */
export function formatReportNumber(
  number: number,
  padding: number = 6
): string {
  return number.toString().padStart(padding, '0');
}

/**
 * Parse report-specific markdown
 * @param markdown - The report markdown content
 * @returns Parsed report data
 */
export function parseReportMarkdown(
  markdown: string
): ParsedMarkdown & { reportData?: any } {
  const parsed = parseMarkdown(markdown);

  // Extract report-specific data from frontmatter
  const reportData = {
    reportNumber: parsed.frontmatter.reportNumber,
    reportType: parsed.frontmatter.reportType,
    generated: parsed.frontmatter.generated,
    version: parsed.frontmatter.version,
  };

  return {
    ...parsed,
    reportData,
  };
}

/**
 * Generate report markdown from data
 * @param data - The report data
 * @param template - The report template
 * @returns Generated markdown string
 */
export function generateReportMarkdown(data: any, template?: string): string {
  // Basic template generation - in real implementation, would use a proper template engine
  const frontmatter = Object.entries(data.frontmatter || {})
    .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
    .join('\n');

  return `---\n${frontmatter}\n---\n\n${data.content || ''}`;
}

/**
 * Escape HTML characters for safe rendering
 * @param text - Text to escape
 * @returns Escaped HTML string
 */
function escapeHTML(text: string): string {
  const div =
    typeof document !== 'undefined' ? document.createElement('div') : null;
  if (div) {
    div.textContent = text;
    return div.innerHTML;
  }

  // Fallback for server-side
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

export default MarkdownProcessor;
