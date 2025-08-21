/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    config.externals.push("pino-pretty", "lokijs", "encoding");
    return config;
  },
  images: {
    remotePatterns: [
      { hostname: 'assets.coingecko.com' },
      { hostname: 'ipfs.io' },
      { hostname: 'raw.githubusercontent.com' },
      { hostname: 'nft-cdn.alchemy.com' },
      { hostname: 'cryptocompare.com' },
      { hostname: 'images.cryptocompare.com' },
      { hostname: 'resources.cryptocompare.com' },
      { hostname: 'min-api.cryptocompare.com' },
      {hostname: "coin-images.coingecko.com"},
      { hostname: 'lh3.googleusercontent.com' },
      { hostname: 'avatars.githubusercontent.com' },
    ],
  },
};

module.exports = nextConfig;