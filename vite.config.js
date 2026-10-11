import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 8888,
    host: '0.0.0.0',
    proxy: {
      '/api': {
        target: 'https://freshfold-pos.cleanclear.workers.dev',
        changeOrigin: true,
        secure: true,
      },
    },
  },
});
