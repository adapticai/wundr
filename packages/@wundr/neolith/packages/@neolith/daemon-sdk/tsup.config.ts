import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  /**
   * Target Node.js 18+ and modern browsers (Next.js 14+ compatible).
   * We keep `platform: 'neutral'` so the bundle works in both Node.js SSR
   * and browser environments.
   */
  platform: 'neutral',
  target: 'es2022',
  /**
   * `ws` is a Node.js package; mark it external so bundlers (webpack,
   * turbopack) can replace it with the native WebSocket API in browser
   * environments via a package alias.
   */
  external: ['ws'],
  esbuildOptions(options) {
    options.conditions = ['import', 'require'];
  },
});
