#!/usr/bin/env node

/**
 * Notarization script for macOS builds
 *
 * This script handles Apple notarization for the Neolith desktop app.
 * It requires the following environment variables:
 *
 * - APPLE_ID: Your Apple ID email
 * - APPLE_ID_PASSWORD: App-specific password (generate at appleid.apple.com)
 * - APPLE_TEAM_ID: Your Apple Developer Team ID
 *
 * Reference: https://kilianvalkhof.com/2019/electron/notarizing-your-electron-application/
 */

const { notarize } = require('@electron/notarize');
const path = require('path');

/**
 * Notarize the macOS application
 * @param {Object} context - electron-builder context
 */
exports.default = async function notarizing(context) {
  const { electronPlatformName, appOutDir } = context;

  // Only notarize macOS builds
  if (electronPlatformName !== 'darwin') {
    console.log('Skipping notarization - not a macOS build');
    return;
  }

  // Check for required environment variables
  const appleId = process.env.APPLE_ID;
  const appleIdPassword = process.env.APPLE_ID_PASSWORD;
  const appleTeamId = process.env.APPLE_TEAM_ID;

  if (!appleId || !appleIdPassword || !appleTeamId) {
    console.warn(
      '⚠️  Skipping notarization: Missing required environment variables'
    );
    console.warn('   Required: APPLE_ID, APPLE_ID_PASSWORD, APPLE_TEAM_ID');
    console.warn(
      '   Set these in your CI/CD environment or locally for release builds'
    );
    return;
  }

  const appName = context.packager.appInfo.productFilename;
  const appPath = path.join(appOutDir, `${appName}.app`);

  console.log(`Notarizing ${appName} at ${appPath}...`);

  try {
    await notarize({
      appBundleId: 'ai.adaptic.neolith',
      appPath: appPath,
      appleId: appleId,
      appleIdPassword: appleIdPassword,
      teamId: appleTeamId,
    });

    console.log('✅ Notarization successful');
  } catch (error) {
    console.error('❌ Notarization failed:', error);
    // Don't fail the build - notarization is optional for development
    // In production CI/CD, you might want to throw the error instead
    console.warn('⚠️  Continuing build without notarization');
  }
};
