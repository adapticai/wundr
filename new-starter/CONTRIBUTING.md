# Contributing to new-starter

First off, thank you for considering contributing to new-starter! It's people like you that make new-starter such a great tool for the developer community.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [How Can I Contribute?](#how-can-i-contribute)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Making Changes](#making-changes)
- [Testing](#testing)
- [Documentation](#documentation)
- [Submitting Changes](#submitting-changes)
- [Style Guidelines](#style-guidelines)
- [Community](#community)

## Code of Conduct

This project and everyone participating in it is governed by our Code of Conduct. By participating, you are expected to uphold this code. Please report unacceptable behavior to support@adapticai.com.

### Our Standards

- Using welcoming and inclusive language
- Being respectful of differing viewpoints and experiences
- Gracefully accepting constructive criticism
- Focusing on what is best for the community
- Showing empathy towards other community members

## Getting Started

1. **Fork the repository** on GitHub
2. **Clone your fork** locally
3. **Set up the development environment** (see below)
4. **Create a branch** for your changes
5. **Make your changes** and commit them
6. **Push to your fork** and submit a pull request

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check existing issues as you might find that you don't need to create one. When you are creating a bug report, please include as many details as possible:

- **Use a clear and descriptive title**
- **Describe the exact steps to reproduce the problem**
- **Provide specific examples**
- **Describe the behavior you observed**
- **Explain which behavior you expected to see**
- **Include screenshots if relevant**
- **Include your environment details**:
  ```bash
  new-starter --version
  node --version
  npm --version
  uname -a  # OS information
  ```

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. When creating an enhancement suggestion, please include:

- **Use a clear and descriptive title**
- **Provide a detailed description of the suggested enhancement**
- **Provide specific examples to demonstrate the enhancement**
- **Describe the current behavior and expected behavior**
- **Explain why this enhancement would be useful**
- **List any alternative solutions you've considered**

### Your First Code Contribution

Unsure where to begin? You can start by looking through these issues:

- Issues labeled `good first issue` - ideal for newcomers
- Issues labeled `help wanted` - need extra attention
- Issues labeled `documentation` - documentation improvements

## Development Setup

### Prerequisites

- Node.js 18 or higher
- npm 9 or higher
- Git
- A GitHub account

### Setup Steps

1. **Fork and clone the repository**:
   ```bash
   git clone https://github.com/YOUR_USERNAME/new-starter.git
   cd new-starter
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Build the project**:
   ```bash
   npm run build
   ```

4. **Run tests**:
   ```bash
   npm test
   ```

5. **Set up git hooks**:
   ```bash
   npm run prepare
   ```

6. **Link for local testing**:
   ```bash
   npm link
   new-starter --version  # Should show local version
   ```

## Project Structure

```
new-starter/
├── bin/                  # CLI entry point
├── src/                  # TypeScript source code
│   ├── commands/         # Command implementations
│   ├── utils/            # Utility functions
│   ├── types/            # TypeScript type definitions
│   └── cli.ts            # Main CLI interface
├── scripts/              # Shell scripts
│   ├── setup/            # Individual setup scripts
│   └── templates/        # File templates
├── tests/                # Test files
├── docs/                 # Documentation
└── .github/              # GitHub specific files
    └── workflows/        # CI/CD workflows
```

## Making Changes

### Branch Naming

Use descriptive branch names:
- `feat/add-rust-support` - New features
- `fix/docker-installation` - Bug fixes
- `docs/improve-api-docs` - Documentation
- `refactor/setup-command` - Code refactoring
- `test/validate-command` - Test improvements
- `chore/update-deps` - Maintenance tasks

### Commit Messages

Follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>(<scope>): <subject>

<body>

<footer>
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Test changes
- `chore`: Maintenance tasks
- `perf`: Performance improvements

Examples:
```bash
feat(setup): add support for Rust development tools
fix(docker): resolve permission issues on Linux
docs(api): improve TypeScript examples
```

### Development Workflow

1. **Create a feature branch**:
   ```bash
   git checkout -b feat/my-feature
   ```

2. **Make your changes**:
   - Write code
   - Add/update tests
   - Update documentation

3. **Test your changes**:
   ```bash
   npm test
   npm run lint
   npm run type-check
   npm run build
   ```

4. **Test locally**:
   ```bash
   npm link
   new-starter setup --dry-run
   ```

5. **Commit your changes**:
   ```bash
   git add .
   git commit -m "feat: add amazing feature"
   ```

6. **Push to your fork**:
   ```bash
   git push origin feat/my-feature
   ```

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
npm test -- src/commands/setup.test.ts

# Run tests matching pattern
npm test -- --testNamePattern="SetupCommand"
```

### Writing Tests

Place test files next to the code they test:
- `src/commands/setup.ts` → `src/commands/setup.test.ts`

Example test:
```typescript
import { describe, it, expect, jest } from '@jest/globals';
import { SetupCommand } from './setup';

describe('SetupCommand', () => {
  it('should validate required options', () => {
    const command = new SetupCommand({
      email: 'test@example.com'
    });
    
    expect(() => command.validateOptions()).not.toThrow();
  });
  
  it('should handle missing email', () => {
    const command = new SetupCommand({});
    
    expect(() => command.validateOptions()).toThrow('Email is required');
  });
});
```

### Testing Shell Scripts

For shell scripts, create corresponding test scripts:
```bash
#!/bin/bash
# tests/scripts/test_node_setup.sh

source scripts/setup/02-node.sh

# Test NVM installation
test_nvm_install() {
  install_nvm
  [ -f "$HOME/.nvm/nvm.sh" ] || exit 1
}

# Run tests
test_nvm_install
echo "All tests passed!"
```

## Documentation

### Documentation Structure

- `README.md` - Project overview and quick start
- `docs/setup.md` - Detailed setup guide
- `docs/configuration.md` - Configuration options
- `docs/troubleshooting.md` - Common issues and solutions
- `docs/api.md` - API reference for programmatic usage
- `CONTRIBUTING.md` - This file

### Writing Documentation

- Use clear, concise language
- Include code examples
- Add screenshots for UI elements
- Keep formatting consistent
- Test all examples before committing

### Generating API Documentation

```bash
npm run docs:generate
```

## Submitting Changes

### Pull Request Process

1. **Update documentation** for any changed functionality
2. **Add tests** for new features
3. **Ensure all tests pass**:
   ```bash
   npm test
   npm run lint
   npm run type-check
   ```
4. **Update the changelog** if applicable
5. **Create a pull request** with a clear title and description

### Pull Request Template

```markdown
## Description
Brief description of the changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Tests pass locally
- [ ] Added new tests
- [ ] Tested manually

## Checklist
- [ ] My code follows the style guidelines
- [ ] I have performed a self-review
- [ ] I have commented my code where necessary
- [ ] I have updated the documentation
- [ ] My changes generate no new warnings
- [ ] I have added tests that prove my fix/feature works
```

### Code Review Process

1. At least one maintainer must review the PR
2. All CI checks must pass
3. No merge conflicts
4. Documentation is updated
5. Tests are included and passing

## Style Guidelines

### TypeScript Style

We use ESLint and Prettier for code formatting:

```bash
# Format code
npm run format

# Check linting
npm run lint

# Fix linting issues
npm run lint:fix
```

Key style points:
- Use TypeScript strict mode
- Prefer `const` over `let`
- Use template literals for string interpolation
- Add type annotations for function parameters and return types
- Use async/await over promises when possible
- Keep functions small and focused

### Shell Script Style

- Use `#!/bin/bash` shebang
- Set error handling: `set -euo pipefail`
- Use functions for reusable code
- Add meaningful comments
- Use descriptive variable names
- Quote variables: `"$VAR"` not `$VAR`

Example:
```bash
#!/bin/bash
set -euo pipefail

# Function to install a tool
install_tool() {
  local tool_name="$1"
  echo "Installing ${tool_name}..."
  # Installation logic here
}

# Main execution
main() {
  install_tool "nodejs"
}

main "$@"
```

## Community

### Getting Help

- **GitHub Discussions**: Ask questions and share ideas
- **GitHub Issues**: Report bugs and request features
- **Discord**: Join our community chat (if available)
- **Email**: support@adapticai.com

### Recognition

Contributors are recognized in:
- The project README
- Release notes
- Our website (if applicable)

## Release Process

Maintainers follow this process:

1. **Create a changeset**:
   ```bash
   npm run changeset
   ```

2. **Version packages**:
   ```bash
   npm run version
   ```

3. **Review and merge the version PR**

4. **Publish to npm**:
   ```bash
   npm run release
   ```

## Additional Resources

- [TypeScript Documentation](https://www.typescriptlang.org/docs/)
- [Node.js Best Practices](https://github.com/goldbergyoni/nodebestpractices)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [Semantic Versioning](https://semver.org/)

## License

By contributing to new-starter, you agree that your contributions will be licensed under its MIT License.

## Questions?

Feel free to open an issue with the `question` label or reach out to the maintainers directly.

Thank you for contributing to new-starter! 🎉