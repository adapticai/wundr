# Changesets

This directory contains changeset files that track changes for releases.

## Adding a changeset

Run `npx changeset` to create a new changeset when you make changes that should be included in the next release.

## Releasing

The release process is automated via GitHub Actions. When changesets are merged to main, a PR will be created to version the packages. Merging that PR will trigger a release to npm.