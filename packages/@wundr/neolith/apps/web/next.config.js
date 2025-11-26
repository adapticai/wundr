/** @type {import('next').NextConfig} */
const nextConfig = {
  // Build output directory for both web and desktop apps
  // The desktop app will use this directory for static files
  // API routes are served by the Next.js server in web mode
  distDir: 'out',

  // Turborepo transpilePackages - shared packages from the monorepo
  transpilePackages: [
    '@neolith/ui',
    '@neolith/shared',
    '@neolith/config',
    '@neolith/api-client',
  ],

  // Image optimization configuration
  images: {
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

  // Turbopack configuration
  turbopack: {
    // Set workspace root to avoid lockfile warning
    root: '../../../..',
  },

  // Strict mode for React
  reactStrictMode: true,

  // TypeScript - already checked in typecheck step
  typescript: {
    ignoreBuildErrors: false,
  },

  // PoweredBy header removal for security
  poweredByHeader: false,

  // Compression
  compress: true,

  // Standalone mode for Electron/desktop app bundling
  // This creates a minimal standalone server that can be bundled with Electron
  standalone: true,

  // Environment variables exposed to the browser
  env: {
    NEXT_PUBLIC_APP_NAME: 'Neolith',
    NEXT_PUBLIC_APP_VERSION: '0.1.0',
  },

  // Webpack configuration
  webpack: (config, { isServer: _isServer }) => {
    // GraphQL file handling
    config.module.rules.push({
      test: /\.(graphql|gql)$/,
      exclude: /node_modules/,
      loader: 'graphql-tag/loader',
    });

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
