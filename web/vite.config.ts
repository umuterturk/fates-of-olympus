/// <reference types="vitest" />
import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';
import fs from 'fs';

// Plugin to generate version.json for cache busting
function versionPlugin(): Plugin {
  return {
    name: 'version-plugin',
    writeBundle(options) {
      const outDir = options.dir || 'dist';
      const version = {
        version: Date.now().toString(),
        buildTime: new Date().toISOString(),
      };
      fs.writeFileSync(path.join(outDir, 'version.json'), JSON.stringify(version));
    },
  };
}

// Build timestamp for version display
const buildTime = new Date().toISOString();

// https://vitejs.dev/config/
export default defineConfig({
  base: '/',
  define: {
    __BUILD_TIME__: JSON.stringify(buildTime),
  },
  plugins: [
    react(),
    versionPlugin(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'fates-of-olympus-logo.png', 'backgrounds/**/*', 'cards/**/*', 'locations/**/*'],
      manifest: {
        name: 'Fates of Olympus',
        short_name: 'Fates',
        description: 'A strategic card game set in ancient Greek mythology',
        theme_color: '#1a1a2e',
        background_color: '#1a1a2e',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        id: '/',
        categories: ['games', 'entertainment'],
        lang: 'en',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'pwa-maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        skipWaiting: true,
        clientsClaim: true,
        globPatterns: ['**/*.{js,css,html,ico,png,svg,jpg,jpeg,webp,woff,woff2}'],
        runtimeCaching: [
          {
            // Cache card images - StaleWhileRevalidate serves cached instantly, updates in background
            urlPattern: /\/cards\/.*\.(jpg|jpeg|png|webp)$/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'images-cards-cache',
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            // Cache background images
            urlPattern: /\/backgrounds\/.*\.(jpg|jpeg|png|webp)$/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'images-backgrounds-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            // Cache location images
            urlPattern: /\/locations\/.*\.(jpg|jpeg|png|webp)$/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'images-locations-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            // Cache icon images
            urlPattern: /\/icons\/.*\.(jpg|jpeg|png|webp|svg)$/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'images-icons-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'gstatic-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@engine': path.resolve(__dirname, './src/engine'),
      '@components': path.resolve(__dirname, './src/components'),
      '@hooks': path.resolve(__dirname, './src/hooks'),
      '@store': path.resolve(__dirname, './src/store'),
      '@storage': path.resolve(__dirname, './src/storage'),
      '@tutorial': path.resolve(__dirname, './src/tutorial'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
  },
});
