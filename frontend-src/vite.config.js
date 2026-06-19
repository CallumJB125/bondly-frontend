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
    cssCodeSplit: false,
  },
  server: {
    fs: { allow: [projectPath, sharedPath] },
    proxy: {
      '/api': {
        target: 'https://bondly.co.za',
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
