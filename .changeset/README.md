# Changesets

Hello! This folder contains [Changesets](https://github.com/changesets/changesets) configuration and
changelog files.

## What are changesets?

Changesets are a way to track changes to packages in a monorepo and generate changelogs and version
bumps automatically.

## How to use changesets

1. **Adding a changeset**: When you make a change that should be released, run:

   ```bash
   npx changeset
   ```

   This will prompt you to describe your changes and select which packages are affected.

2. **Version packages**: To bump versions and update changelogs:

   ```bash
   npx changeset version
   ```

3. **Publishing**: To publish the packages:
   ```bash
   npx changeset publish
   ```

## Automated release process

Our CI/CD pipeline automatically:

1. **Detects changesets** in PRs and creates release PRs
2. **Versions packages** when changesets are merged
3. **Publishes to npm** and creates GitHub releases
4. **Updates documentation** and notifies stakeholders

## Changeset types

- **patch**: Bug fixes, documentation updates, minor improvements
- **minor**: New features, non-breaking changes
- **major**: Breaking changes, major rewrites

## Examples

### Adding a patch changeset

```bash
npx changeset
# Select: patch
# Description: Fix issue with analysis performance
```

### Adding a minor changeset

```bash
npx changeset
# Select: minor
# Description: Add new consolidation algorithms
```

### Adding a major changeset

```bash
npx changeset
# Select: major
# Description: Restructure API for better performance
```

## Best practices

1. **Write clear descriptions**: Explain what changed and why
2. **Use appropriate semver levels**: Follow semantic versioning
3. **One changeset per logical change**: Don't combine unrelated changes
4. **Review generated changelogs**: Make sure they make sense to users

## Configuration

The changeset configuration is in `.changeset/config.json` and includes:

- **Changelog generation** using GitHub integration
- **Access level** set to public for npm publishing
- **Base branch** set to main
- **Automatic dependency updates** for internal packages

For more information, see the
[Changesets documentation](https://github.com/changesets/changesets/tree/main/docs).
