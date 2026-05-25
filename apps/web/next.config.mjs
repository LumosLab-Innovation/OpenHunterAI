/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: { typedRoutes: false },
  async rewrites() {
    const target = process.env.API_BASE_URL ?? 'http://localhost:3000';
    return [{ source: '/api/:path*', destination: `${target}/:path*` }];
  },
};
export default nextConfig;
