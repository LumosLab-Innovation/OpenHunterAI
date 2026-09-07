import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const apiBase = process.env.VITE_DEV_API_PROXY_TARGET ?? 'http://localhost:4000';

export default defineConfig(({ mode }) => ({
  base: mode === 'public-site' ? '/openhunterai-site/' : '/',
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: apiBase,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
}));
