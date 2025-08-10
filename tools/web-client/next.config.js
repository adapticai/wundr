/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    optimizePackageImports: ['lucide-react', '@radix-ui/react-icons', 'd3'],
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  output: 'standalone',
  // Disable static optimization for dashboard pages
  generateBuildId: async () => {
    return 'build-' + Date.now();
  },
};

module.exports = nextConfig;