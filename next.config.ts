import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  output: 'export', // Enable static HTML export
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    unoptimized: true, // Disable Next.js image optimization for static export
  },
  // If deploying to a subdirectory like <username>.github.io/<repository-name>
  // You might need to uncomment and set basePath and assetPrefix:
  // basePath: '/<Melody-Sketcher>',
  // assetPrefix: '/<Melody-Sketcher>/',
};

export default nextConfig;
