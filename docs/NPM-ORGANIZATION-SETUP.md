# NPM Organization Setup Guide for @wundr.io

**Version:** 1.0.0 **Organization:** @wundr.io **Repository:** https://github.com/adapticai/wundr

---

## 🎯 Overview

This guide walks you through setting up the `@wundr.io` npm organization and configuring automated
publishing from GitHub Actions.

---

## 📋 Prerequisites

- Admin access to the GitHub repository
- Access to create an npm account
- Payment method for npm organization (if needed)

---

## Step 1: Create NPM Account

### 1.1 Sign Up for NPM

1. Go to https://www.npmjs.com/signup
2. Create an account with your email
3. Verify your email address
4. Complete 2FA setup (required for publishing)

### 1.2 Enable Two-Factor Authentication

**Required for publishing scoped packages**

1. Go to https://www.npmjs.com/settings/[username]/profile
2. Click "Two-Factor Authentication"
3. Choose "Authorization and Publishing" (most secure)
4. Scan QR code with authenticator app
5. Save recovery codes securely

---

## Step 2: Create NPM Organization

### 2.1 Create the @wundr.io Organization

1. Go to https://www.npmjs.com/org/create
2. Enter organization name: `wundr.io`
3. Select plan:
   - **Free**: 0 private packages, unlimited public packages
   - **Paid**: Private packages available
4. For open-source, select **Free**
5. Click "Create"

### 2.2 Organization Settings

1. Go to https://www.npmjs.com/settings/wundr.io/packages
2. Set default package access: **Public**
3. Add team members if needed
4. Configure organization profile

---

## Step 3: Generate NPM Access Token

### 3.1 Create Automation Token

1. Go to https://www.npmjs.com/settings/[username]/tokens
2. Click "Generate New Token"
3. Select token type: **Automation**
   - Allows CI/CD publishing
   - Does not require 2FA for each publish
4. Name it: `GitHub Actions - Wundr`
5. Copy the token **immediately** (shown only once)

**Token format:**

```
npm_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### 3.2 Save Token Securely

⚠️ **NEVER commit this token to git**

Store it temporarily in a secure password manager or encrypted note.

---

## Step 4: Configure GitHub Secrets

### 4.1 Add NPM_TOKEN Secret

1. Go to GitHub repository: https://github.com/adapticai/wundr
2. Navigate to **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Name: `NPM_TOKEN`
5. Value: Paste your npm automation token
6. Click **Add secret**

### 4.2 Verify Secret

1. Go to **Settings** → **Secrets and variables** → **Actions**
2. Confirm `NPM_TOKEN` is listed
3. Note: You cannot view the secret value after creation

---

## Step 5: Configure Package Publishing

### 5.1 Update Package.json Files

All packages should have:

```json
{
  "name": "@wundr.io/package-name",
  "version": "1.0.0",
  "description": "Package description",
  "publishConfig": {
    "access": "public",
    "registry": "https://registry.npmjs.org/"
  },
  "repository": {
    "type": "git",
    "url": "https://github.com/adapticai/wundr.git",
    "directory": "packages/@wundr/package-name"
  },
  "license": "MIT",
  "files": ["dist", "README.md", "LICENSE"]
}
```

### 5.2 Mark Private Packages

For packages you don't want to publish:

```json
{
  "name": "@wundr.io/internal-tools",
  "private": true
}
```

---

## Step 6: Test Publishing

### 6.1 Manual Test Publish

Before relying on automation, test manually:

```bash
# Build the package
cd packages/@wundr/cli
pnpm build

# Dry run to see what would be published
npm pack --dry-run

# Test publish (this WILL publish to npm)
npm publish --access public
```

### 6.2 Verify on NPM

1. Go to https://www.npmjs.com/package/@wundr.io/cli
2. Verify package appears
3. Check package contents
4. Test installation:
   ```bash
   npm install -g @wundr.io/cli@latest
   ```

---

## Step 7: Automated Publishing Workflows

### 7.1 Available Workflows

**1. Auto-Publish on Master Push** (`.github/workflows/npm-publish-auto.yml`)

- Triggers: Push to `master` branch with package changes
- Publishes: Development versions with tag `dev`
- Version format: `1.0.0-dev.20231121123045.abc123`

**2. Release Publishing** (`.github/workflows/npm-publish.yml`)

- Triggers: Creating a git tag (`v1.0.0`) or manual workflow
- Publishes: Stable releases with tag `latest`
- Version format: `1.0.0`

### 7.2 Workflow Triggers

**Auto-Publish:**

```bash
# Any push to master with package changes auto-publishes
git push origin master
```

**Release Publishing:**

```bash
# Create and push a tag
git tag v1.0.0
git push origin v1.0.0

