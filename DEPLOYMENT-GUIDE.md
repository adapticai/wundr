# 🚀 Wundr Platform Deployment Guide

## Publishing Strategy for Adaptic AI / AdapticAI

This guide provides comprehensive instructions for publishing the Wundr platform packages on behalf of **AdapticAI** (GitHub) and **@adaptic** (npm).

---

## 📦 NPM Publishing Setup

### 1. Organization Setup

First, ensure the npm organization is properly configured:

```bash
# Login to npm (if not already)
npm login

# Create organization (if not exists)
npm org create adaptic

# Or use existing @adapticai scope
npm org create adapticai
```

### 2. Package Scoping

Update all package.json files to use the correct scope:

```bash
# Quick script to update all packages
find packages -name "package.json" -exec sed -i '' 's/"name": "@wundr\//"name": "@adaptic\//g' {} \;

# Or for @adapticai scope
find packages -name "package.json" -exec sed -i '' 's/"name": "@wundr\//"name": "@adapticai\//g' {} \;
```

### 3. Publishing Configuration

Add to root `package.json`:

```json
{
  "publishConfig": {
    "access": "public",
    "registry": "https://registry.npmjs.org/"
  }
}
```

### 4. Automated Publishing

```bash
# Publish all packages with Lerna (recommended)
npm install -g lerna
lerna publish --scope @adaptic/* --access public

# Or use the CI/CD workflow
git tag v1.0.0
git push origin v1.0.0
# This triggers enterprise-release.yml workflow
```

---

## 🐙 GitHub Organization Setup

### 1. Transfer or Fork Repository

#### Option A: Transfer Repository
```bash
# In GitHub Settings > General > Danger Zone
# Transfer ownership to adapticai organization
```

#### Option B: Create Organization Fork
```bash
# Fork to adapticai organization
gh repo fork . --org adapticai --clone

# Update remote
git remote set-url origin https://github.com/adapticai/wundr.git
git push -u origin master
```

### 2. GitHub Packages Setup

Configure GitHub Packages for container registry:

```bash
# Login to GitHub Container Registry
echo $GITHUB_TOKEN | docker login ghcr.io -u USERNAME --password-stdin

# Build and push containers
docker build -t ghcr.io/adapticai/wundr:latest .
docker push ghcr.io/adapticai/wundr:latest
```

### 3. GitHub Actions Secrets

Set up these secrets in GitHub repository settings:

```yaml
NPM_TOKEN: npm_xxx...           # npm automation token
DOCKER_USERNAME: adaptic         # Docker Hub username
DOCKER_PASSWORD: xxx...          # Docker Hub password
GITHUB_TOKEN: ghp_xxx...         # GitHub PAT with packages:write
SLACK_WEBHOOK_URL: https://...  # Slack notifications (optional)
CODECOV_TOKEN: xxx...            # Codecov integration (optional)
```

---

## 🎯 Publishing Checklist

### Pre-Publishing Steps

```bash
# 1. Update package versions
npm version patch --workspaces

# 2. Run comprehensive checks
npm run build
npm run test
npm run lint

# 3. Update CHANGELOG
echo "## v1.0.0 - $(date +%Y-%m-%d)" >> CHANGELOG.md
echo "- Initial public release" >> CHANGELOG.md

# 4. Verify package contents
npm pack --dry-run --workspaces
```

### Publishing Commands

#### Manual Publishing
```bash
# Individual package
cd packages/@wundr/core
npm publish --access public --tag latest

# All packages with npm workspaces
npm publish --workspaces --access public

# With Turborepo
turbo run publish
```

#### Automated Publishing (Recommended)
```bash
# Create release tag
git tag -a v1.0.0 -m "Release v1.0.0: Initial public release"
git push origin v1.0.0

# This triggers the enterprise-release.yml workflow which:
# - Builds all packages
# - Runs tests
# - Publishes to npm
# - Creates GitHub release
# - Builds and pushes Docker images
```

---

## 🐳 Docker Hub Deployment

### Setup Docker Hub Repository

```bash
# Login to Docker Hub
docker login -u adaptic

# Build multi-platform image
docker buildx create --use
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -t adaptic/wundr:latest \
  -t adaptic/wundr:1.0.0 \
  --push .
```

### Docker Compose for Users

Create `docker-compose.yml`:

```yaml
version: '3.8'
services:
  wundr:
    image: adaptic/wundr:latest
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
    volumes:
      - ./config:/app/config
```

---

