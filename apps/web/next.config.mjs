/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: { typedRoutes: false },
  async rewrites() {
    // API listens on http://localhost:4000 by default (apps/api/src/server.ts:
    // `API_PORT || 4000`). The previous default of :3000 caused every web
    // request (including /v1/auth/signin) to land on the Next.js dev server
    // itself and fail with a 404 — surfacing as "Sign in" appearing broken.
    const target = process.env.API_BASE_URL ?? 'http://localhost:4000';
    return [{ source: '/api/:path*', destination: `${target}/:path*` }];
  },
};
export default nextConfig;
