import { defineConfig } from 'vite';

/**
 * base: './' is required for Capacitor (file:// / capacitor:// asset loading).
 * Absolute paths like /assets/... break inside the iOS WebView.
 */
export default defineConfig({
  base: './',
  server: {
    host: true,
    port: 5190,
  },
  build: {
    target: 'es2022',
    outDir: 'dist',
    emptyOutDir: true,
  },
  esbuild: {
    target: 'es2022',
  },
  optimizeDeps: {
    esbuildOptions: {
      target: 'es2022',
    },
  },
});
