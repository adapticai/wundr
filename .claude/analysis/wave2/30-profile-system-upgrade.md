# Profile System Upgrade - Design Document

## Status: Wave 2

## Problem Statement

The current computer-setup profile system in `profiles/index.ts` and `real-setup-orchestrator.ts`
has several limitations:

1. **Hardcoded tool lists** - Profile definitions are scattered between `ProfileManager`
   (profiles/index.ts) and `RealSetupOrchestrator` with duplicated, inconsistent definitions
2. **No version pinning** - Tools are listed as boolean flags with no version constraints
3. **No profile composition** - Cannot combine profiles (e.g., "fullstack + devops")
4. **Weak platform adaptation** - Platform detection exists (`PlatformDetector`) but profiles do not
   declare platform-specific install commands
5. **No customization layer** - Users cannot override tool choices or add custom tools to a base
   profile
6. **No export/import** - `ProfileManager.exportProfiles` exists but exports raw `DeveloperProfile`
   objects, not shareable team configs with version pins
7. **No validation before apply** - No dry-run check that all tools in a profile are available for
   the target platform
8. **No update mechanism** - No way to check for newer versions of pinned tools
9. **No rollback** - `SetupStep.rollback` is typed but never populated
10. **Missing profiles** - No data-science or mobile profiles with proper tool sets

## Existing Architecture

```
types/index.ts          -- DeveloperProfile, SetupPlatform, SetupStep, etc.
profiles/index.ts       -- ProfileManager (load/save/list/merge profiles)
installers/real-setup-orchestrator.ts -- RealSetupOrchestrator (4 hardcoded ProfileConfig)
personalizers/          -- ProfilePersonalizer (Slack/Gmail/Mac UI personalization)
core/platform-detector.ts -- PlatformDetector (OS/arch/disk/network checks)
validators/index.ts     -- SetupValidator (command-exists checks)
```

Key types:

- `DeveloperProfile` -- user identity + preferences + tools (boolean flags per category)
- `SetupPlatform` -- os/arch/distro/version/node/shell
- `RequiredTools` -- languages/packageManagers/containers/editors/databases/cloud/etc.
- `SetupStep` -- id/name/category/dependencies/validator/installer/rollback

## Upgraded Design

### Core Principle

Separate **what** to install (profile declarations) from **how** to install (platform adapters).
Profiles become composable, version-pinned, platform-aware data structures.

### New Type System (`profile-types.ts`)

```
ProfileType       -- "frontend" | "backend" | "fullstack" | "devops" | "data-science" | "mobile"
ToolVersion       -- semver string or "latest"
ToolSpec          -- { name, version?, installCommand?, validateCommand?, category }
PlatformToolSpec  -- extends ToolSpec with per-platform install overrides
ProfileDefinition -- { type, displayName, description, tools[], frameworks[], extensions, claudeConventions }
ProfileOverride   -- partial ProfileDefinition for user customization
ComposedProfile   -- merged result of multiple ProfileDefinitions + overrides
ProfileManifest   -- serializable export format with checksum for team sharing
ProfileSnapshot   -- point-in-time record of installed state for rollback
```

### Profile Loader (`profile-loader.ts`)

Responsibilities:

- Load built-in profile definitions by `ProfileType`
- Load custom profiles from `~/.wundr/profiles/*.json`
- Load team profiles from imported manifests
- Merge user overrides on top of base definitions
- Return fully-resolved `ProfileDefinition` with all tools expanded

The six built-in profiles with their tool lists:

| Profile      | Languages                                | Frameworks                                | Key Tools                                                      |
| ------------ | ---------------------------------------- | ----------------------------------------- | -------------------------------------------------------------- |
| frontend     | Node 22, TypeScript                      | React, Vue, Angular, Next.js, Vite        | ESLint, Prettier, Storybook, Playwright                        |
| backend      | Node 22, Python 3.12, Go 1.22, Rust 1.77 | Express, Fastify, NestJS, FastAPI, Django | Docker, PostgreSQL, Redis, Nginx                               |
| fullstack    | (frontend + backend union)               | (frontend + backend union)                | Prisma, GraphQL, tRPC                                          |
| devops       | Python 3.12, Go 1.22                     | Terraform, Ansible                        | Docker, K8s, Helm, ArgoCD, GitHub Actions, Prometheus, Grafana |
| data-science | Python 3.12                              | TensorFlow, PyTorch, scikit-learn, Pandas | Jupyter, CUDA, DVC, MLflow, Weights & Biases                   |
| mobile       | Node 22, TypeScript, Swift, Kotlin       | React Native, Flutter, Expo               | Xcode CLI, Android Studio, CocoaPods, Fastlane                 |

### Profile Composer (`profile-composer.ts`)

Responsibilities:

