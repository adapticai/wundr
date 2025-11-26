# Publishing Summary - Wundr Packages

## Date: November 26, 2025

### Successfully Published Packages

All @wundr.io packages have been successfully published to npm, except for `packages/@wundr/neolith`
as requested.

#### Core Packages (v1.0.3)

- `@wundr.io/core`
- `@wundr.io/config`
- `@wundr.io/governance`
- `@wundr.io/computer-setup`

#### Agent Packages (v1.0.3)

- `@wundr.io/agent-delegation`
- `@wundr.io/agent-eval`
- `@wundr.io/agent-memory`
- `@wundr.io/agent-observability`

#### Orchestrator Packages (v1.0.3)

- `@wundr.io/autogen-orchestrator`
- `@wundr.io/crew-orchestrator`
- `@wundr.io/langgraph-orchestrator`

#### Tool Packages (v1.0.3)

- `@wundr.io/jit-tools`
- `@wundr.io/rag-utils`
- `@wundr.io/plugin-system`
- `@wundr.io/prompt-templates`
- `@wundr.io/prompt-security`
- `@wundr.io/structured-output`
- `@wundr.io/token-budget`
- `@wundr.io/typechat-output`

#### Infrastructure Packages

- `@wundr.io/ai-integration` (v1.0.3)
- `@wundr.io/analysis-engine` (v1.0.3)
- `@wundr.io/dashboard` (v1.0.1)
- `@wundr.io/docs` (v1.0.1)
- `@wundr.io/environment` (v1.0.1)
- `@wundr.io/hydra-config` (v1.0.3)
- `@wundr.io/mcp-registry` (v1.0.3)
- `@wundr.io/security` (v1.0.3)

#### Specialized Packages

- `@wundr.io/guardian-dashboard` (v1.0.0) - Fixed scope from `@wundr` to `@wundr.io`
- `@wundr.io/org-genesis` (v1.0.0)
- `@wundr.io/project-templates` (v1.0.3)
- `@wundr.io/risk-twin` (v1.0.0)
- `@wundr.io/slack-agent` (v1.0.0)

#### Main Packages (Latest)

- `@wundr.io/cli` (v1.0.5) - **Primary CLI package**
- `@wundr.io/mcp-server` (v1.0.4)

### Key Changes Made

1. **Fixed Guardian Dashboard Scope**: Changed from `@wundr/guardian-dashboard` to
   `@wundr.io/guardian-dashboard` to match the organization's npm scope.

2. **Added publishConfig**: Added `publishConfig: { access: "public" }` to 14 packages that were
   missing it.

3. **Workspace Dependencies**: Properly replaced `workspace:*` dependencies with version ranges
   (^1.0.0) during publishing while maintaining workspace references in local development.

### Installation

The CLI can now be installed globally:

```bash
npm install -g @wundr.io/cli
```

Or using a specific version:

```bash
npm install -g @wundr.io/cli@1.0.5
```

### Tools Created

1. **`scripts/analyze-deps.js`**: Analyzes package dependencies and workspace relationships
2. **`scripts/add-publish-config.js`**: Adds publishConfig to packages missing it
3. **`scripts/publish-packages.js`**: Automated publishing script that:
   - Backs up package.json files
   - Replaces workspace:\* with version ranges
   - Builds all packages in correct order
   - Publishes to npm
   - Restores original package.json files
   - Handles build failures gracefully

### Verification

All packages were verified to be published correctly:

- CLI successfully installs: `npm install -g @wundr.io/cli`
- All dependencies resolve correctly
- No workspace:\* references in published packages

### Total Packages Published

**34 packages** were successfully published to npm under the `@wundr.io` scope.
