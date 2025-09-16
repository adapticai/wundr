# Frequently Asked Questions

Find answers to common questions about Wundr.

## General Questions

### What is Wundr?

Wundr is an intelligent CLI-based coding agents orchestrator that helps teams maintain code quality, enforce patterns, and collaborate effectively on software projects.

### Is Wundr free to use?

Yes, Wundr is open source and free for personal and commercial use under the MIT license.

### What programming languages does Wundr support?

Wundr supports:
- JavaScript/TypeScript
- Python
- Java
- C#
- Go
- Rust
- And more through extensible analyzers

## Installation & Setup

### What are the system requirements?

- Node.js 16+
- npm 7+ or pnpm 6+
- Git (for repository features)
- 4GB+ RAM recommended for large projects

### Can I use Wundr with existing tools?

Yes, Wundr integrates with:
- CI/CD pipelines (GitHub Actions, Jenkins, GitLab CI)
- IDEs (VS Code, IntelliJ, vim)
- Version control systems (Git, SVN)
- Project management tools

## Configuration

### How do I customize analysis rules?

Create a `wundr.config.json` file in your project root:

```json
{
  "analysis": {
    "depth": "deep",
    "rules": {
      "complexity": "moderate",
      "patterns": "strict"
    }
  }
}
```

### Can I create custom patterns?

Yes, Wundr supports custom pattern development. See our [Pattern Development Guide](/guides/advanced/pattern-development).

## Usage

### How do I run analysis on my project?

```bash
# Basic analysis
wundr analyze

# Detailed analysis with reporting
wundr analyze --detailed --report
```

### Can I integrate Wundr with my CI/CD pipeline?

Yes, run Wundr in CI mode:

```bash
wundr analyze --ci --fail-on-violations
```

## Team Collaboration

### How do I set up Wundr for my team?

1. Create shared configuration
2. Set team standards
3. Configure notifications
4. Integrate with your workflow

See our [Team Collaboration Guide](./team/collaboration).

### Can multiple developers work with the same configuration?

Yes, commit your `wundr.config.json` to version control and all team members will use the same settings.

## Performance

### Wundr is slow on my large project. How can I optimize it?

1. Exclude unnecessary directories
2. Use incremental analysis
3. Increase memory allocation
4. Enable parallel processing

See [Performance Optimization](/guides/advanced/performance-optimization).

### How much memory does Wundr need?

- Small projects (< 1000 files): 512MB
- Medium projects (1000-10000 files): 2GB
- Large projects (> 10000 files): 4GB+

## Troubleshooting

### Wundr command not found

Ensure Wundr is installed globally:

```bash
npm install -g @wundr/cli
```

Add npm global directory to your PATH if needed.

### Configuration errors

Validate your configuration:

```bash
wundr config validate
```

## Getting Help

Still need help?

- Check our [Troubleshooting Guide](./troubleshooting/common-issues)
- Browse [GitHub Discussions](https://github.com/adapticai/wundr/discussions)
- Join our [Discord Community](https://discord.gg/wundr)
- Email us at support@wundr.io