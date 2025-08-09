# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Initial release of @adapticai/new-starter
- CLI tool for automated development environment setup
- Support for macOS and Linux
- Installation of development tools:
  - Homebrew package manager
  - Node.js via NVM (versions 18, 20, 22)
  - npm, pnpm, yarn package managers
  - Docker Desktop
  - Git and GitHub CLI
  - VS Code with curated extensions
  - Slack
  - Claude Code and Claude Flow with AI orchestration
- TypeScript implementation
- Comprehensive test suite
- CI/CD with GitHub Actions
- Automated npm publishing
- Interactive and non-interactive modes
- Configuration management
- Environment validation

### Features
- `setup` command for environment installation
- `validate` command for checking installations
- `config` command for managing settings
- Support for custom root directories
- Tool selection and exclusion options
- Automatic permission fixes
- Progress tracking with spinners
- Colored terminal output
- Verbose and quiet modes

## [0.1.0] - 2024-01-XX

### Added
- Initial beta release

[Unreleased]: https://github.com/adapticai/new-starter/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/adapticai/new-starter/releases/tag/v0.1.0