- Accept one or more `ProfileType` identifiers
- Load each via `ProfileLoader`
- Merge tool lists with deduplication (higher version wins)
- Apply user overrides (add tools, remove tools, pin versions)
- Produce a single `ComposedProfile` ready for installation
- Detect and report conflicts (e.g., two profiles pinning different versions)

Merge strategy:

1. Union all tools, frameworks, extensions
2. For version conflicts: take the higher semver (warn user)
3. User overrides always win
4. Removed tools (override `enabled: false`) are excluded from final set

### Platform Adapter (`platform-adapter.ts`)

Responsibilities:

- Detect the current platform (delegates to existing `PlatformDetector`)
- Map `ToolSpec` to concrete install/validate commands per platform
- Detect available system package managers:
  - macOS: Homebrew (primary), xcrun for Xcode tools
  - Linux: detect apt (Debian/Ubuntu), dnf (Fedora/RHEL), pacman (Arch)
  - Windows: winget (primary), chocolatey, scoop (fallback)
- Provide `installTool(spec)`, `validateTool(spec)`, `getToolVersion(spec)`
- Handle platform-specific quirks (e.g., Python is `python3` on macOS, Xcode tools need
  `xcode-select --install`)

Package manager detection on Linux uses `/etc/os-release` to identify distro family rather than
probing for binaries.

### Profile Validator (`profile-validator.ts`)

Responsibilities:

- **Pre-apply validation**: Check every tool in a `ComposedProfile` before installation
  - Is the tool available for this platform?
  - Is the requested version available?
  - Are all dependencies met?
  - Is there sufficient disk space?
- **Post-apply validation**: Verify all tools installed correctly
  - Run each tool's validate command
  - Check version matches pinned version
  - Report any tools that failed validation
- **Update check**: Compare installed versions against latest available
  - Query Homebrew/apt/npm for latest versions
  - Report tools with available updates
- **Profile diff**: Compare two profiles and report additions/removals/changes
- **Snapshot/Rollback**:
  - Before applying, snapshot current state (which tools at which versions)
  - On rollback, restore to snapshot state

### Claude Code Integration

Each profile defines a `claudeConventions` block:

- Recommended Claude Code agents for that profile type
- Suggested MCP tools
- Memory architecture preference
- Default skills and commands
- `.claude/` structure template

Example: `devops` profile suggests `deployment-monitor` and `log-analyzer` agents, enables
infrastructure-focused skills.

### Export/Import Format (`ProfileManifest`)

```json
{
  "version": "2.0.0",
  "name": "team-acme-fullstack",
  "description": "ACME Corp fullstack developer setup",
  "createdAt": "2026-02-09T00:00:00Z",
  "baseProfiles": ["fullstack", "devops"],
  "overrides": {
    "addTools": [...],
    "removeTools": [...],
    "versionPins": {...}
  },
  "checksum": "sha256:..."
}
```

## File Structure

```
src/profiles/
  index.ts              -- Re-export public API
  profile-types.ts      -- All type definitions
  profile-loader.ts     -- Load and resolve profile definitions
  profile-composer.ts   -- Compose and merge multiple profiles
  platform-adapter.ts   -- Platform-specific install/validate logic
  profile-validator.ts  -- Validation, update checks, rollback
```

## Integration Points

1. **RealSetupOrchestrator** -- Replace `initializeProfiles()` with `ProfileLoader.load()`. Replace
   `createInstallationPlan()` with `ProfileComposer.compose()` +
   `PlatformAdapter.resolveCommands()`.
2. **ProfileManager (existing)** -- Wrap with new loader; existing `saveProfile`/`loadProfiles`
   becomes persistence for custom overrides.
3. **SetupValidator (existing)** -- `ProfileValidator.postApplyValidation()` delegates to
   `SetupValidator` methods.
4. **PlatformDetector (existing)** -- `PlatformAdapter` wraps `PlatformDetector` and extends with
   package manager detection.
5. **ClaudeCodeConventions** -- `ProfileDefinition.claudeConventions` feeds into
   `generateClaudeCodeStructure()`.

## Migration

- Existing `DeveloperProfile` type remains for backward compatibility
- `ProfileDefinition` is the new canonical type
- A `tolegacyProfile(def: ProfileDefinition): DeveloperProfile` converter bridges old code
- Old `ProfileManager.getPredefinedProfile()` delegates to `ProfileLoader`

## Risks

1. **Version staleness** -- Pinned versions go stale. Mitigation: `ProfileValidator.checkUpdates()`
   with configurable schedule.
2. **Platform gaps** -- Some tools lack installers on all platforms. Mitigation: `PlatformAdapter`
   returns `{ supported: false, reason }` and profile validation catches this before install.
3. **Merge conflicts** -- Complex profile compositions may produce surprising results. Mitigation:
   explicit conflict reporting in `ProfileComposer.compose()`.
