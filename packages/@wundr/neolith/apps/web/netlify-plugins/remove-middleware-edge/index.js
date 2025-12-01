/**
 * Netlify Plugin: Remove Middleware Edge Functions
 *
 * This plugin runs after @netlify/plugin-nextjs and removes the middleware
 * edge function that the Next.js plugin creates. This is necessary because:
 *
 * 1. Our NextAuth configuration with Prisma adapter generates middleware
 * 2. Prisma client cannot run in Deno edge runtime
 * 3. The Netlify Next.js plugin v5 always creates edge functions for middleware
 * 4. NEXT_DISABLE_NETLIFY_EDGE=true doesn't work with plugin v5
 *
 * By running onBuild AFTER the Next.js plugin, we can remove the middleware
 * edge function directory and update the manifest before bundling occurs.
 */

const fs = require('fs');
const path = require('path');

module.exports = {
  onBuild: async ({ utils, constants }) => {
    // BASE_DIR is the base directory configured in netlify.toml
    // For our monorepo: packages/@wundr/neolith
    const baseDir = constants.BASE || process.cwd();
    const edgeFunctionsDir = path.join(baseDir, '.netlify', 'edge-functions');
    const middlewareDir = path.join(
      edgeFunctionsDir,
      '___netlify-edge-handler-node-middleware'
    );
    const manifestPath = path.join(edgeFunctionsDir, 'manifest.json');

    console.log('🔧 Remove Middleware Edge Plugin: Starting cleanup...');
    console.log(`   Base dir: ${baseDir}`);
    console.log(`   Edge functions dir: ${edgeFunctionsDir}`);
    console.log(`   Looking for: ${middlewareDir}`);

    // Remove the middleware edge function directory
    if (fs.existsSync(middlewareDir)) {
      fs.rmSync(middlewareDir, { recursive: true, force: true });
      console.log('✓ Removed middleware edge function directory');
    } else {
      console.log(
        'ℹ Middleware edge function directory not found (already removed or not created)'
      );
    }

    // Update the edge functions manifest to remove middleware entry
    if (fs.existsSync(manifestPath)) {
      try {
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));

        // Filter out middleware-related functions
        if (manifest.functions) {
          const originalCount = manifest.functions.length;
          manifest.functions = manifest.functions.filter(
            fn =>
              !fn.function.includes('middleware') &&
              !fn.function.includes('node-middleware')
          );

          if (manifest.functions.length < originalCount) {
            fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
            console.log(
              `✓ Updated manifest.json: removed ${originalCount - manifest.functions.length} middleware entries`
            );
          }
        }
      } catch (error) {
        console.warn('⚠ Could not update manifest.json:', error.message);
      }
    }

    console.log('✓ Middleware edge function cleanup complete');
  },
};
