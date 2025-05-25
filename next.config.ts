import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // ① static export を ON
  output: 'export',

  // ② GitHub Pages の URL が
  //    https://<ユーザ名>.github.io/Melody-Sketcher/
  //    の場合は basePath/assetPrefix を設定
  basePath: '/Melody-Sketcher',
  assetPrefix: '/Melody-Sketcher/',

  typescript: { ignoreBuildErrors: true },
  eslint:    { ignoreDuringBuilds: true },
  images:    { unoptimized: true },
};

export default nextConfig;
