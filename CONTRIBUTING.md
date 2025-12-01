# Contributing to Monorepo Refactoring Toolkit

Thank you for your interest in contributing to the Monorepo Refactoring Toolkit! This document
provides guidelines and information for contributors.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Contributing Guidelines](#contributing-guidelines)
- [Submitting Changes](#submitting-changes)
- [Coding Standards](#coding-standards)
- [Testing](#testing)
- [Documentation](#documentation)

## Code of Conduct

This project adheres to a [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected
to uphold this code.

## Getting Started

1. Fork the repository on GitHub
2. Clone your fork locally
3. Create a new branch for your feature or bug fix
4. Make your changes
5. Test your changes
6. Submit a pull request

## Development Setup

### Prerequisites

- Node.js 18.0 or higher
- npm 8.0 or higher (or yarn/pnpm equivalent)
- Git

### Installation

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/monorepo-refactoring-toolkit.git
cd monorepo-refactoring-toolkit

# Install dependencies
npm install

# Set up git hooks
npm run prepare

# Verify setup
npm run verify-setup
```

### Project Structure

```
monorepo-refactoring-toolkit/
├── docs/           # Documentation
├── scripts/        # Analysis and refactoring scripts
├── config/         # Configuration files
├── templates/      # Templates for new packages/services
├── tools/          # Additional tooling
├── examples/       # Example patterns and anti-patterns
└── setup/          # Setup and installation scripts
```

## Contributing Guidelines

### Types of Contributions

We welcome the following types of contributions:

- **Bug fixes**: Fix issues in existing functionality
- **Feature enhancements**: Improve existing features
- **New features**: Add new analysis or refactoring capabilities
- **Documentation**: Improve or add documentation
- **Examples**: Add new patterns or anti-patterns
- **Tests**: Improve test coverage
- **Tools**: Add new development or analysis tools

### Before You Start

1. Check existing [issues](https://github.com/YOUR_ORG/monorepo-refactoring-toolkit/issues) to see
   if your idea is already being discussed
2. Create an issue to discuss major changes before implementing them
3. Look for issues labeled `good first issue` or `help wanted` if you're new to the project

## Submitting Changes

### Branch Naming

Use descriptive branch names:

- `feature/add-circular-dependency-detection`
- `fix/ast-analyzer-memory-leak`
- `docs/update-quick-start-guide`
- `refactor/consolidation-manager-cleanup`

### Commit Messages

We use [Conventional Commits](https://conventionalcommits.org/) format:

```
type(scope): description

[optional body]

[optional footer]
```

**Types:**

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

**Examples:**

```
feat(analyzer): add circular dependency detection
fix(consolidation): resolve memory leak in batch processing
docs(readme): update installation instructions
test(analyzer): add tests for similarity detection
```

### Pull Request Process

1. **Create a Pull Request**
   - Use a clear and descriptive title
   - Fill out the PR template completely
   - Link related issues using keywords (e.g., "Closes #123")

2. **PR Requirements**
   - All tests must pass
   - Code coverage should not decrease
   - Documentation should be updated if needed
   - Changes should be backward compatible when possible

3. **Review Process**
   - At least one maintainer review is required
   - Address all feedback before merging
   - Maintain a clean commit history (squash if necessary)

## Coding Standards

### TypeScript/JavaScript

- Use TypeScript for all new code
- Follow existing code style (enforced by ESLint and Prettier)
- Use meaningful variable and function names
- Add JSDoc comments for public APIs
- Prefer functional programming patterns where appropriate

```typescript
/**
 * Analyzes TypeScript files for duplicate interfaces
 * @param filePaths - Array of file paths to analyze
 * @param options - Analysis options
 * @returns Analysis results with similarity scores
 */
export async function analyzeDuplicateInterfaces(
  filePaths: string[],
  options: AnalysisOptions = {}
): Promise<AnalysisResult> {
  // Implementation
}
```

### Shell Scripts

- Use `#!/bin/bash` shebang
- Use `set -e` for error handling
- Add comments for complex logic
- Use meaningful variable names in UPPER_CASE

```bash
#!/bin/bash
set -e

# Configuration
OUTPUT_DIR="analysis-output"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

echo "Starting analysis at $TIMESTAMP"
```

### File Organization

- Keep files focused and single-responsibility
- Use barrel exports (`index.ts`) for clean imports
- Organize related functionality into directories
- Keep configuration files in the `config/` directory

## Testing

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm test -- analyzer.test.ts
```

### Writing Tests

- Write tests for all new functionality
- Use descriptive test names
- Follow the Arrange-Act-Assert pattern
- Mock external dependencies

```typescript
describe('SimilarityDetector', () => {
  it('should identify highly similar interfaces with 90%+ similarity', () => {
    // Arrange
    const interfaces = [mockInterface1, mockInterface2];

    // Act
    const result = detector.findSimilarities(interfaces);

    // Assert
    expect(result).toHaveLength(1);
    expect(result[0].similarity).toBeGreaterThan(0.9);
  });
});
```

### Test Categories

- **Unit tests**: Test individual functions/classes
- **Integration tests**: Test component interactions
- **E2E tests**: Test complete workflows
- **Performance tests**: Test analysis speed and memory usage

## Documentation

### Types of Documentation

1. **Code Documentation**
   - JSDoc comments for public APIs
   - Inline comments for complex logic
   - README files for individual modules

2. **User Documentation**
   - Usage guides in `docs/guides/`
   - Examples in `examples/`
   - API documentation

3. **Developer Documentation**
   - Architecture decisions in `docs/architecture/`
   - Contributing guidelines (this file)
   - Setup and development guides

### Documentation Standards

- Use clear, concise language
- Include code examples where helpful
- Keep documentation up-to-date with code changes
- Use Markdown for all documentation files

## Development Workflow

### Daily Development

```bash
# Start development
git pull origin main
git checkout -b feature/your-feature-name

# Make changes
# ... edit files ...

# Test changes
npm test
npm run lint
npm run type-check

# Commit changes
git add .
git commit -m "feat(analyzer): add new similarity algorithm"

# Push and create PR
git push origin feature/your-feature-name
```

### Before Submitting PR

```bash
# Ensure all checks pass
npm run ci:all

# Update documentation if needed
# ... update docs ...

# Rebase on latest main
git fetch origin
git rebase origin/main

# Push final version
git push --force-with-lease origin feature/your-feature-name
```

### Code Review Checklist

**For Contributors:**

- [ ] Tests added/updated and passing
- [ ] Documentation updated
- [ ] Code follows project standards
- [ ] No breaking changes (or properly documented)
- [ ] PR description is clear and complete

**For Reviewers:**

- [ ] Code is well-structured and readable
- [ ] Tests adequately cover new functionality
- [ ] Documentation is accurate and helpful
- [ ] Performance implications considered
- [ ] Security implications considered

## Release Process

### Versioning

We use [Semantic Versioning](https://semver.org/):

- **MAJOR**: Breaking changes
- **MINOR**: New features (backward compatible)
- **PATCH**: Bug fixes (backward compatible)

### Release Checklist

1. Update CHANGELOG.md
2. Update version in package.json
3. Create release notes
4. Tag release
5. Publish to npm (if applicable)

## Getting Help

### Communication Channels

- **GitHub Issues**: Bug reports and feature requests
- **GitHub Discussions**: General questions and community discussion
- **Pull Requests**: Code review and discussion

### Maintainer Response Times

- **Bug reports**: Within 48 hours
- **Feature requests**: Within 1 week
- **Pull requests**: Within 1 week
- **Security issues**: Within 24 hours

### Questions?

If you have questions that aren't answered here:

1. Check existing [GitHub Issues](https://github.com/YOUR_ORG/monorepo-refactoring-toolkit/issues)
2. Search [GitHub Discussions](https://github.com/YOUR_ORG/monorepo-refactoring-toolkit/discussions)
3. Create a new issue or discussion

## Recognition

Contributors are recognized in:

- CHANGELOG.md for each release
- README.md contributors section
- GitHub contributors graph

Thank you for contributing to the Monorepo Refactoring Toolkit! 🎉
