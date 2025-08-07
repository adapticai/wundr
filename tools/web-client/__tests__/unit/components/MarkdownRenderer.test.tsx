import { render, screen } from '@testing-library/react';
import MarkdownRenderer from '@/components/markdown/MarkdownRenderer';

// Mock the markdown utils module
jest.mock('@/lib/markdown-utils', () => ({
  markdownToHtml: jest.fn(() => Promise.resolve('<p>Test markdown content</p>')),
  extractFrontMatter: jest.fn(() => ({
    meta: { title: 'Test Title', description: 'Test Description' },
    content: 'Test markdown content'
  })),
  extractTableOfContents: jest.fn(() => []),
  highlightCode: jest.fn(),
  detectFileType: jest.fn()
}));

// Mock the docs utils module
jest.mock('@/lib/docs-utils', () => ({
  extractDocHeaders: jest.fn(() => [
    { id: 'test-header', title: 'Test Header', level: 1 }
  ])
}));

describe('MarkdownRenderer', () => {
  const mockContent = `
# Test Header

This is a test markdown content with some **bold** text and a [link](https://example.com).

\`\`\`javascript
console.log('Hello, world!');
\`\`\`
  `;

  it('renders markdown content successfully', async () => {
    render(
      <MarkdownRenderer 
        content={mockContent}
        showMetadata={true}
        showTableOfContents={true}
      />
    );

    // Wait for the content to be processed
    await screen.findByText('Test markdown content');
    
    expect(screen.getByText('Test markdown content')).toBeInTheDocument();
  });

  it('renders with frontmatter metadata', async () => {
    const frontmatter = {
      title: 'Custom Title',
      description: 'Custom Description',
      author: 'Test Author',
      tags: ['test', 'markdown']
    };

    render(
      <MarkdownRenderer 
        content={mockContent}
        frontmatter={frontmatter}
        showMetadata={true}
      />
    );

    expect(screen.getByText('Custom Title')).toBeInTheDocument();
    expect(screen.getByText('Custom Description')).toBeInTheDocument();
    expect(screen.getByText('Test Author')).toBeInTheDocument();
    expect(screen.getByText('test')).toBeInTheDocument();
  });

  it('renders table of contents when enabled', async () => {
    render(
      <MarkdownRenderer 
        content={mockContent}
        showTableOfContents={true}
      />
    );

    expect(screen.getByText('Table of Contents')).toBeInTheDocument();
  });

  it('hides metadata when showMetadata is false', () => {
    const frontmatter = {
      title: 'Hidden Title',
      description: 'Hidden Description'
    };

    render(
      <MarkdownRenderer 
        content={mockContent}
        frontmatter={frontmatter}
        showMetadata={false}
      />
    );

    expect(screen.queryByText('Hidden Title')).not.toBeInTheDocument();
  });

  it('renders loading state initially', () => {
    render(
      <MarkdownRenderer content="" />
    );

    expect(document.querySelector('.animate-pulse')).toBeInTheDocument();
  });
});