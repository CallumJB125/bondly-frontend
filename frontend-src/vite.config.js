import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

const projectPath = path.resolve(__dirname);
const sharedPath = path.resolve(__dirname, '../shared');

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test-setup.js',
    include: ['src/**/*.test.{js,jsx}', '../shared/lib/__tests__/**/*.test.js'],
  },
  build: {
    outDir: '../frontend',
    emptyOutDir: true,
    sourcemap: true,
  },
  server: {
    fs: { allow: [projectPath, sharedPath] },
    // Allow the public demo hostname when served through the Cloudflare tunnel
    // (Vite blocks unknown Host headers by default).
    allowedHosts: ['demo.bondly.co.za', 'localhost', '127.0.0.1'],
    proxy: {
      '/api': {
        // Override with VITE_API_TARGET (e.g. http://localhost:3000 for the
        // local bondly_demo backend); defaults to production.
        target: process.env.VITE_API_TARGET || 'https://bondly.co.za',
        changeOrigin: true,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@bondly/ui': sharedPath,
      react: path.resolve(__dirname, 'node_modules/react'),
      'react-dom': path.resolve(__dirname, 'node_modules/react-dom'),
      'react-router-dom': path.resolve(__dirname, 'node_modules/react-router-dom'),
    },
    dedupe: ['react', 'react-dom', 'react-router-dom'],
  },
});
