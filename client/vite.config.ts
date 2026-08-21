import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    const isProduction = process.env.NODE_ENV === 'production' || mode === 'production';
    
    return {
      base: '/',
      server: {
        port: 5173,
        host: true,
        proxy: {
          '/api': {
            target: process.env.VITE_PROXY_TARGET || 'http://localhost:4000',
            changeOrigin: true,
          },
          '/socket.io': {
            target: process.env.VITE_PROXY_TARGET || 'http://localhost:4000',
            changeOrigin: true,
            ws: true,
          },
        },
      },
      plugins: [
        react(), 
        tailwindcss(),
        VitePWA({
          registerType: 'autoUpdate',
          injectRegister: 'inline',
          includeAssets: [
            'favicon.ico',
            'favicon-16x16.png',
            'favicon-32x32.png',
            'favicon-48x48.png',
            'apple-touch-icon.png',
            'icons/android-chrome-192x192.png',
            'icons/android-chrome-512x512.png',
            'sbg_logo.webp',
            'gdg-logo.webp',
            'robots.txt',
            'sitemap.xml'
          ],
          manifest: false,
          workbox: {
            globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
            cleanupOutdatedCaches: true,
            runtimeCaching: [
              {
                urlPattern: /^https:\/\/sbg\.dau\.ac\.in\/api\/.*/i,
                handler: 'NetworkFirst',
                options: {
                  cacheName: 'sbg-api-cache',
                  expiration: { maxEntries: 50, maxAgeSeconds: 300 },
                  networkTimeoutSeconds: 10
                }
              },
              {
                urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp)$/i,
                handler: 'CacheFirst',
                options: {
                  cacheName: 'sbg-image-cache',
                  expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 }
                }
              }
            ]
          }
        })
      ],
      define: {
      },
      build: {
        sourcemap: true,
        rollupOptions: {
          output: {
            manualChunks: {
              'vendor': ['react', 'react-dom', 'react-router-dom'],
              'framer-motion': ['framer-motion'],
              'lucide': ['lucide-react'],
              'ui': ['@radix-ui/react-dialog', '@radix-ui/react-slot', '@radix-ui/react-popover', 'clsx', 'tailwind-merge', 'class-variance-authority'],
              'date-fns': ['date-fns']
            }
          }
        }
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, 'src'),
        }
      }
    };
});
