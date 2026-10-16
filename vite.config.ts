import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  base: './',
  publicDir: fileURLToPath(new URL('./node_modules/@delta/ui/public', import.meta.url)),
  plugins: [react()],
  resolve: { alias: { '@': fileURLToPath(new URL('./node_modules/@delta/ui/src', import.meta.url)) } },
  build: {
    chunkSizeWarningLimit: 1200,
    rolldownOptions: {
      output: {
        manualChunks(id) {
          if (/\/node_modules\/(react|react-dom|react-router|react-router-dom|scheduler)\//.test(id)) return 'react';
          if (id.includes('/node_modules/recharts/')) return 'charts';
          if (id.includes('/node_modules/react-grid-layout/')) return 'grid';
        },
      },
    },
  },
});
