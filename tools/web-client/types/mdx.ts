/**
 * MDX Component Type Definitions
 *
 * Comprehensive type definitions for MDX components, markdown rendering,
 * and documentation components to replace all 'any' types.
 *
 * @version 1.0.0
 * @author Wundr Development Team
 */

import type { ReactNode } from 'react';

// =============================================================================
// MDX COMPONENT PROPS
// =============================================================================

/**
 * Base MDX component props
 */
export interface BaseMdxProps {
  /** Child elements */
  children?: ReactNode;
  /** CSS class name */
  className?: string;
  /** Element ID */
  id?: string;
  /** Additional HTML attributes */
  [key: string]: unknown;
}

/**
 * Pre-formatted text component props
 */
export interface PreProps extends BaseMdxProps {
  /** Code language */
  'data-language'?: string;
  /** Code filename */
  'data-filename'?: string;
  /** Whether to show line numbers */
  'data-line-numbers'?: boolean;
  /** Lines to highlight */
  'data-highlight'?: string;
  /** Code theme */
  'data-theme'?: string;
}

/**
 * Inline code component props
 */
export interface CodeProps extends BaseMdxProps {
  /** Whether code is inline */
  inline?: boolean;
  /** Programming language */
  language?: string;
  /** Code content */
  value?: string;
}

/**
 * Heading component props
 */
export interface HeadingProps extends BaseMdxProps {
  /** Heading level */
  level?: 1 | 2 | 3 | 4 | 5 | 6;
  /** Anchor ID for linking */
  anchor?: string;
  /** Whether to show anchor link */
  showAnchor?: boolean;
}

/**
 * Link component props
 */
export interface LinkProps extends BaseMdxProps {
  /** Link href */
  href?: string;
  /** Link target */
  target?: '_blank' | '_self' | '_parent' | '_top';
  /** Link rel attribute */
  rel?: string;
  /** Whether link is external */
  external?: boolean;
  /** Link title */
  title?: string;
}

/**
 * Table component props
 */
export interface TableProps extends BaseMdxProps {
  /** Table caption */
  caption?: string;
  /** Whether table is sortable */
  sortable?: boolean;
  /** Whether table is striped */
  striped?: boolean;
  /** Table size */
  size?: 'sm' | 'md' | 'lg';
}

/**
 * Table cell component props
 */
export interface TableCellProps extends BaseMdxProps {
  /** Cell alignment */
  align?: 'left' | 'center' | 'right';
  /** Cell scope for accessibility */
  scope?: 'col' | 'row' | 'colgroup' | 'rowgroup';
  /** Cell span */
  colSpan?: number;
  /** Row span */
  rowSpan?: number;
}

/**
 * Blockquote component props
 */
export interface BlockquoteProps extends BaseMdxProps {
  /** Quote author */
  author?: string;
  /** Quote source */
  source?: string;
  /** Quote citation */
  cite?: string;
  /** Quote type */
  type?: 'quote' | 'note' | 'warning' | 'tip' | 'important';
}

/**
 * List component props
 */
export interface ListProps extends BaseMdxProps {
  /** List type */
  type?: 'ordered' | 'unordered';
  /** List start number (for ordered lists) */
  start?: number;
  /** List marker style */
  marker?: 'decimal' | 'lower-alpha' | 'upper-alpha' | 'lower-roman' | 'upper-roman' | 'disc' | 'circle' | 'square';
}

/**
 * Image component props
 */
export interface ImageProps extends BaseMdxProps {
  /** Image source */
  src?: string;
  /** Image alt text */
  alt?: string;
  /** Image title */
  title?: string;
  /** Image width */
  width?: number | string;
  /** Image height */
  height?: number | string;
  /** Image loading behavior */
  loading?: 'lazy' | 'eager';
  /** Image priority */
  priority?: boolean;
  /** Image caption */
  caption?: string;
}

// =============================================================================
// MARKDOWN FRONTMATTER TYPES
// =============================================================================

/**
 * Document frontmatter structure
 */
export interface DocFrontmatter {
  /** Document title */
  title: string;
  /** Document description */
  description?: string;
  /** Document author */
  author?: string;
  /** Publication date */
  date?: string | Date;
  /** Last modified date */
  lastModified?: string | Date;
  /** Document tags */
  tags?: string[];
  /** Document category */
  category?: string;
  /** Document status */
  status?: 'draft' | 'published' | 'archived';
  /** Table of contents configuration */
  toc?: boolean | {
    /** Maximum heading level */
    maxDepth?: number;
    /** Minimum heading level */
    minDepth?: number;
    /** TOC title */
    title?: string;
  };
  /** SEO metadata */
  seo?: {
    /** Meta description */
    description?: string;
    /** Keywords */
    keywords?: string[];
    /** Open Graph image */
    image?: string;
    /** Canonical URL */
    canonical?: string;
  };
  /** Reading time estimate */
  readingTime?: {
    /** Minutes to read */
    minutes: number;
    /** Word count */
    words: number;
  };
}

/**
 * Table of contents entry
 */
export interface TocEntry {
  /** Heading ID */
  id: string;
  /** Heading text */
  title: string;
  /** Heading level */
  level: number;
  /** Nested children */
  children?: TocEntry[];
  /** Anchor link */
  anchor: string;
}

// =============================================================================
// API DOCUMENTATION TYPES
// =============================================================================

/**
 * API schema definition
 */
