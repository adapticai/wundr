'use client';

import React, { useState } from 'react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';

import { MarkdownRenderer } from './markdown-renderer';
import { CodeBlock } from './code-block';
import { MessageAttachments } from './message-attachments';
import type { Attachment } from './message-attachments';
import { MessageActions } from './message-actions';
import { Message } from './message';

export function MessageFormattingExample() {
  const [attachments, setAttachments] = useState<Attachment[]>([
    {
      id: '1',
      name: 'example.tsx',
      url: '/files/example.tsx',
      type: 'text/typescript',
      size: 2048,
    },
    {
      id: '2',
      name: 'screenshot.png',
      url: '/images/screenshot.png',
      type: 'image/png',
      size: 102400,
      thumbnail: '/images/screenshot-thumb.png',
    },
    {
      id: '3',
      name: 'data.json',
      url: '/files/data.json',
      type: 'application/json',
      size: 1024,
    },
  ]);

  const markdownExample = `# AI Message with Rich Formatting

This is an example of **rich text formatting** in AI messages.

## Features

### Code Highlighting

Here's a TypeScript example:

\`\`\`typescript
import React from 'react';

export function Component() {
  const [count, setCount] = React.useState(0);

  return (
    <button onClick={() => setCount(count + 1)}>
      Count: {count}
    </button>
  );
}
\`\`\`

### Tables

| Feature | Status | Priority |
|---------|--------|----------|
| Markdown | ✓ Done | High |
| Code blocks | ✓ Done | High |
| Attachments | ✓ Done | Medium |
| LaTeX | ✓ Done | Low |

### Lists

1. First item with **bold text**
2. Second item with *italic text*
3. Third item with \`inline code\`

**Unordered list:**
- Task item one
- Task item two
  - Nested item
  - Another nested item

### Links and Images

Check out [this link](https://example.com) for more information.

External link: [External Site](https://external.com)

### Blockquotes

> This is a blockquote with multiple lines.
> It can contain **formatting** and \`code\`.

### Task Lists

- [x] Implement markdown renderer
- [x] Add syntax highlighting
- [ ] Add emoji support
- [ ] Implement citation formatting

### Inline Code

You can use \`const variable = value\` in your code.

### LaTeX Math

Inline math: $E = mc^2$

Block equation:

$$
\\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}
$$

---

### Horizontal Rule

Above is a horizontal rule.
`;

  const codeExample = `import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

interface User {
  id: string;
  email: string;
  name: string;
}

export function useUser() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchUser() {
      try {
        const { data, error } = await supabase
          .from('users')
          .select('*')
          .single();

        if (error) throw error;
        setUser(data);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    }

    fetchUser();
  }, []);

  return { user, loading, error };
}`;

  const pythonExample = `import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, classification_report

def train_model(X, y):
    """
    Train a Random Forest classifier

    Args:
        X: Feature matrix
        y: Target vector

    Returns:
        Trained model and metrics
    """
    # Split the data
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42
    )

    # Create and train model
    model = RandomForestClassifier(
        n_estimators=100,
        max_depth=10,
        random_state=42
    )
    model.fit(X_train, y_train)

    # Make predictions
    y_pred = model.predict(X_test)

    # Calculate metrics
    accuracy = accuracy_score(y_test, y_pred)
    report = classification_report(y_test, y_pred)

    return {
        'model': model,
        'accuracy': accuracy,
        'report': report
    }`;

  const handleRemoveAttachment = (id: string) => {
    setAttachments(prev => prev.filter(att => att.id !== id));
  };

  return (
    <div className='container mx-auto p-6 space-y-6'>
      <div>
        <h1 className='text-3xl font-bold'>AI Message Formatting Components</h1>
        <p className='text-muted-foreground mt-2'>
          Comprehensive examples of rich message formatting features
        </p>
      </div>

      <Tabs defaultValue='markdown' className='space-y-4'>
        <TabsList>
          <TabsTrigger value='markdown'>Markdown Renderer</TabsTrigger>
          <TabsTrigger value='code'>Code Blocks</TabsTrigger>
          <TabsTrigger value='attachments'>Attachments</TabsTrigger>
          <TabsTrigger value='actions'>Message Actions</TabsTrigger>
          <TabsTrigger value='complete'>Complete Message</TabsTrigger>
        </TabsList>

        <TabsContent value='markdown' className='space-y-4'>
          <Card>
            <CardHeader>
              <CardTitle>Markdown Rendering</CardTitle>
            </CardHeader>
            <CardContent>
              <MarkdownRenderer content={markdownExample} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value='code' className='space-y-4'>
          <Card>
            <CardHeader>
              <CardTitle>TypeScript Code Block</CardTitle>
            </CardHeader>
            <CardContent>
              <CodeBlock
                code={codeExample}
                language='typescript'
                fileName='useUser.ts'
                showLineNumbers={true}
                highlightLines={[12, 13, 14]}
                enableDownload={true}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Python Code Block</CardTitle>
            </CardHeader>
            <CardContent>
              <CodeBlock
                code={pythonExample}
                language='python'
                fileName='train_model.py'
                showLineNumbers={true}
                enableDownload={true}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value='attachments' className='space-y-4'>
          <Card>
            <CardHeader>
              <CardTitle>Detailed Attachments</CardTitle>
            </CardHeader>
            <CardContent>
              <MessageAttachments
                attachments={attachments}
                onRemove={handleRemoveAttachment}
                variant='detailed'
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Compact Attachments</CardTitle>
            </CardHeader>
            <CardContent>
              <MessageAttachments
                attachments={attachments}
                onRemove={handleRemoveAttachment}
                variant='compact'
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Read-only Attachments</CardTitle>
            </CardHeader>
            <CardContent>
              <MessageAttachments
                attachments={attachments}
                readOnly={true}
                variant='detailed'
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value='actions' className='space-y-4'>
          <Card>
            <CardHeader>
              <CardTitle>Inline Message Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className='p-4 bg-muted rounded-lg'>
                <p className='mb-2'>
                  This is a sample message with inline actions below.
                </p>
                <MessageActions
                  messageId='example-1'
                  content='This is a sample message with inline actions below.'
                  onCopy={() => console.log('Copied')}
                  onShare={() => console.log('Shared')}
                  onRegenerate={() => console.log('Regenerating')}
                  onFeedback={type => console.log('Feedback:', type)}
                  onBookmark={() => console.log('Bookmarked')}
                  onReport={() => console.log('Reported')}
                  variant='inline'
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Compact Message Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className='group p-4 bg-muted rounded-lg'>
                <p className='mb-2'>
                  Hover to see compact actions (typically used in chat bubbles).
                </p>
                <MessageActions
                  messageId='example-2'
                  content='Hover to see compact actions'
                  onCopy={() => console.log('Copied')}
                  onRegenerate={() => console.log('Regenerating')}
                  onFeedback={type => console.log('Feedback:', type)}
                  variant='compact'
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value='complete' className='space-y-4'>
          <Card>
            <CardHeader>
              <CardTitle>Complete AI Message</CardTitle>
            </CardHeader>
            <CardContent className='space-y-4'>
              <Message
                from='assistant'
                avatar={{
                  name: 'AI Assistant',
                  fallback: 'AI',
                }}
                timestamp={new Date()}
              >
                <div className='space-y-3'>
                  <MarkdownRenderer
                    content={`I've analyzed your code and found some improvements:

## Suggested Changes

\`\`\`typescript
// Before
const data = await fetch('/api/data').then(r => r.json());

// After - with error handling
const data = await fetch('/api/data')
  .then(r => {
    if (!r.ok) throw new Error('Failed to fetch');
    return r.json();
  })
  .catch(err => {
    console.error('Error:', err);
    return null;
  });
\`\`\`

Here are the related files for your review:`}
                  />

                  <MessageAttachments
                    attachments={attachments.slice(0, 2)}
                    variant='compact'
                    readOnly={true}
                  />

                  <MessageActions
                    messageId='complete-example'
                    content='Complete message with all features'
                    onCopy={() => console.log('Copied')}
                    onRegenerate={() => console.log('Regenerating')}
                    onFeedback={type => console.log('Feedback:', type)}
                    variant='inline'
                    showFeedback={true}
                    showRegenerate={true}
                  />
                </div>
              </Message>

              <Separator />

              <Message
                from='user'
                avatar={{
                  name: 'John Doe',
                  fallback: 'JD',
                }}
                timestamp={new Date(Date.now() - 300000)}
              >
                <p>
                  Can you review my authentication implementation and suggest
                  improvements?
                </p>
                <MessageAttachments
                  attachments={[attachments[0]]}
                  variant='compact'
                  readOnly={true}
                />
              </Message>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default MessageFormattingExample;
