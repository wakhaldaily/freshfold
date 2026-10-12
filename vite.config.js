import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// `npm run dev` proxies /api to a local Worker (`npm run dev:api`, which uses the
// DATABASE_URL in .dev.vars). It never talks to the deployed production Worker.
// Without a local Worker running, the app falls back to browser-only demo mode.
const apiTarget = process.env.VITE_API_PROXY_TARGET || 'http://127.0.0.1:8787';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 8888,
    host: '0.0.0.0',
    proxy: {
      '/api': {
        target: apiTarget,
        changeOrigin: true,
      },
    },
  },
});
