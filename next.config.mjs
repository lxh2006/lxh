/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: [
    '119.91.22.7',
    'localhost',
    '127.0.0.1'
  ],
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://119.91.22.7:8000/api/:path*'
      }
    ];
  }
};

export default nextConfig;
