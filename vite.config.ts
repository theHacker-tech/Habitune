import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// npm install -D vite-plugin-pwa

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',          // we handle prompt manually via usePWA hook
      injectRegister: null,            // ^ same reason
      strategies: 'injectManifest',   // use our custom sw.js
      srcDir: 'public',
      filename: 'sw.js',
      manifest: false,                 // we have our own manifest.webmanifest in /public

      devOptions: {
        enabled: true,
        type: 'module',
      },

      workbox: {
        // injectManifest mode — workbox just precaches the shell
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        globIgnores: ['**/node_modules/**', '**/sw.js'],
      },
    }),
  ],

  build: {
    target: 'es2020',
    rollupOptions: {
      output: {
        // Keep chunks stable for cache busting only on change
        manualChunks: {
          react:  ['react', 'react-dom'],
          vendor: ['@capacitor/core'],
        },
      },
    },
  },
});
