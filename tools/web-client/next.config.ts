import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // Enable React strict mode for better development experience
  reactStrictMode: true,

  // Disable ESLint during build to allow warnings
  eslint: {
    // Warning: This allows production builds with ESLint errors.
    ignoreDuringBuilds: true,
  },

  // Optimize production builds
  compiler: {
    // Remove console logs in production
    removeConsole: process.env.NODE_ENV === "production",
  },

  // Configure webpack to handle Node.js modules properly
  webpack: (config, { isServer }) => {
    // Disable cache to fix webpack errors
    config.cache = false;
    
    // Handle Node.js modules for browser environment
    if (!isServer) {
      // Set fallbacks for Node.js built-ins used in browser
      config.resolve.fallback = {
        ...config.resolve.fallback,
        // Node.js built-ins that should be polyfilled or excluded
        fs: false,
        path: false,
        os: false,
        crypto: false,
        stream: false,
        http: false,
        https: false,
        zlib: false,
        url: false,
        util: false,
        buffer: false,
        events: false,
        querystring: false,
        child_process: false,
        cluster: false,
        dns: false,
        dgram: false,
        net: false,
        tls: false,
        readline: false,
        repl: false,
        vm: false,
        canvas: false,
        // Handle Chart.js SSR
        'chart.js/auto': false,
      };

      // Configure externals for packages that shouldn't be bundled
      config.externals = config.externals || [];
      config.externals.push({
        // Server-only packages
        'node:fs': 'commonjs node:fs',
        'node:path': 'commonjs node:path',
        'node:child_process': 'commonjs node:child_process',
        'node:os': 'commonjs node:os',
        'node:crypto': 'commonjs node:crypto',
        'node:stream': 'commonjs node:stream',
        'node:util': 'commonjs node:util',
        'node:events': 'commonjs node:events',
        'node:buffer': 'commonjs node:buffer',
        'node:url': 'commonjs node:url',
      });

      // Optimize bundle size
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          chunks: 'all',
          cacheGroups: {
            default: false,
            vendors: false,
            // Vendor chunk for node_modules
            vendor: {
              name: 'vendor',
              chunks: 'all',
              test: /node_modules/,
              priority: 20,
            },
            // Chart.js chunk
            chartjs: {
              name: 'chartjs',
              test: /[\\/]node_modules[\\/](chart\.js|react-chartjs-2)[\\/]/,
              chunks: 'all',
              priority: 30,
            },
            // UI components chunk
            ui: {
              name: 'ui',
              test: /[\\/]components[\\/]ui[\\/]/,
              chunks: 'all',
              priority: 25,
            },
            // Visualization components chunk
            visualizations: {
              name: 'visualizations',
              test: /[\\/]components[\\/]visualizations[\\/]/,
              chunks: 'all',
              priority: 25,
            },
            // Common chunk for shared code
            common: {
              name: 'common',
              minChunks: 2,
              chunks: 'all',
              priority: 10,
              reuseExistingChunk: true,
              enforce: true,
            },
          },
        },
      };
    } else {
      // Server-side configuration
      // Allow Node.js modules on server side
      config.resolve.fallback = {
        ...config.resolve.fallback,
        canvas: false,
      };
    }

    // Configure module resolution for better compatibility
    config.resolve.alias = {
      ...config.resolve.alias,
      // Ensure proper module resolution
      '@': require('path').resolve(__dirname),
    };

    // Handle specific module imports that might cause issues
    config.module.rules.push({
      test: /\.m?js$/,
      type: 'javascript/auto',
      resolve: {
        fullySpecified: false,
      },
    });

    // Add webpack ignore patterns for server-only code
    try {
      const webpack = require('webpack');
      config.plugins.push(
        new webpack.IgnorePlugin({
          resourceRegExp: /^(fs|path|child_process|os|crypto|stream|http|https|zlib|url|util|buffer|events|querystring|cluster|dns|dgram|net|tls|readline|repl|vm)$/,
          contextRegExp: /client/,
        })
      );
    } catch (error) {
      // webpack not available in this context, skip the plugin
      console.warn('Webpack IgnorePlugin not configured - webpack not available');
    }

    return config
  },

  // Configure image optimization
  images: {
    domains: ['github.com', 'avatars.githubusercontent.com'],
    formats: ['image/avif', 'image/webp'],
  },

  // Enable experimental features
  experimental: {
    // Enable optimized package imports
    optimizePackageImports: [
      'lucide-react',
      'date-fns',
      '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-dialog',
      '@radix-ui/react-popover',
      '@radix-ui/react-select',
      '@radix-ui/react-tabs',
      '@radix-ui/react-tooltip',
    ],
    // Enable server-only imports check (moved to root level in Next.js 15)
  },

  // Server-side code detection
  serverRuntimeConfig: {
    // Server-only configuration
  },
  
  // Public runtime config (accessible on both server and client)
  publicRuntimeConfig: {
    // Public configuration
  },

  // Configure headers for better performance
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
        ],
      },
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, must-revalidate',
          },
        ],
      },
      {
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ]
  },

  // Configure redirects
  async redirects() {
    return [
      {
        source: '/docs',
        destination: '/dashboard/docs',
        permanent: true,
      },
    ]
  },

  // Output configuration
  output: 'standalone',

  // Server external packages (Next.js 15+)
  serverExternalPackages: ['canvas', 'sharp', 'ws'],
}

export default nextConfig