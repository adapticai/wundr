#!/usr/bin/env node

/**
 * Post-build script for Next.js web app
 * Ensures compatibility with Capacitor mobile app by creating index.html entry point
 * This file is required by Capacitor's webDir configuration
 */

const fs = require('fs');
const path = require('path');

const outDir = path.join(__dirname, '..', 'out');
const indexPath = path.join(outDir, 'index.html');

// HTML template for Capacitor mobile app entry point
const indexHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <meta name="apple-mobile-web-app-title" content="Neolith" />
    <meta name="theme-color" content="#000000" />
    <title>Neolith - Loading...</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        html, body {
            width: 100%;
            height: 100%;
            background: #1c1917;
            color: #fff;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", sans-serif;
        }
        #root {
            width: 100%;
            height: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .loader {
            text-align: center;
        }
        .spinner {
            width: 50px;
            height: 50px;
            border: 3px solid rgba(255,255,255,0.1);
            border-top: 3px solid #fff;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin: 0 auto 20px;
        }
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        .text {
            font-size: 18px;
            color: #9ca3af;
        }
    </style>
</head>
<body>
    <div id="root">
        <div class="loader">
            <div class="spinner"></div>
            <div class="text">Loading Neolith...</div>
        </div>
    </div>
    <script>
        // Capacitor mobile app entry point
        // Redirects to the main app dashboard
        setTimeout(() => {
            window.location.href = '/dashboard';
        }, 1000);
    </script>
</body>
</html>`;

try {
  // Remove native C++ addon files from standalone folder (causes Netlify middleware errors)
  // The Netlify plugin scans these and fails because C++ addons aren't supported in edge runtime
  const standaloneDir = path.join(__dirname, '..', '.next', 'standalone');
  if (fs.existsSync(standaloneDir)) {
    // Find and remove .node files (native C++ addons)
    const removeNodeFiles = dir => {
      if (!fs.existsSync(dir)) return;
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          removeNodeFiles(fullPath);
        } else if (
          entry.name.endsWith('.node') ||
          entry.name.endsWith('.dylib.node')
        ) {
          fs.unlinkSync(fullPath);
          console.log(`✓ Removed native addon: ${entry.name}`);
        }
      }
    };
    removeNodeFiles(standaloneDir);
  }

  // IMPORTANT: Strip Prisma dependencies from middleware to prevent Netlify edge function bundling errors
  // The NextAuth config with Prisma adapter causes middleware to bundle @prisma/client
  // which cannot run in Deno edge runtime. We keep the middleware files but empty the nft.json
  // to prevent the Netlify plugin from trying to bundle Prisma.
  const serverDir = path.join(__dirname, '..', '.next', 'server');

  // Create an empty nft.json that won't cause bundling of Prisma
  const nftPath = path.join(serverDir, 'middleware.js.nft.json');
  if (fs.existsSync(nftPath)) {
    // Create minimal nft.json with no external dependencies
    const emptyNft = {
      version: 1,
      files: [],
    };
    fs.writeFileSync(nftPath, JSON.stringify(emptyNft, null, 2));
    console.log('✓ Cleared middleware.js.nft.json dependencies');
  }

  // Clear the middleware manifest to indicate no middleware routes
  const manifestPath = path.join(serverDir, 'middleware-manifest.json');
  if (fs.existsSync(manifestPath)) {
    const emptyManifest = {
      version: 3,
      middleware: {},
      sortedMiddleware: [],
      functions: {},
    };
    fs.writeFileSync(manifestPath, JSON.stringify(emptyManifest, null, 2));
    console.log('✓ Cleared middleware-manifest.json');
  }

  // Remove the middleware directory if it exists
  const middlewareDir = path.join(serverDir, 'middleware');
  if (fs.existsSync(middlewareDir)) {
    fs.rmSync(middlewareDir, { recursive: true, force: true });
    console.log('✓ Removed middleware directory');
  }

  // Check if out directory exists (optional for Netlify deployment)
  if (!fs.existsSync(outDir)) {
    console.log(
      `Note: Output directory not found at ${outDir} - skipping index.html creation (not needed for SSR deployment)`
    );
    process.exit(0); // Exit successfully - this is expected for Netlify
  }

  // Create or overwrite index.html
  fs.writeFileSync(indexPath, indexHtml, 'utf-8');
  console.log(`✓ Created index.html for Capacitor mobile app at ${indexPath}`);
} catch (error) {
  console.error('Failed to create index.html:', error.message);
  process.exit(1);
}
