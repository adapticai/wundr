# NPM Publishing Setup - Quick Checklist

**Organization:** @wundr.io
**Time Required:** ~30 minutes

---

## ⚡ Quick Setup (5 Steps)

### Step 1: Create NPM Account (5 min)
```bash
# 1. Visit https://www.npmjs.com/signup
# 2. Create account and verify email
# 3. Enable 2FA (Settings → Profile → Two-Factor Authentication)
```

- [ ] Account created
- [ ] Email verified
- [ ] 2FA enabled

---

### Step 2: Create Organization (2 min)
```bash
# 1. Visit https://www.npmjs.com/org/create
# 2. Enter name: wundr.io
# 3. Select "Free" plan (for public packages)
# 4. Click "Create"
```

- [ ] Organization `@wundr.io` created
- [ ] Default access set to "Public"

---

### Step 3: Generate NPM Token (3 min)
```bash
# 1. Visit https://www.npmjs.com/settings/[your-username]/tokens
# 2. Click "Generate New Token"
# 3. Select type: "Automation"
# 4. Name: "GitHub Actions - Wundr"
# 5. COPY TOKEN IMMEDIATELY (shown only once)
```

Token format: `npm_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

- [ ] Automation token generated
- [ ] Token copied and saved securely

⚠️ **IMPORTANT:** Save this token now - you cannot view it again!

---

### Step 4: Add GitHub Secret (2 min)
```bash
# 1. Go to https://github.com/adapticai/wundr/settings/secrets/actions
# 2. Click "New repository secret"
# 3. Name: NPM_TOKEN
# 4. Value: [paste your npm token]
# 5. Click "Add secret"
```

- [ ] GitHub secret `NPM_TOKEN` added
- [ ] Secret shows in list (value hidden)

---

### Step 5: Test Publishing (5 min)
```bash
# From your local machine (after setup):

# 1. Build a package
cd packages/@wundr/cli
pnpm build

# 2. Dry run (test without publishing)
npm pack --dry-run

# 3. Login to npm
npm login

# 4. Test publish
npm publish --access public

# 5. Verify on npm
# Visit: https://www.npmjs.com/package/@wundr.io/cli
```

- [ ] Package built successfully
- [ ] Dry run shows correct files
- [ ] Published to npm
- [ ] Visible on npmjs.com

---

## 🚀 Automated Publishing Setup

Once the above steps are complete, publishing happens automatically:

### Auto-Publish (Development)

**Trigger:** Push to `master` branch
```bash
git add .
git commit -m "feat: new feature"
git push origin master

# → Auto-publishes as @wundr.io/cli@dev
```

**Installation:**
```bash
npm install @wundr.io/cli@dev
```

### Release Publishing (Stable)

**Trigger:** Create git tag
```bash
npm version patch  # or minor, major
git push && git push --tags

# → Publishes as @wundr.io/cli@latest
```

**Installation:**
```bash
npm install -g @wundr.io/cli
```

---

## ✅ Verification Checklist

After completing setup:

### NPM Verification
- [ ] Organization exists: https://www.npmjs.com/org/wundr.io
- [ ] Can view organization packages
- [ ] Test package published and visible
- [ ] Package can be installed: `npm install -g @wundr.io/cli`

### GitHub Verification
- [ ] `NPM_TOKEN` secret exists in repository
- [ ] Workflows are enabled
- [ ] Auto-publish workflow exists: `.github/workflows/npm-publish-auto.yml`
- [ ] Release workflow exists: `.github/workflows/npm-publish.yml`

### Functionality Tests
- [ ] Push to master triggers auto-publish
- [ ] Creating tag triggers release publish
- [ ] Published packages install successfully
- [ ] `wundr` command works after global install

---

## 🔄 Daily Workflow

### For Development (Continuous)
```bash
# Work on features
git checkout -b feature/new-thing
# ... make changes ...
git commit -m "feat: add new thing"
git push origin feature/new-thing

# Merge to master (via PR)
# → Auto-publishes dev version
```

### For Releases (As Needed)
```bash
# When ready to release stable version
git checkout master
git pull origin master

# Bump version
npm version patch  # 1.0.0 → 1.0.1
# OR
npm version minor  # 1.0.0 → 1.1.0
# OR
npm version major  # 1.0.0 → 2.0.0

# Push tag
git push && git push --tags

# → Auto-publishes stable version
```

---

## 📊 Monitoring

### View Published Packages
- Organization: https://www.npmjs.com/org/wundr.io
- Specific package: https://www.npmjs.com/package/@wundr.io/cli

### Monitor Workflows
- All Actions: https://github.com/adapticai/wundr/actions
- Auto-publish: Filter by "Auto Publish to NPM"
- Releases: Filter by "NPM Publish @wundr.io"

### Check Downloads
```bash
npm info @wundr.io/cli
```

---

## 🆘 Quick Troubleshooting

### "You must sign in to publish"
```bash
# Regenerate npm token, update GitHub secret
```

### "You do not have permission"
```bash
# Add yourself to organization:
npm org set wundr.io developer [your-username]
```

### "Package already exists"
```bash
# Package name conflict - choose different name or contact npm
```

### Workflow fails
```bash
# 1. Check GitHub Actions logs
# 2. Verify NPM_TOKEN is valid
# 3. Check package.json has correct name/scope
```

---

## 📚 Full Documentation

For detailed information, see:
- [NPM Organization Setup Guide](./NPM-ORGANIZATION-SETUP.md) - Complete setup guide
- [GitHub Actions](../.github/workflows/) - Workflow configurations
- [CLI Installation](./CLI-INSTALLATION.md) - User installation guide

---

## 🎯 Success Criteria

You're done when:
- ✅ `npm install -g @wundr.io/cli` works
- ✅ `wundr --version` shows version
- ✅ Push to master auto-publishes
- ✅ Packages visible on npmjs.com

---

**Estimated Total Time:** 20-30 minutes

**Next:** Push a change to master and watch it auto-publish! 🚀
