# Markdown Rendering System

## Overview

This document demonstrates the comprehensive markdown rendering system built for the dashboard. The system provides full support for:

- ✅ **GitHub Flavored Markdown (GFM)** - Tables, strikethrough, task lists, and more
- ✅ **Syntax Highlighting** - Code blocks with automatic language detection
- ✅ **Frontmatter Support** - YAML metadata parsing and display
- ✅ **Dark/Light Mode** - Seamless theme switching
- ✅ **Table of Contents** - Automatic generation for long documents
- ✅ **File Type Detection** - Smart rendering based on file extensions

## Components

### MarkdownRenderer
The core component for rendering markdown content with full feature support.

```typescript
import { MarkdownRenderer } from '@/components/markdown';

<MarkdownRenderer
  content={markdownContent}
  frontmatter={metadata}
  showMetadata={true}
  showTableOfContents={true}
/>
```

### FileContentViewer
A comprehensive file viewer that automatically detects and renders different file types.

```typescript
import { FileContentViewer } from '@/components/markdown';

<FileContentViewer
  filePath="/path/to/file.md"
  fileName="example.md"
  fileSize={1024}
  content={fileContent}
/>
```

## Utilities

The system includes powerful utility functions:

- `parseMarkdown()` - Parse content with frontmatter extraction
- `markdownToHtml()` - Convert markdown to HTML with GFM support
- `extractTableOfContents()` - Generate navigation from headings
- `detectFileType()` - Identify file types from extensions

## Styling

All markdown content is styled to match the dashboard theme with:

- Consistent typography hierarchy
- Code syntax highlighting
- Responsive tables and images
- Custom alert boxes
- Task list styling

## Example Usage

### Basic Markdown
```markdown
# Hello World

This is **bold** and *italic* text.

- List item 1
- List item 2
  - Nested item

| Column 1 | Column 2 |
|----------|----------|
| Data 1   | Data 2   |
```

### With Frontmatter
```markdown
---
title: "Document Title"
author: "Author Name"
date: "2024-01-15"
tags: ["markdown", "demo"]
---

# Content Here
```

## Features Demonstrated

1. **Syntax Highlighting** - Multiple languages supported
2. **Tables** - Full GFM table support
3. **Task Lists** - Interactive checkboxes
4. **Blockquotes** - Styled quote blocks
5. **Links** - External and internal navigation
6. **Images** - Responsive image rendering

This system seamlessly integrates with the dashboard's existing design system and provides a powerful foundation for documentation and content rendering.