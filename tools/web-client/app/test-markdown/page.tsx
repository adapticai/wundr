'use client';

import React from 'react';
import MarkdownRenderer from '@/components/markdown/MarkdownRenderer';

const sampleMarkdown = `---
title: "MarkdownRenderer Component Demo"
description: "A demonstration of the enhanced MarkdownRenderer component"
author: "Wundr Team"
date: "2025-08-06"
tags: ["react", "markdown", "components", "next.js"]
---

# Welcome to MarkdownRenderer

This is a demo page showcasing the enhanced **MarkdownRenderer** component that works without next-mdx-remote.

## Features

The component includes several enhanced features:

- ✅ **Syntax Highlighting** - Powered by highlight.js
- ✅ **Table of Contents** - Auto-generated from headings
- ✅ **Copy Code Blocks** - Click to copy code snippets
- ✅ **Anchor Links** - Click heading anchors for direct links
- ✅ **Frontmatter Support** - YAML frontmatter parsing
- ✅ **Responsive Design** - Works on all screen sizes

## Code Example

Here's a sample TypeScript function:

\`\`\`typescript
interface User {
  id: string;
  name: string;
  email: string;
}

async function fetchUser(id: string): Promise<User> {
  const response = await fetch(\`/api/users/\${id}\`);
  
  if (!response.ok) {
    throw new Error('Failed to fetch user');
  }
  
  return response.json();
}

// Usage example
const user = await fetchUser('123');
console.log(user.name);
\`\`\`

## JavaScript Example

And here's some JavaScript:

\`\`\`javascript
function calculateTotal(items) {
  return items.reduce((total, item) => {
    return total + (item.price * item.quantity);
  }, 0);
}

const cart = [
  { name: 'Product A', price: 10.99, quantity: 2 },
  { name: 'Product B', price: 5.50, quantity: 1 }
];

const total = calculateTotal(cart);
console.log(\`Total: $\${total.toFixed(2)}\`);
\`\`\`

## Tables

| Feature | Status | Description |
|---------|--------|-------------|
| Syntax Highlighting | ✅ | Powered by highlight.js |
| Table of Contents | ✅ | Auto-generated navigation |
| Copy Buttons | ✅ | Easy code copying |
| Responsive Design | ✅ | Mobile-friendly layout |

## Blockquotes

> This is a blockquote demonstrating how the component handles quoted content.
> It supports multi-line quotes and maintains proper formatting.

## Lists

### Unordered Lists

- First item
- Second item with **bold text**
- Third item with \`inline code\`
- Fourth item

### Ordered Lists

1. Step one: Install dependencies
2. Step two: Configure the component
3. Step three: Use in your application
4. Step four: Enjoy enhanced markdown rendering!

## Links and Images

Here's a [link to GitHub](https://github.com) and here's how you can include images:

![Sample Image](https://via.placeholder.com/400x200?text=Sample+Image)

## Conclusion

The enhanced MarkdownRenderer component provides a robust solution for rendering markdown content in Next.js applications without requiring next-mdx-remote.
`;

export default function TestMarkdownPage() {
  return (
    <div className="container mx-auto py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">MarkdownRenderer Test Page</h1>
        <p className="text-muted-foreground">
          This page demonstrates the MarkdownRenderer component working without next-mdx-remote.
        </p>
      </div>
      
      <MarkdownRenderer 
        content={sampleMarkdown}
        showMetadata={true}
        showTableOfContents={true}
        enableSyntaxHighlighting={true}
        className="max-w-none"
      />
    </div>
  );
}