# Contributing to Wundr

Welcome! We're thrilled that you're interested in contributing to Wundr. This guide will help you get started with contributing to our AI-powered development platform.

## 🎯 Ways to Contribute

There are many ways to contribute to Wundr:

- 🐛 **Report bugs** and suggest fixes
- 💡 **Propose new features** and enhancements
- 📝 **Improve documentation** and examples
- 🔌 **Create plugins** for new tools and frameworks
- 🧪 **Write tests** to improve coverage
- 🎨 **Design improvements** for the dashboard
- 🌍 **Translate** to new languages
- 💬 **Help others** in discussions and support channels

## 🚀 Quick Start

### Prerequisites

- **Node.js 18+** (LTS recommended)
- **pnpm 8+** (required for monorepo management)
- **Git** (for version control)
- **VS Code** (recommended editor with extensions)

### Development Setup

1. **Fork and Clone**
   ```bash
   # Fork the repository on GitHub first
   git clone https://github.com/YOUR_USERNAME/wundr.git
   cd wundr
   ```

2. **Install Dependencies**
   ```bash
   # Use pnpm for consistent dependency management
   pnpm install
   ```

3. **Build All Packages**
   ```bash
   # Build the entire monorepo
   pnpm build
   ```

4. **Run Tests**
   ```bash
   # Verify everything works
   pnpm test
   ```

5. **Start Development**
   ```bash
   # Start development servers
   pnpm dev
   
   # Or start specific components
   pnpm --filter @wundr/dashboard dev
   ```

## 📁 Project Structure

Understanding the codebase structure:

```
wundr/
├── packages/                   # Monorepo packages
│   ├── @wundr/cli/            # Command-line interface
│   ├── @wundr/analysis-engine/# Core analysis engine
│   ├── @wundr/dashboard/      # Web dashboard
│   ├── @wundr/ai-integration/ # AI services
│   └── shared-config/         # Shared configuration
├── docs/                      # Documentation
├── examples/                  # Example projects and demos
├── scripts/                   # Build and utility scripts
├── tests/                     # Integration and E2E tests
├── tools/                     # Development tools
└── templates/                 # Project templates
```

### Package Overview

| Package | Purpose | Technologies |
|---------|---------|-------------|
| `@wundr/cli` | Command-line interface | TypeScript, Commander.js |
| `@wundr/analysis-engine` | Code analysis core | TypeScript, ts-morph, AST |
| `@wundr/dashboard` | Web interface | Next.js 15, React 19, D3.js |
| `@wundr/ai-integration` | AI services | Claude API, OpenAI API |

## 💻 Development Workflow

### 1. Pick an Issue

