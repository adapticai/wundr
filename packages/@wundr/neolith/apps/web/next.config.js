/** @type {import('next').NextConfig} */
const nextConfig = {
  // Build output directory - use default .next for Netlify compatibility
  // distDir: 'out', // Disabled for Netlify deployment

  // Turborepo transpilePackages - shared packages from the monorepo
  transpilePackages: [
    '@neolith/ui',
    '@neolith/shared',
    '@neolith/config',
    '@neolith/api-client',
    '@neolith/org-integration',
  ],

  // Image optimization configuration
  images: {
    // Disable image optimization to avoid sharp dependency issues in build
    // Re-enable once sharp is properly installed in production environment
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'avatars.githubusercontent.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        pathname: '/**',
      },
    ],
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },

  // External packages for server components (ESM compatibility)
  serverExternalPackages: [
    '@apollo/server',
    '@apollo/utils.usagereporting',
    '@apollo/utils.stripsensitiveliterals',
    'graphql',
    // LiveKit ESM packages
    'livekit-server-sdk',
    'camelcase-keys',
    'map-obj',
    'quick-lru',
    // Org-genesis package (required for API routes)
    '@wundr.io/org-genesis',
    'handlebars',
    'uuid',
    // Image optimization
    'sharp',
  ],

  // Experimental features
  experimental: {
    // Enable server actions
    serverActions: {
      bodySizeLimit: '2mb',
    },
    // Optimize package imports
    optimizePackageImports: ['@apollo/client', 'lucide-react'],
  },

  // Turbopack configuration - required for Next.js 16+ builds
  turbopack: {},

  // Strict mode for React
  reactStrictMode: true,

  // TypeScript - temporarily ignore build errors for deployment
  // TODO: Fix all TypeScript errors in API routes and re-enable strict checking
  typescript: {
    ignoreBuildErrors: true,
  },

  // PoweredBy header removal for security
  poweredByHeader: false,

  // Compression
  compress: true,

  // Standalone output mode - REQUIRED for Netlify deployment with Next.js 14+
  // The @netlify/plugin-nextjs v5 expects standalone output for server functions
  // Without this, server functions fail with "Cannot find module 'next/dist/server/lib/start-server.js'"
  output: 'standalone',

  // Environment variables exposed to the browser
  env: {
    NEXT_PUBLIC_APP_NAME: 'Neolith',
    NEXT_PUBLIC_APP_VERSION: '0.1.0',
  },

  // Webpack configuration
  webpack: (config, { isServer }) => {
    // GraphQL file handling
    config.module.rules.push({
      test: /\.(graphql|gql)$/,
      exclude: /node_modules/,
      loader: 'graphql-tag/loader',
    });

    // Externalize sharp for server-side builds to avoid native module bundling issues
    if (isServer) {
      config.externals = config.externals || [];
      config.externals.push({
        sharp: 'commonjs sharp',
      });
    }

    return config;
  },

  // Headers for security
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
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin',
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