## 📚 Package Registry Configuration

### For npm Users

```bash
# Install individual packages
npm install @adaptic/core
npm install @adaptic/security
npm install @adaptic/analysis-engine

# Install CLI globally
npm install -g @adaptic/cli
```

### For GitHub Packages Users

Create `.npmrc`:

```
@adapticai:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```

Then install:

```bash
npm install @adapticai/wundr-core
```

---

## 🌐 Domain & Documentation

### 1. Documentation Site

Deploy documentation to GitHub Pages:

```bash
# Build docs
cd packages/@wundr/docs
npm run build

# Deploy to GitHub Pages
npm run deploy
```

Access at: `https://adapticai.github.io/wundr/`

### 2. Custom Domain (Optional)

Add CNAME file to docs:
```
docs.adaptic.ai
```

Configure DNS:
```
A     @     185.199.108.153
A     @     185.199.109.153
CNAME www   adapticai.github.io
```

---

## 🔒 Security & Compliance

### Package Signing

```bash
# Sign packages with npm
npm install -g npm-sigstore
npm sigstore sign @adaptic/core

# Verify signatures
npm sigstore verify @adaptic/core
```

### License Compliance

Ensure LICENSE file is present:

```markdown
MIT License

Copyright (c) 2024 Adaptic AI

Permission is hereby granted...
```

### Security Scanning

```bash
# Run security audit
npm audit --workspaces

# Fix vulnerabilities
npm audit fix --workspaces

# Check licenses
npx license-checker --production --summary
```

---

## 📊 Release Management

### Semantic Versioning

Follow semantic versioning:
- **MAJOR** (1.0.0): Breaking changes
- **MINOR** (0.1.0): New features
- **PATCH** (0.0.1): Bug fixes

### Release Process

```bash
# 1. Create release branch
git checkout -b release/v1.0.0

# 2. Update versions
lerna version --conventional-commits

# 3. Create PR
gh pr create --title "Release v1.0.0" --body "Release notes..."

# 4. Merge and tag
git checkout master
git merge release/v1.0.0
git tag v1.0.0
git push origin master --tags

# 5. GitHub Release (automated via CI/CD)
```

---

## 🎉 Quick Start for Users

Once published, users can get started with:

```bash
# Install CLI
npm install -g @adaptic/cli

# Initialize new project
adaptic init my-project

# Install core packages
npm install @adaptic/core @adaptic/security

# Run analysis
adaptic analyze ./src

# Start dashboard
adaptic dashboard
```

---

## 📝 Marketing & Announcement

### Package README Template

```markdown
# @adaptic/[package-name]

> Enterprise-grade [description] by Adaptic AI

[![npm](https://img.shields.io/npm/v/@adaptic/core)](https://www.npmjs.com/package/@adaptic/core)
[![CI](https://github.com/adapticai/wundr/workflows/CI/badge.svg)](https://github.com/adapticai/wundr/actions)
[![Coverage](https://codecov.io/gh/adapticai/wundr/branch/master/graph/badge.svg)](https://codecov.io/gh/adapticai/wundr)

## Installation

\`\`\`bash
npm install @adaptic/[package-name]
\`\`\`

## Documentation

Visit [docs.adaptic.ai](https://docs.adaptic.ai)

## License

MIT © Adaptic AI
```

### Social Media Announcement

```
🚀 Introducing Wundr by @AdapticAI

Enterprise-grade development platform featuring:
✅ Advanced code analysis
✅ Security scanning
✅ AI-powered automation
✅ 80+ specialized agents

Now available on npm: @adaptic/*

Get started: npm install -g @adaptic/cli

#OpenSource #DevTools #AI #TypeScript
```

---

## 🆘 Support & Contact

- **GitHub Issues**: https://github.com/adapticai/wundr/issues
- **Discord**: https://discord.gg/adapticai
- **Email**: support@adaptic.ai
- **Documentation**: https://docs.adaptic.ai

---

## ✅ Final Deployment Checklist

- [ ] Update all package.json files with @adaptic scope
- [ ] Configure npm organization and access
- [ ] Set up GitHub Actions secrets
- [ ] Create initial release tag
- [ ] Publish to npm registry
- [ ] Push Docker images
- [ ] Deploy documentation
- [ ] Update README with badges
- [ ] Announce on social media
- [ ] Monitor initial user feedback

---

*This deployment guide ensures the Wundr platform is properly published and accessible to the developer community under the Adaptic AI brand.*