- Check our [GitHub Issues](https://github.com/adapticai/wundr/issues)
- Look for issues labeled `good first issue` or `help wanted`
- Comment on the issue to let others know you're working on it

### 2. Create a Branch

```bash
# Create a feature branch
git checkout -b feature/your-feature-name

# Or a bug fix branch
git checkout -b fix/bug-description
```

### Branch Naming Convention

- `feature/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation changes
- `refactor/` - Code refactoring
- `test/` - Test improvements
- `chore/` - Maintenance tasks

### 3. Make Your Changes

#### Code Style Guidelines

We use automated formatting and linting:

```bash
# Format code
pnpm format

# Lint code
pnpm lint

# Type check
pnpm typecheck
```

#### Coding Standards

- **TypeScript**: Use strict TypeScript with proper types
- **Testing**: Write tests for new functionality
- **Documentation**: Update docs for API changes
- **Commits**: Use conventional commit messages

#### Commit Message Format

We follow the [Conventional Commits](https://conventionalcommits.org/) specification:

```
type(scope): description

feat(cli): add natural language command processing
fix(dashboard): resolve WebSocket connection issues  
docs(api): update plugin development guide
test(engine): add complexity analysis tests
chore(deps): update dependencies to latest versions
```

**Types:**
- `feat` - New features
- `fix` - Bug fixes
- `docs` - Documentation changes
- `style` - Code style changes
- `refactor` - Code refactoring
- `test` - Test additions/improvements
- `chore` - Maintenance tasks

### 4. Test Your Changes

#### Running Tests

```bash
# Run all tests
pnpm test

# Run specific test suites
pnpm test:unit              # Unit tests
pnpm test:integration       # Integration tests
pnpm test:e2e              # End-to-end tests
pnpm test:performance      # Performance tests

# Run tests for specific package
pnpm --filter @wundr/cli test

# Watch mode for development
pnpm test:watch
```

#### Test Requirements

- **Unit tests** for new functions and classes
- **Integration tests** for API endpoints and workflows
- **E2E tests** for user-facing features
- **Performance tests** for analysis engine changes

#### Test Structure

```typescript
// Example unit test
import { AnalysisEngine } from '../src/AnalysisEngine';

describe('AnalysisEngine', () => {
  describe('analyze', () => {
    it('should detect duplicate code clusters', async () => {
      const engine = new AnalysisEngine({ targetDir: './test-fixtures' });
      const report = await engine.analyze();
      
      expect(report.duplicates).toHaveLength(2);
      expect(report.duplicates[0].similarity).toBeGreaterThan(0.8);
    });
  });
});
```

### 5. Update Documentation

#### Documentation Types

1. **API Documentation**: Update JSDoc comments
2. **User Guides**: Update markdown files in `docs/`
3. **README Files**: Update package README files
4. **Examples**: Add usage examples

#### Documentation Guidelines

- Use clear, concise language
- Include code examples
- Update table of contents
- Test all code examples
- Use consistent formatting

## 🧪 Testing Guidelines

### Test Structure

```
tests/
├── unit/                  # Unit tests
│   ├── cli/              # CLI component tests
│   ├── analysis-engine/  # Analysis engine tests
│   └── dashboard/        # Dashboard tests
├── integration/          # Integration tests
│   ├── api/             # API integration tests
│   └── workflow/        # End-to-end workflow tests
├── e2e/                 # End-to-end tests
│   ├── dashboard/       # Dashboard E2E tests
│   └── cli/            # CLI E2E tests
├── performance/         # Performance tests
└── fixtures/           # Test data and fixtures
```

### Test Best Practices

1. **Test Coverage**: Aim for >90% coverage for new code
2. **Test Independence**: Tests should not depend on each other
3. **Realistic Data**: Use realistic test fixtures
4. **Error Cases**: Test both success and error scenarios
5. **Performance**: Include performance regression tests

### Mock Data and Fixtures

Create realistic test fixtures:

```typescript
// tests/fixtures/sample-project.ts
export const sampleProject = {
  files: [
    {
      path: 'src/utils/helper.ts',
      content: 'export function helper() { return "test"; }'
    },
    // ... more files
  ],
  expectedDuplicates: 3,
  expectedComplexity: 2.5
};
```

## 🔌 Plugin Development

### Creating a Plugin

1. **Generate Plugin Template**
   ```bash
   pnpm create-plugin my-awesome-plugin
   ```

2. **Plugin Structure**
   ```typescript
   // plugins/my-plugin/src/index.ts
   import { Plugin, PluginContext } from '@wundr/core';

   export class MyPlugin implements Plugin {
     name = 'my-plugin';
     version = '1.0.0';
     description = 'My awesome plugin';

     async initialize(context: PluginContext) {
       // Plugin initialization logic
     }
   }
   ```

3. **Testing Plugins**
   ```bash
   # Test plugin locally
   pnpm plugin:test my-awesome-plugin
   
   # Install plugin for development
   pnpm plugin:link ./plugins/my-awesome-plugin
   ```

### Plugin Guidelines

- Follow the plugin API specification
- Include comprehensive tests
- Provide clear documentation
- Use semantic versioning
- Handle errors gracefully

## 📊 Dashboard Development

### Setting up Dashboard Development

```bash
# Navigate to dashboard package
cd packages/@wundr/dashboard

# Start development server
pnpm dev

# Open in browser
open http://localhost:3001
```

### Dashboard Architecture

- **Next.js 15** with App Router
- **React 19** with concurrent features
- **TypeScript** for type safety
- **Tailwind CSS** for styling
- **D3.js** for visualizations
- **WebSocket** for real-time updates

### Creating New Dashboard Components

1. **Component Structure**
   ```typescript
   // components/my-component/MyComponent.tsx
   import { FC } from 'react';
   import { Card } from '@/components/ui/card';

   interface MyComponentProps {
     data: MyData;
     onUpdate: (data: MyData) => void;
   }

   export const MyComponent: FC<MyComponentProps> = ({ data, onUpdate }) => {
     return (
       <Card>
         {/* Component content */}
       </Card>
     );
   };
   ```

2. **Add Tests**
   ```typescript
   // components/my-component/MyComponent.test.tsx
   import { render, screen } from '@testing-library/react';
   import { MyComponent } from './MyComponent';

   describe('MyComponent', () => {
     it('renders correctly', () => {
       render(<MyComponent data={mockData} onUpdate={mockUpdate} />);
       expect(screen.getByText('Expected Text')).toBeInTheDocument();
     });
   });
   ```

### Visualization Guidelines

- Use D3.js for complex, interactive visualizations
- Use Chart.js for standard charts
- Ensure accessibility (ARIA labels, keyboard navigation)
- Support both light and dark themes
- Make visualizations responsive

## 🤖 AI Integration Development

### Setting up AI Development

```bash
# Set up environment variables
cp .env.example .env.local

# Add your API keys
echo "CLAUDE_API_KEY=your_key_here" >> .env.local
```

### AI Service Guidelines

- Handle API rate limits gracefully
- Implement proper error handling
- Use streaming for long responses
- Cache responses when appropriate
- Support multiple AI providers

### Example AI Integration

```typescript
// ai/providers/claude-provider.ts
import { AIProvider, CodeContext, ReviewResult } from '@wundr/types';

export class ClaudeProvider implements AIProvider {
  async reviewCode(context: CodeContext): Promise<ReviewResult> {
    // Implementation
  }
}
```

## 📚 Documentation Standards

### Documentation Types

1. **API Documentation**: Generated from TypeScript/JSDoc
2. **User Guides**: Markdown files for end users
3. **Developer Guides**: Technical documentation for contributors
4. **Examples**: Working code examples and tutorials

### Documentation Guidelines

- **Clarity**: Write for your target audience
- **Examples**: Include working code examples
- **Structure**: Use consistent formatting and structure
- **Maintenance**: Keep documentation up-to-date with code changes

### Writing Style Guide

- Use active voice
- Write in present tense
- Use clear, concise sentences
- Include code examples
- Use consistent terminology

## 🔍 Code Review Process

### Submitting a Pull Request

1. **Create the PR**
   ```bash
   # Push your branch
   git push origin feature/your-feature-name
   
   # Create PR on GitHub
   # Use the PR template and fill out all sections
   ```

2. **PR Checklist**
   - [ ] Code follows style guidelines
   - [ ] Tests pass and coverage is maintained
   - [ ] Documentation is updated
   - [ ] Changes are backward compatible
   - [ ] Performance impact is acceptable

### What We Look For

- **Code Quality**: Clean, readable, maintainable code
- **Testing**: Comprehensive tests with good coverage
- **Documentation**: Clear documentation for changes
- **Performance**: No performance regressions
- **Security**: No security vulnerabilities introduced

### Review Process

1. **Automated Checks**: CI/CD pipeline runs tests and checks
2. **Code Review**: Team members review your changes
3. **Feedback**: Address any feedback or requested changes
4. **Approval**: Once approved, your PR will be merged

## 🛠️ Development Tools

### Recommended VS Code Extensions

```json
{
  "recommendations": [
    "esbenp.prettier-vscode",
    "bradlc.vscode-tailwindcss",
    "ms-vscode.vscode-typescript-next",
    "streetsidesoftware.code-spell-checker",
    "ms-playwright.playwright",
    "vitest.explorer"
  ]
}
```

### Development Scripts

```bash
# Development
pnpm dev                # Start all development servers
pnpm build             # Build all packages
pnpm clean             # Clean build artifacts

# Testing
pnpm test              # Run all tests
pnpm test:watch        # Watch mode
pnpm test:coverage     # Coverage report

# Code Quality
pnpm lint              # Lint all packages
pnpm format            # Format code
pnpm typecheck         # Type checking

# Package Management
pnpm install           # Install dependencies
pnpm update            # Update dependencies
pnpm audit             # Security audit
```

## 🎉 Recognition

### Contributors

We recognize contributors in several ways:

- **Contributors file**: Listed in CONTRIBUTORS.md
- **Release notes**: Mentioned in release announcements
- **Social media**: Highlighted on our social channels
- **Swag**: Contributor swag for significant contributions

### Contribution Levels

- **First-time contributor**: Welcome package and recognition
- **Regular contributor**: Listed as team contributor
- **Core contributor**: Invited to maintainer discussions
- **Maintainer**: Direct commit access and decision-making

## 📞 Getting Help

### Where to Get Help

1. **Discord Community**: [Join our Discord](https://discord.gg/wundr) for real-time help
2. **GitHub Discussions**: [Community discussions](https://github.com/adapticai/wundr/discussions)
3. **Office Hours**: Weekly community office hours (announced in Discord)
4. **Documentation**: Check our [complete documentation](https://docs.wundr.io)

### Mentorship Program

New contributors can request mentorship:

- **Beginner**: Help with first contribution
- **Intermediate**: Guidance on larger features
- **Advanced**: Architecture and design discussions

## 📋 Contribution Checklist

Before submitting your contribution:

- [ ] Code follows project style guidelines
- [ ] All tests pass locally
- [ ] New functionality includes tests
- [ ] Documentation is updated
- [ ] Commit messages follow conventional format
- [ ] PR description explains the changes
- [ ] Changes are backward compatible
- [ ] Performance impact is considered
- [ ] Security implications are addressed

## 📄 License

By contributing to Wundr, you agree that your contributions will be licensed under the same MIT License that covers the project.

---

Thank you for contributing to Wundr! Your contributions help make development better for everyone. 🚀

If you have any questions, don't hesitate to reach out to our community or maintainers. We're here to help!