export interface ApiSchema {
  /** Schema type */
  type: 'object' | 'array' | 'string' | 'number' | 'boolean' | 'null';
  /** Schema properties */
  properties?: Record<string, ApiSchema>;
  /** Array item schema */
  items?: ApiSchema;
  /** Required properties */
  required?: string[];
  /** Schema description */
  description?: string;
  /** Example value */
  example?: unknown;
  /** Enum values */
  enum?: unknown[];
  /** Format specification */
  format?: string;
  /** Minimum value/length */
  minimum?: number;
  /** Maximum value/length */
  maximum?: number;
  /** Pattern validation */
  pattern?: string;
  /** Default value */
  default?: unknown;
}

/**
 * API endpoint definition
 */
export interface ApiEndpoint {
  /** HTTP method */
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';
  /** Endpoint path */
  path: string;
  /** Endpoint summary */
  summary: string;
  /** Detailed description */
  description?: string;
  /** Path parameters */
  parameters?: Array<{
    /** Parameter name */
    name: string;
    /** Parameter location */
    in: 'path' | 'query' | 'header' | 'cookie';
    /** Parameter description */
    description?: string;
    /** Whether required */
    required: boolean;
    /** Parameter schema */
    schema: ApiSchema;
  }>;
  /** Request body schema */
  requestBody?: {
    /** Content type */
    contentType: string;
    /** Request schema */
    schema: ApiSchema;
    /** Whether required */
    required?: boolean;
  };
  /** Response schemas */
  responses: Record<string | number, {
    /** Response description */
    description: string;
    /** Response schema */
    schema?: ApiSchema;
    /** Response headers */
    headers?: Record<string, ApiSchema>;
  }>;
  /** Operation tags */
  tags?: string[];
  /** Security requirements */
  security?: Array<Record<string, string[]>>;
  /** Whether endpoint is deprecated */
  deprecated?: boolean;
}

/**
 * API documentation section
 */
export interface ApiDocSection {
  /** Section title */
  title: string;
  /** Section description */
  description?: string;
  /** Section endpoints */
  endpoints: ApiEndpoint[];
  /** Section order */
  order?: number;
  /** Section tags */
  tags?: string[];
}

// =============================================================================
// MARKDOWN RENDERER TYPES
// =============================================================================

/**
 * Markdown rendering options
 */
export interface MarkdownRenderOptions {
  /** Enable syntax highlighting */
  syntaxHighlighting?: boolean;
  /** Enable table of contents */
  toc?: boolean;
  /** Enable math rendering */
  math?: boolean;
  /** Enable mermaid diagrams */
  mermaid?: boolean;
  /** Enable footnotes */
  footnotes?: boolean;
  /** Enable GitHub-flavored markdown */
  gfm?: boolean;
  /** Custom heading anchor prefix */
  headingAnchorPrefix?: string;
  /** Base URL for relative links */
  baseUrl?: string;
}

/**
 * Markdown processor result
 */
export interface MarkdownProcessResult {
  /** Rendered HTML content */
  content: string;
  /** Extracted frontmatter */
  frontmatter: DocFrontmatter;
  /** Generated table of contents */
  toc: TocEntry[];
  /** Content statistics */
  stats: {
    /** Word count */
    words: number;
    /** Character count */
    characters: number;
    /** Reading time in minutes */
    readingTime: number;
    /** Heading count by level */
    headings: Record<number, number>;
  };
  /** Extracted metadata */
  metadata: {
    /** Internal links */
    internalLinks: string[];
    /** External links */
    externalLinks: string[];
    /** Images */
    images: Array<{
      src: string;
      alt?: string;
      title?: string;
    }>;
    /** Code blocks */
    codeBlocks: Array<{
      language?: string;
      code: string;
    }>;
  };
}

// =============================================================================
// COMPONENT COLLECTION TYPE
// =============================================================================

/**
 * MDX components collection
 */
export interface MdxComponents {
  /** Heading components */
  h1?: React.ComponentType<HeadingProps>;
  h2?: React.ComponentType<HeadingProps>;
  h3?: React.ComponentType<HeadingProps>;
  h4?: React.ComponentType<HeadingProps>;
  h5?: React.ComponentType<HeadingProps>;
  h6?: React.ComponentType<HeadingProps>;
  /** Text components */
  p?: React.ComponentType<BaseMdxProps>;
  span?: React.ComponentType<BaseMdxProps>;
  strong?: React.ComponentType<BaseMdxProps>;
  em?: React.ComponentType<BaseMdxProps>;
  /** Code components */
  pre?: React.ComponentType<PreProps>;
  code?: React.ComponentType<CodeProps>;
  /** Link components */
  a?: React.ComponentType<LinkProps>;
  /** List components */
  ul?: React.ComponentType<ListProps>;
  ol?: React.ComponentType<ListProps>;
  li?: React.ComponentType<BaseMdxProps>;
  /** Table components */
  table?: React.ComponentType<TableProps>;
  thead?: React.ComponentType<BaseMdxProps>;
  tbody?: React.ComponentType<BaseMdxProps>;
  tr?: React.ComponentType<BaseMdxProps>;
  th?: React.ComponentType<TableCellProps>;
  td?: React.ComponentType<TableCellProps>;
  /** Quote components */
  blockquote?: React.ComponentType<BlockquoteProps>;
  /** Media components */
  img?: React.ComponentType<ImageProps>;
  /** Divider components */
  hr?: React.ComponentType<BaseMdxProps>;
  /** Custom components */
  [key: string]: React.ComponentType<Record<string, unknown>> | undefined;
}

// Types are already exported as interfaces above