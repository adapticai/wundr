'use client';

import React from 'react';
import { DocsLayout } from '@/components/docs/DocsLayout';
import { MarkdownRenderer } from '@/components/markdown/MarkdownRenderer';
import { SearchableContent } from '@/components/docs/SearchableContent';
import { readDocFile } from '@/lib/docs-utils';
// Remove path import - not needed in client component

// This would be fetched from the filesystem in a real app
const getGettingStartedContent = async () => {
  // Client-side component can't read from filesystem directly
  // Return static content instead

  // Fallback content
  return {
    content: `# Getting Started with Wundr Dashboard

Welcome to Wundr Dashboard - your comprehensive solution for intelligent monorepo analysis and refactoring.

## Quick Setup

Get your dashboard running in under 5 minutes:

\`\`\`bash
# Clone the repository
git clone <your-repo-url>
cd <your-repo>

# Install dependencies
npm install

# Start the development server
npm run dev

# Open your browser
open http://localhost:3000
\`\`\`

## Dashboard Overview

The Wundr Dashboard provides several key features:

### 🎯 Analysis Tools
- **Duplicate Code Detection**: Find and consolidate similar code patterns
- **Dependency Analysis**: Visualize relationships between modules
- **Refactoring Recommendations**: AI-powered suggestions for improvements

### 📊 Visualization
- **Interactive Charts**: Real-time metrics and trends
- **Code Maps**: Visual representation of your codebase structure
- **Progress Tracking**: Monitor refactoring progress over time

### 🔧 Integration
- **CI/CD Integration**: Automated analysis in your pipeline
- **Custom Scripts**: Run your own analysis tools
- **Export Options**: Share results in multiple formats

## First Steps

### 1. Run Your First Analysis

\`\`\`bash
# Navigate to your project
cd /path/to/your/project

# Run the analysis
npm run analyze

# View results in the dashboard
npm run dashboard
\`\`\`

### 2. Review Results

Look for:
- **Red indicators**: Critical issues requiring immediate attention
- **Yellow indicators**: Important improvements
- **Green indicators**: Good practices already in place

### 3. Plan Your Refactoring

Use the dashboard to:
- Prioritize high-impact changes
- Group related improvements
- Track progress over time

## Configuration

Customize the dashboard by editing \`wundr.config.json\`:

\`\`\`json
{
  "branding": {
    "appName": "My Project Dashboard",
    "primaryColor": "#0066CC",
    "logo": "./assets/logo.png"
  },
  "analysis": {
    "defaultPath": "./src",
    "excludePatterns": ["node_modules", "dist"],
    "includeExtensions": [".ts", ".tsx", ".js", ".jsx"]
  }
}
\`\`\`

## Common Tasks

### View Analysis Results
Navigate to the **Dashboard** tab to see:
- Summary metrics
- Detailed analysis results
- Trend charts

### Check for Duplicates
Go to **Analysis > Duplicates** to:
- Find similar code patterns
- See consolidation opportunities
- Apply automated fixes

### Review Recommendations
Visit **Recommendations** to:
- See AI-powered suggestions
- Understand impact estimates
- Plan implementation order

## Getting Help

- **Documentation**: Browse the complete documentation in this section
- **Support**: Contact our support team for assistance
- **Community**: Join the discussion in our community forums

## Next Steps

1. ✅ Complete the initial setup
2. 📊 Run your first analysis
3. 🎯 Review the results
4. 🚀 Start your first refactoring task

Ready to transform your codebase? Let's get started! 🎉
`,
    frontmatter: {
      title: 'Getting Started',
      description: 'Quick setup and first steps with the monorepo refactoring toolkit',
      category: 'guides',
      tags: ['setup', 'guide', 'quick-start']
    }
  };
};

export default async function GettingStartedPage() {
  const { content, frontmatter } = await getGettingStartedContent();

  const currentPage = {
    title: 'Getting Started',
    slug: 'getting-started',
    path: '/dashboard/docs/getting-started',
    category: 'guides',
    description: 'Quick setup and first steps with the monorepo refactoring toolkit',
    tags: ['setup', 'guide', 'quick-start'],
    order: 1
  };

  return (
    <DocsLayout currentPage={currentPage}>
      <div className="max-w-4xl space-y-6">
        {/* Search functionality */}
        <SearchableContent 
          content={content}
          onNavigate={(sectionId) => {
            // Scroll to section
            const element = document.getElementById(sectionId);
            if (element) {
              element.scrollIntoView({ behavior: 'smooth' });
            }
          }}
        />

        {/* Main content */}
        <MarkdownRenderer
          content={content}
          frontmatter={frontmatter}
          showMetadata={true}
          showTableOfContents={true}
        />
      </div>
    </DocsLayout>
  );
}