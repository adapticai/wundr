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
    // Ensure out directory exists
    if (!fs.existsSync(outDir)) {
        console.error(`Error: Output directory not found at ${outDir}`);
        process.exit(1);
    }

    // Create or overwrite index.html
    fs.writeFileSync(indexPath, indexHtml, 'utf-8');
    console.log(`✓ Created index.html for Capacitor mobile app at ${indexPath}`);
} catch (error) {
    console.error('Failed to create index.html:', error.message);
    process.exit(1);
}
