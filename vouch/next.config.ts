import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  },
  trailingSlash: true,
  experimental: {
    esmExternals: 'loose',
  },
  transpilePackages: [
    '@solana/wallet-adapter-wallets',
    '@solana/wallet-adapter-react',
    '@solana/wallet-adapter-react-ui',
    '@solana/wallet-adapter-base',
    '@walletconnect/universal-provider',
    '@walletconnect/ethereum-provider',
    '@walletconnect/logger',
    'pino',
  ],
  typescript: {
    ignoreBuildErrors: true, // Sometimes necessary for bulky wallet adapters
  },
  webpack: (config) => {
    config.resolve.fallback = { 
      ...config.resolve.fallback,
      fs: false, 
      os: false, 
      path: false,
      crypto: false,
    };
    return config;
  },
};

export default nextConfig;
