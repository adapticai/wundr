/** @type {import('next').NextConfig} */
const nextConfig = {
  // Turborepo transpilePackages - shared packages from the monorepo
  transpilePackages: [
    '@genesis/ui',
    '@genesis/shared',
    '@genesis/config',
    '@genesis/api-client',
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

  // Experimental features
  experimental: {
    // Enable server actions
    serverActions: {
      bodySizeLimit: '2mb',
    },
    // Optimize package imports
    optimizePackageImports: ['@apollo/client', 'lucide-react'],
    // External packages for server components
    serverComponentsExternalPackages: ['@apollo/server', 'graphql'],
  },

  // Server external packages (ESM compatibility)
  serverExternalPackages: [
    '@apollo/server',
    '@apollo/utils.usagereporting',
    '@apollo/utils.stripsensitiveliterals',
    'graphql',
  ],

  // Strict mode for React
  reactStrictMode: true,

  // ESLint configuration - ignore during build (fixes done in lint step)
  eslint: {
    ignoreDuringBuilds: true,
  },

  // TypeScript - already checked in typecheck step
  typescript: {
    ignoreBuildErrors: false,
  },

  // PoweredBy header removal for security
  poweredByHeader: false,

  // Compression
  compress: true,

  // Environment variables exposed to the browser
  env: {
    NEXT_PUBLIC_APP_NAME: 'Genesis',
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
