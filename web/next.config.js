/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  trailingSlash: true,
  skipTrailingSlashRedirect: true,

  images: {
    unoptimized: true
  },
  reactStrictMode: true,
  swcMinify: true,
};

module.exports = nextConfig;