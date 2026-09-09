import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const apiBase = process.env.VITE_DEV_API_PROXY_TARGET ?? 'http://localhost:4000';
const rootDir = dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
  const publicSite = mode === 'public-site';
  return {
    base: '/',
    plugins: [react()],
    build: publicSite
      ? { rollupOptions: { input: { index: resolve(rootDir, 'index.public-site.html') } } }
      : undefined,
    server: {
      proxy: {
        '/api': {
          target: apiBase,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ''),
        },
      },
    },
  };
});
