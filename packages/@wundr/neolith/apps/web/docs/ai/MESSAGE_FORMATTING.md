# AI Message Formatting Components

Complete implementation of rich message formatting for AI conversations with markdown rendering,
syntax highlighting, attachments, and interactive actions.

## Overview

This implementation provides a comprehensive set of components and utilities for displaying AI
messages with rich formatting capabilities.

## Components Created

### 1. MarkdownRenderer (`components/ai/markdown-renderer.tsx`)

**Lines: 273**

Rich markdown rendering with full support for:

- **Markdown Features**:
  - Headings (H1-H6)
  - Bold, italic, strikethrough
  - Lists (ordered, unordered, task lists)
  - Tables with styling
  - Blockquotes
  - Horizontal rules
  - Links (internal/external with icons)
  - Images with captions

- **Code Support**:
  - Inline code with styling
  - Code blocks with syntax highlighting (via CodeBlock component)
  - Automatic language detection

- **Advanced Features**:
  - LaTeX math equations (inline and block) via `rehype-katex`
  - GitHub Flavored Markdown via `remark-gfm`
  - Custom component overrides
  - Responsive design
  - Dark mode support

**Usage:**

```tsx
import { MarkdownRenderer } from '@/components/ai';

<MarkdownRenderer content={markdownText} enableLatex={true} enableGfm={true} />;
```

### 2. CodeBlock (`components/ai/code-block.tsx`)

**Lines: 245**

Professional code display with:

- **Syntax Highlighting**: Full language support via Prism
- **Features**:
  - Line numbers (toggleable)
  - Copy to clipboard with feedback
  - Download code as file
  - Line highlighting
  - Language badge
  - Responsive scrolling
  - Theme-aware (light/dark)
  - Custom max height

- **Supported Languages**:
  - JavaScript/TypeScript/JSX/TSX
  - Python, Java, C#, C++, Go, Rust
  - HTML, CSS, SCSS
  - JSON, YAML, SQL, GraphQL
  - And many more...

**Usage:**

```tsx
import { CodeBlock } from '@/components/ai';

<CodeBlock
  code={sourceCode}
  language='typescript'
  fileName='example.ts'
  showLineNumbers={true}
  highlightLines={[5, 12, 18]}
  enableCopy={true}
  enableDownload={true}
/>;
```

### 3. MessageAttachments (`components/ai/message-attachments.tsx`)

**Lines: 319**

File attachment display and management:

- **Display Modes**:
  - Detailed view with thumbnails
  - Compact view for space efficiency
  - Read-only mode

- **Features**:
  - File type detection with icons
  - Image thumbnails
  - Preview dialog (images, PDFs)
  - Download functionality
  - Remove attachments (when editable)
  - File size formatting
  - Responsive layout

- **Supported Types**:
  - Images (with preview)
  - Documents (PDF with iframe preview)
  - Code files
  - Archives
  - Audio/Video
  - Generic files

**Usage:**

```tsx
import { MessageAttachments } from '@/components/ai';

<MessageAttachments
  attachments={[
    {
      id: '1',
      name: 'document.pdf',
      url: '/files/doc.pdf',
      type: 'application/pdf',
      size: 102400,
    },
  ]}
  onRemove={id => handleRemove(id)}
  variant='detailed'
  readOnly={false}
/>;
```

### 4. MessageActions (`components/ai/message-actions.tsx`)

**Lines: 290**

Interactive message actions:

- **Primary Actions**:
  - Copy message
  - Share (native share or fallback to copy)
  - Regenerate response
  - Feedback (thumbs up/down)
  - Bookmark
  - Report

- **Display Variants**:
  - Inline: All actions visible
  - Compact: Minimal with dropdown menu
  - Group hover: Show on interaction

- **Features**:
  - Visual feedback (copy confirmation, active states)
  - Tooltips for all actions
  - Customizable action visibility
  - Keyboard accessible

**Usage:**

```tsx
import { MessageActions } from '@/components/ai';

<MessageActions
  messageId='msg-123'
  content={messageContent}
  onCopy={() => console.log('Copied')}
  onShare={() => console.log('Shared')}
  onRegenerate={() => console.log('Regenerating')}
  onFeedback={type => console.log('Feedback:', type)}
  variant='inline'
  showFeedback={true}
  showRegenerate={true}
/>;
```

### 5. Message Formatting Utilities (`lib/ai/format-message.ts`)

**Lines: 357**

Comprehensive utility functions:

**Text Processing:**

- `formatMessage()` - Main formatting function
- `linkify()` - Convert URLs to markdown links
- `mentionify()` - Convert @mentions to links
- `truncate()` - Smart text truncation

**Markdown Operations:**

- `extractCodeBlocks()` - Parse code blocks with metadata
- `extractInlineCode()` - Extract inline code segments
- `stripMarkdown()` - Remove all markdown formatting
- `extractCitations()` - Parse reference citations
- `extractLatex()` - Parse LaTeX equations

**Analysis:**

- `countWords()` - Word count
- `estimateReadingTime()` - Calculate reading time
- `detectLanguage()` - Auto-detect code language

**Helpers:**

- `highlightSearchTerms()` - Highlight search matches
- `formatTimestamp()` - Human-readable timestamps
- `generatePreview()` - Create message preview
- `validateMessage()` - Validate message content

**Usage:**

```tsx
import {
  formatMessage,
  extractCodeBlocks,
  stripMarkdown,
  estimateReadingTime,
} from '@/lib/ai/format-message';

const formatted = formatMessage(rawText, {
  enableEmoji: true,
  enableLinks: true,
  truncate: 200,
});

const blocks = extractCodeBlocks(markdown);
const plainText = stripMarkdown(markdown);
const readTime = estimateReadingTime(text); // minutes
```

