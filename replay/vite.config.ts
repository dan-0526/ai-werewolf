import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // 让 data/ 目录可以被访问
    fs: {
      allow: ['.'],
    },
  },
  // data 目录作为公共资源
  publicDir: 'public',
});
