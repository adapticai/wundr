'use client';

import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MarkdownRenderer, FileContentViewer } from '@/components/markdown';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const SAMPLE_MARKDOWN = `---
title: "Markdown Rendering Demo"
description: "A comprehensive demonstration of the markdown rendering system"
author: "Dashboard Team"
date: "2024-01-15"
tags: ["markdown", "demo", "documentation"]
---

# Welcome to the Markdown Rendering System

This is a comprehensive demonstration of our markdown rendering capabilities with **full support** for GitHub Flavored Markdown and syntax highlighting.

## Features

- ✅ Frontmatter metadata support
- ✅ GitHub Flavored Markdown (GFM)
- ✅ Syntax highlighting for code blocks
- ✅ Table of contents generation
- ✅ Dark/light mode support
- ✅ Responsive design

## Code Examples

### JavaScript

\`\`\`javascript
function fibonacci(n) {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}

console.log(fibonacci(10)); // 55
\`\`\`

### TypeScript

\`\`\`typescript
interface User {
  id: number;
  name: string;
  email: string;
  isActive: boolean;
}

class UserService {
  private users: User[] = [];

  async createUser(userData: Omit<User, 'id'>): Promise<User> {
    const user: User = {
      id: Date.now(),
      ...userData
    };
    this.users.push(user);
    return user;
  }
}
\`\`\`

## Tables

| Feature | Status | Notes |
|---------|--------|-------|
| Basic Markdown | ✅ Complete | Full CommonMark support |
| GFM Extensions | ✅ Complete | Tables, strikethrough, etc. |
| Syntax Highlighting | ✅ Complete | 100+ languages supported |
| Dark Mode | ✅ Complete | Automatic theme switching |

## Lists and Tasks

### Regular Lists
1. First item
2. Second item
   - Nested bullet
   - Another nested item
3. Third item

### Task Lists
- [x] Implement basic rendering
- [x] Add syntax highlighting
- [x] Create responsive design
- [ ] Add more themes
- [ ] Performance optimizations

## Blockquotes

> This is a blockquote example. It can contain **bold text**, *italic text*, and even \`inline code\`.
> 
> Multiple paragraphs are supported as well.

## Links and Images

Visit our [documentation](https://example.com) for more information.

## Horizontal Rules

---

## Math Support (if enabled)

Inline math: $E = mc^2$

Block math:
$$
\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}
$$

---

*This demo showcases the full capabilities of our markdown rendering system.*`;

const SAMPLE_CODE_FILE = `// Sample TypeScript file
export interface Config {
  theme: 'light' | 'dark';
  language: string;
  features: {
    syntax: boolean;
    gfm: boolean;
    toc: boolean;
  };
}

export class MarkdownProcessor {
  constructor(private config: Config) {}
  
  async process(content: string): Promise<string> {
    // Processing logic here
    return content;
  }
}`;

export default function MarkdownDemoPage() {
  const [activeTab, setActiveTab] = useState('renderer');

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Markdown Rendering System</h1>
        <p className="text-muted-foreground">
          A comprehensive system for rendering markdown files with syntax highlighting,
          frontmatter support, and GitHub Flavored Markdown.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <Card className="p-4">
          <h3 className="font-semibold mb-2">Key Features</h3>
          <div className="space-y-1 text-sm">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">GFM</Badge>
              <span>GitHub Flavored Markdown</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">Syntax</Badge>
              <span>Code highlighting</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">Meta</Badge>
              <span>Frontmatter support</span>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <h3 className="font-semibold mb-2">Supported Languages</h3>
          <div className="flex flex-wrap gap-1 text-xs">
            {['JavaScript', 'TypeScript', 'Python', 'Rust', 'Go', 'Java', 'C++', 'CSS'].map(lang => (
              <Badge key={lang} variant="outline" className="text-xs">{lang}</Badge>
            ))}
          </div>
        </Card>

        <Card className="p-4">
          <h3 className="font-semibold mb-2">Themes</h3>
          <div className="space-y-1 text-sm">
            <div>✅ Light mode support</div>
            <div>✅ Dark mode support</div>
            <div>✅ System preference</div>
          </div>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="renderer">Markdown Renderer</TabsTrigger>
          <TabsTrigger value="viewer">File Content Viewer</TabsTrigger>
        </TabsList>

        <TabsContent value="renderer" className="space-y-4">
          <Card className="p-4">
            <h3 className="font-semibold mb-2">MarkdownRenderer Component</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Renders markdown content with full GFM support, syntax highlighting, and metadata display.
            </p>
            
            <MarkdownRenderer
              content={SAMPLE_MARKDOWN}
              showMetadata={true}
              showTableOfContents={true}
            />
          </Card>
        </TabsContent>

        <TabsContent value="viewer" className="space-y-4">
          <Card className="p-4">
            <h3 className="font-semibold mb-2">FileContentViewer Component</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Automatically detects file types and renders them appropriately with download and copy functionality.
            </p>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <FileContentViewer
              filePath="/demo/sample.md"
              fileName="sample.md"
              fileSize={SAMPLE_MARKDOWN.length}
              content={SAMPLE_MARKDOWN}
            />
            
            <FileContentViewer
              filePath="/demo/config.ts"
              fileName="config.ts"
              fileSize={SAMPLE_CODE_FILE.length}
              content={SAMPLE_CODE_FILE}
            />
          </div>
        </TabsContent>
      </Tabs>

      <Card className="p-6">
        <h3 className="font-semibold mb-4">Usage Examples</h3>
        
        <div className="space-y-4">
          <div>
            <h4 className="font-medium mb-2">Basic Markdown Rendering</h4>
            <pre className="bg-muted p-3 rounded text-sm overflow-x-auto">
              <code>{`import { MarkdownRenderer } from '@/components/markdown';

<MarkdownRenderer
  content="# Hello World\\n\\nThis is **bold** text."
  showMetadata={true}
  showTableOfContents={true}
/>`}</code>
            </pre>
          </div>

          <div>
            <h4 className="font-medium mb-2">File Content Viewing</h4>
            <pre className="bg-muted p-3 rounded text-sm overflow-x-auto">
              <code>{`import { FileContentViewer } from '@/components/markdown';

<FileContentViewer
  filePath="/path/to/file.md"
  fileName="README.md"
  fileSize={1024}
  content={fileContent}
/>`}</code>
            </pre>
          </div>

          <div>
            <h4 className="font-medium mb-2">Parsing Utilities</h4>
            <pre className="bg-muted p-3 rounded text-sm overflow-x-auto">
              <code>{`import { parseMarkdown, markdownToHtml } from '@/lib/markdown-utils';

const parsed = parseMarkdown(content);
const html = await markdownToHtml(parsed.content);`}</code>
            </pre>
          </div>
        </div>
      </Card>
    </div>
  );
}