# 📦 NPM Deployment Guide for @wundr.io

This guide explains how to deploy all Wundr packages to npm under the **@wundr.io** organization.

## 🚀 Quick Start

### Prerequisites

1. **NPM Token**: Ensure `NPM_TOKEN` is set in GitHub repository secrets
   - Go to: Settings → Secrets and variables → Actions
   - Add `NPM_TOKEN` with your npm automation token

2. **NPM Organization**: Create the @wundr.io organization on npmjs.com
   ```bash
   npm login
   npm org create wundr.io
   ```

### Deployment Methods

#### Method 1: Tag-based Release (Recommended)

```bash
# Create and push a version tag
git tag v1.0.0
git push origin v1.0.0
```

This automatically triggers the workflow to:

- Update all packages to @wundr.io scope
- Build all packages
- Publish to npm
- Create GitHub release

#### Method 2: Manual Workflow Dispatch

1. Go to Actions → "📦 NPM Publish @wundr.io"
2. Click "Run workflow"
3. Select:
   - Branch: `master`
   - Release type: `patch`, `minor`, `major`, or `prerelease`
   - Dry run: Leave unchecked for actual publishing

## 📋 Package Updates

### Automated Scope Migration

The workflow automatically updates all packages from `@wundr/*` to `@wundr.io/*`:

```bash
# Run locally to preview changes
node scripts/update-package-scope.js
```

### Published Packages

The following packages will be published to npm:

| Original Name            | NPM Package                 |
| ------------------------ | --------------------------- |
| @wundr/cli               | @wundr.io/cli               |
| @wundr/core              | @wundr.io/core              |
| @wundr/analysis-engine   | @wundr.io/analysis-engine   |
| @wundr/security          | @wundr.io/security          |
| @wundr/dashboard         | @wundr.io/dashboard         |
| @wundr/ai-integration    | @wundr.io/ai-integration    |
| @wundr/environment       | @wundr.io/environment       |
| @wundr/computer-setup    | @wundr.io/computer-setup    |
| @wundr/config            | @wundr.io/config            |
| @wundr/plugin-system     | @wundr.io/plugin-system     |
| @wundr/project-templates | @wundr.io/project-templates |
| @wundr/docs              | @wundr.io/docs              |

## 🔧 Workflow Details

### GitHub Actions Workflow: `.github/workflows/npm-publish.yml`

The workflow performs these steps:

1. **Prepare Release**
   - Determines version from tag or input
   - Lists all publishable packages

2. **Update Packages**
   - Updates all package scopes to @wundr.io
   - Sets consistent versions
   - Builds all packages

3. **Publish to NPM**
   - Publishes each package with public access
   - Uses NPM_TOKEN for authentication
   - Verifies publication success

4. **Create GitHub Release**
   - Generates release notes
   - Lists all published packages
   - Provides installation instructions

## 🔐 Security Setup

### NPM Token Configuration

1. Create an automation token on npmjs.com:

   ```
   npm.com → Account Settings → Access Tokens → Generate New Token
   - Type: Automation
   - Scope: Read and Publish
   ```

2. Add to GitHub repository secrets:
   ```
   Repository → Settings → Secrets → Actions → New repository secret
   Name: NPM_TOKEN
   Value: [your npm token]
   ```

### Organization Access

Ensure the npm token has access to the @wundr.io organization:

```bash
# Add member (if needed)
npm org set wundr.io [username] admin
```

## 📝 Manual Package Update

To manually update package scopes before publishing:

```bash
# Install dependencies
pnpm install

# Run the update script
node scripts/update-package-scope.js

# Review changes
git diff

# Commit changes
git add -A
git commit -m "chore: migrate packages to @wundr.io scope"
git push
```

## 🧪 Testing Installation

After publishing, test the packages:

```bash
# Install CLI globally
npm install -g @wundr.io/cli

# Verify installation
wundr --version

# Install specific packages
npm install @wundr.io/core
npm install @wundr.io/analysis-engine
```

## 🚨 Troubleshooting

### Common Issues

1. **"Package not found" error**
   - Wait 1-2 minutes for npm registry to update
   - Verify organization exists: `npm org ls wundr.io`

2. **"Unauthorized" error**
   - Check NPM_TOKEN is valid
   - Ensure token has publish permissions
   - Verify organization membership

3. **Build failures**
   - Run `pnpm build` locally to test
   - Check TypeScript errors: `pnpm typecheck`
   - Ensure all dependencies are installed

### Verification Commands

```bash
# Check published versions
npm view @wundr.io/cli versions

# List all org packages
npm search @wundr.io/

# View package info
npm info @wundr.io/core
```

## 📊 Post-Deployment

### Checklist

- [ ] All packages published successfully
- [ ] GitHub release created
- [ ] Installation tested
- [ ] Documentation updated
- [ ] Team notified

### Next Steps

1. Update documentation with new package names
2. Update README.md installation instructions
3. Notify users of the new @wundr.io scope
4. Update any dependent projects

## 🔗 Resources

- [NPM Organization](https://www.npmjs.com/org/wundr.io)
- [GitHub Repository](https://github.com/adapticai/wundr)
- [GitHub Actions](https://github.com/adapticai/wundr/actions)
- [Deployment Workflow](https://github.com/adapticai/wundr/blob/master/.github/workflows/npm-publish.yml)

---

For questions or issues, please open an issue on
[GitHub](https://github.com/adapticai/wundr/issues).
