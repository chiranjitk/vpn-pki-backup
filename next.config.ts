import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // Allow cross-origin requests from preview domains
  allowedDevOrigins: [
    'preview-chat-103769d2-08c6-4af9-afc5-2ff454ab4afc.space.z.ai',
    '.space.z.ai',
  ],
<<<<<<< HEAD
=======
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'chart.googleapis.com',
        port: '',
        pathname: '/chart',
      },
    ],
  },
>>>>>>> cb3b2e1ec22a345a6b5378050327d37b6f83d124
};

export default nextConfig;