# OR use GitHub UI to create a release
# OR manually trigger workflow from Actions tab
```

---

## Step 8: Version Management

### 8.1 Development Versions

Auto-published on every master commit:

```bash
npm install @wundr.io/cli@dev
```

### 8.2 Stable Releases

Published when creating a release:

```bash
# Patch release (1.0.0 → 1.0.1)
npm version patch
git push && git push --tags

# Minor release (1.0.0 → 1.1.0)
npm version minor
git push && git push --tags

# Major release (1.0.0 → 2.0.0)
npm version major
git push && git push --tags
```

### 8.3 Pre-releases

```bash
# Create pre-release
npm version prerelease --preid=beta
# Creates: 1.0.0-beta.0

git push && git push --tags
```

---

## Step 9: Verification Checklist

After setup, verify:

- [ ] NPM account created and email verified
- [ ] 2FA enabled on npm account
- [ ] Organization `@wundr.io` created
- [ ] Automation token generated
- [ ] `NPM_TOKEN` secret added to GitHub
- [ ] Package.json files have correct scope
- [ ] Manual test publish successful
- [ ] Auto-publish workflow runs on push
- [ ] Packages visible on https://www.npmjs.com/org/wundr.io

---

## 📊 Monitoring Publications

### NPM Registry

View all published packages:

- Organization: https://www.npmjs.com/org/wundr.io
- Individual package: https://www.npmjs.com/package/@wundr.io/cli

### GitHub Actions

Monitor publishing workflows:

- Actions tab: https://github.com/adapticai/wundr/actions
- Workflow: "📦 Auto Publish to NPM"
- Workflow: "📦 NPM Publish @wundr.io"

### Download Statistics

Check package downloads:

```bash
npm info @wundr.io/cli
```

Or visit: https://www.npmjs.com/package/@wundr.io/cli

---

## 🔧 Troubleshooting

### Issue: "You must sign in to publish packages"

**Cause:** NPM_TOKEN not configured or invalid

**Solution:**

1. Regenerate npm token
2. Update GitHub secret `NPM_TOKEN`
3. Retry workflow

### Issue: "You do not have permission to publish"

**Cause:** Not a member of @wundr.io organization

**Solution:**

1. Log into npm: `npm login`
2. Run: `npm org ls wundr.io`
3. Add yourself: `npm org set wundr.io developer [username]`

### Issue: "402 Payment Required"

**Cause:** Trying to publish private package on free plan

**Solution:**

1. Set `"publishConfig": { "access": "public" }` in package.json
2. OR upgrade to paid npm plan
3. OR set `"private": true` to skip publishing

### Issue: "Package name too similar to existing package"

**Cause:** NPM detects potential typosquatting

**Solution:**

1. Contact npm support: https://www.npmjs.com/support
2. Explain it's your organization's package
3. Provide proof of ownership

### Issue: Workflow fails with "ENEEDAUTH"

**Cause:** Authentication failed

**Solution:**

1. Verify `NODE_AUTH_TOKEN` is set in workflow
2. Check token hasn't expired
3. Regenerate token if needed

---

## 🔐 Security Best Practices

### Token Security

- ✅ Use **Automation** tokens for CI/CD
- ✅ Rotate tokens every 90 days
- ✅ Use GitHub encrypted secrets
- ✅ Enable 2FA on npm account
- ❌ Never commit tokens to git
- ❌ Never share tokens in Slack/email

### Package Security

- ✅ Enable npm audit in CI
- ✅ Sign commits with GPG
- ✅ Review published contents before releasing
- ✅ Use `.npmignore` to exclude sensitive files
- ❌ Don't publish `.env` files
- ❌ Don't include secrets in published packages

---

## 📚 Additional Resources

- [NPM Organizations](https://docs.npmjs.com/organizations)
- [Publishing Scoped Packages](https://docs.npmjs.com/creating-and-publishing-scoped-public-packages)
- [NPM Access Tokens](https://docs.npmjs.com/about-access-tokens)
- [GitHub Actions Secrets](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
- [Semantic Versioning](https://semver.org/)

---

## 🆘 Getting Help

If you encounter issues:

1. Check this guide's troubleshooting section
2. Review GitHub Actions logs
3. Check NPM support: https://www.npmjs.com/support
4. Contact organization admin

---

**Generated with Claude Code** 🤖

**Next Steps:**

1. Create npm account at https://www.npmjs.com/signup
2. Create organization at https://www.npmjs.com/org/create
3. Generate automation token
4. Add `NPM_TOKEN` to GitHub secrets
5. Push to master to test auto-publishing
