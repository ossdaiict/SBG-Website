import path from 'path';
import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

// ── Derive a safe, validated app version for the built bundle ──────────────
// All candidate values are validated against strict allowlists before use.
// This prevents a compromised git binary or malicious env var from injecting
// arbitrary strings into the bundle via the define map.
const SHA_RE = /^[0-9a-f]{7,40}$/i;         // git short or full SHA
const SEMVER_RE = /^[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9.]+)?$/;

function deriveAppVersion(): string {
  // 1. Prefer the full SHA injected by GitHub Actions (most authoritative)
  const ciSha = process.env.GITHUB_SHA ?? '';
  if (SHA_RE.test(ciSha)) return ciSha.slice(0, 7);

  // 2. Fall back to local git short SHA
  try {
    const sha = execSync('git rev-parse --short HEAD', {
      encoding: 'utf8',
      timeout: 3000,      // don't hang if git is unavailable
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    if (SHA_RE.test(sha)) return sha;
  } catch {
    // git unavailable — continue to next fallback
  }

  // 3. Fall back to the semver from package.json
  try {
    const pkg = JSON.parse(readFileSync('./package.json', 'utf8')) as { version?: string };
    if (typeof pkg.version === 'string' && SEMVER_RE.test(pkg.version)) return pkg.version;
  } catch {
    // package.json unreadable — continue to last resort
  }

  // 4. Last resort: unix timestamp (always safe)
  return String(Date.now());
}

const appVersion = deriveAppVersion();

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
        'process.env.NODE_ENV': JSON.stringify(isProduction ? 'production' : 'development'),
        '__APP_VERSION__': JSON.stringify(appVersion),
      },
      build: {
        target: 'es2022',
        sourcemap: true,
        cssCodeSplit: true,
        cssMinify: true,
        modulePreload: {
          polyfill: false,
        },
        rollupOptions: {
          output: {
            manualChunks(id) {
              if (id.includes('node_modules')) {
                // Core React & scheduler
                if (
                  id.includes('/react/') ||
                  id.includes('react-dom') ||
                  id.includes('scheduler')
                ) {
                  return 'vendor-react';
                }
                // Routing
                if (
                  id.includes('react-router') ||
                  id.includes('@remix-run/router')
                ) {
                  return 'vendor-router';
                }
                // Form validation & schemas
                if (
                  id.includes('react-hook-form') ||
                  id.includes('@hookform') ||
                  id.includes('zod')
                ) {
                  return 'vendor-forms';
                }
                // UI primitives (Radix, Floating UI)
                if (id.includes('@radix-ui') || id.includes('@floating-ui')) {
                  return 'vendor-ui';
                }
                // Icons
                if (id.includes('lucide-react') || id.includes('react-icons')) {
                  return 'vendor-icons';
                }
                // Animation library
                if (id.includes('framer-motion')) {
                  return 'vendor-framer';
                }
                // Calendar and date libraries
                if (
                  id.includes('react-big-calendar') ||
                  id.includes('react-day-picker') ||
                  id.includes('date-fns')
                ) {
                  return 'vendor-calendar';
                }
                // Heavy standalone utilities deferred until explicitly needed
                if (id.includes('xlsx')) {
                  return 'vendor-xlsx';
                }
                if (id.includes('socket.io-client') || id.includes('engine.io-client')) {
                  return 'vendor-socket';
                }
              }
            },
          },
        },
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, 'src'),
        }
      }
    };
});
