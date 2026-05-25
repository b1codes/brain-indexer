import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Prevent Vite from obscuring Rust errors
  clearScreen: false,
  // Tauri expects a fixed port, fail if that port is already in use
  server: {
    port: 5173,
    strictPort: true,
  },
  // Env variables starting with TAURI_ are exposed to frontend
  envPrefix: ['VITE_', 'TAURI_'],
  build: {
    // Tauri uses Chromium on Windows/Linux and WebKit on macOS
    target: process.env.TAURI_PLATFORM === 'windows' ? 'chrome105' : 'safari13',
    // Don't minify for debug builds
    minify: !process.env.TAURI_DEBUG ? 'esbuild' : false,
    // Produce sourcemaps for debug builds
    sourcemap: !!process.env.TAURI_DEBUG,
  },
});