### 6. Example Implementation (`components/ai/message-formatting-example.tsx`)

**Lines: 445**

Complete demonstration showcasing:

- All component variations
- Real-world usage patterns
- Interactive examples
- Integration with existing Message component
- Tabbed interface for easy exploration

## Integration

### Export Updates

Updated `/components/ai/index.ts`:

```typescript
// Message formatting
export { MarkdownRenderer } from './markdown-renderer';
export { CodeBlock } from './code-block';
export { MessageAttachments } from './message-attachments';
export { MessageActions } from './message-actions';
```

Updated `/lib/ai/index.ts`:

```typescript
// Message formatting utilities
export * from './format-message';
```

## Features Checklist

- ✅ react-markdown with remark-gfm
- ✅ Code syntax highlighting (Prism via react-syntax-highlighter)
- ✅ Copy code button with visual feedback
- ✅ Language detection (auto-detect and manual)
- ✅ Tables and lists support
- ✅ Image rendering in messages with captions
- ✅ Link handling (internal vs external with icons)
- ✅ Emoji support (native in markdown)
- ✅ Citation/reference formatting
- ✅ LaTeX support via rehype-katex
- ✅ File attachments with previews
- ✅ Message actions (copy, share, feedback, etc.)
- ✅ Dark mode support
- ✅ Responsive design
- ✅ Accessibility features

## Dependencies Used

All required dependencies were already present in package.json:

- `react-markdown` - Core markdown rendering
- `remark-gfm` - GitHub Flavored Markdown
- `react-syntax-highlighter` - Code highlighting
- `rehype-katex` - LaTeX math rendering
- `katex` - Math typesetting
- `prismjs` - Syntax highlighting themes
- `lucide-react` - Icons
- `@radix-ui/*` - UI primitives

## Usage Examples

### Complete Message with All Features

```tsx
import { Message, MarkdownRenderer, MessageAttachments, MessageActions } from '@/components/ai';

function ChatMessage({ message }) {
  return (
    <Message from={message.role} avatar={message.avatar} timestamp={message.timestamp}>
      <div className='space-y-3'>
        {/* Rich markdown content */}
        <MarkdownRenderer content={message.content} enableLatex={true} enableGfm={true} />

        {/* File attachments */}
        {message.attachments?.length > 0 && (
          <MessageAttachments attachments={message.attachments} variant='compact' readOnly={true} />
        )}

        {/* Interactive actions */}
        <MessageActions
          messageId={message.id}
          content={message.content}
          onCopy={() => handleCopy()}
          onFeedback={type => handleFeedback(type)}
          onRegenerate={() => handleRegenerate()}
          variant='inline'
        />
      </div>
    </Message>
  );
}
```

### Standalone Code Display

```tsx
import { CodeBlock } from '@/components/ai';

<CodeBlock
  code={`function example() {
  console.log('Hello, World!');
}`}
  language='javascript'
  showLineNumbers={true}
  enableCopy={true}
/>;
```

### Format and Display Markdown

```tsx
import { MarkdownRenderer } from '@/components/ai';
import { formatMessage, extractCodeBlocks } from '@/lib/ai/format-message';

const formatted = formatMessage(userInput, {
  enableLinks: true,
  truncate: 500,
});

const codeBlocks = extractCodeBlocks(formatted);

<MarkdownRenderer content={formatted} />;
```

## File Summary

| File                                           | Lines     | Purpose                               |
| ---------------------------------------------- | --------- | ------------------------------------- |
| `components/ai/markdown-renderer.tsx`          | 273       | Markdown rendering with GFM and LaTeX |
| `components/ai/code-block.tsx`                 | 245       | Syntax-highlighted code blocks        |
| `components/ai/message-attachments.tsx`        | 319       | File attachment display               |
| `components/ai/message-actions.tsx`            | 290       | Interactive message actions           |
| `lib/ai/format-message.ts`                     | 357       | Formatting utilities                  |
| `components/ai/message-formatting-example.tsx` | 445       | Comprehensive examples                |
| **Total**                                      | **1,929** | **Full implementation**               |

## Testing

To test the implementation:

1. Import the example component:

```tsx
import { MessageFormattingExample } from '@/components/ai/message-formatting-example';
```

2. Add to a page:

```tsx
export default function TestPage() {
  return <MessageFormattingExample />;
}
```

3. Navigate to the page to see all features in action

## Performance Considerations

- **Code Highlighting**: Uses Prism for efficient syntax highlighting
- **Lazy Loading**: Images use `loading="lazy"`
- **Virtualization**: Large code blocks have max-height with scroll
- **Theme Caching**: Syntax themes loaded based on current theme
- **Memoization**: Components use React best practices

## Accessibility

- Semantic HTML structure
- ARIA labels on interactive elements
- Keyboard navigation support
- Screen reader friendly
- Focus management
- Color contrast compliance

## Browser Support

- Modern browsers (Chrome, Firefox, Safari, Edge)
- Mobile responsive
- Touch-friendly interactions
- Fallbacks for older browsers

## Future Enhancements

Potential additions:

- Mermaid diagram support
- Interactive code execution
- Collaborative editing
- Voice message transcription
- Advanced citation management
- Custom emoji pickers
- Real-time collaboration indicators

---

**Status**: ✅ Complete - Fully functional, no stubs **Last Updated**: 2025-12-06
