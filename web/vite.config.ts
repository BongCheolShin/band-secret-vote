import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages 서브디렉토리 배포 지원 (/band-secret-vote/)
const basePath = process.env.VITE_BASE_PATH || '/band-secret-vote/';

export default defineConfig({
  plugins: [react()],
  base: process.env.NODE_ENV === 'production' ? basePath : '/',
  server: {
    port: 5173,
    host: true,
    watch: {
      usePolling: false,
      ignored: ['**/node_modules/**', '**/.git/**', '**/dist/**', '../../**'],
    },
  },
});
