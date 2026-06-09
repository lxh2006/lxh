/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://119.91.22.7:8000/api/:path*'
      }
    ];
  }
};

module.exports = nextConfig;