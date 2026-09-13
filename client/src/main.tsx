import React from 'react';
import ReactDOM from 'react-dom/client';
import { Toaster } from 'sonner';
import App from './App';
import { ThemeProvider } from './components/theme-provider';
import './index.css';

const storedVersion = localStorage.getItem('sbg_app_version');

if (storedVersion && storedVersion !== __APP_VERSION__) {
  console.warn(
    `[VersionManager] Upgrading ${storedVersion} → ${__APP_VERSION__}. Purging stale caches.`
  );

  // 1. Clear CacheStorage (service worker & workbox caches)
  if ('caches' in window) {
    caches.keys().then((names) => names.forEach((n) => caches.delete(n)));
  }

  // 2. Unregister all Service Workers so the new one can take over cleanly
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker
      .getRegistrations()
      .then((regs) => regs.forEach((r) => r.unregister()));
  }

  // 3. Persist the new version before reloading
  localStorage.setItem('sbg_app_version', __APP_VERSION__);

  // 4. Hard reload to origin + pathname only.
  //    We do NOT use window.location.href because it may contain attacker-controlled
  //    query params or a fragment that could redirect elsewhere.
  //    window.location.origin + pathname is always a same-origin, path-only URL.
  window.location.replace(window.location.origin + window.location.pathname);
} else if (!storedVersion) {
  localStorage.setItem('sbg_app_version', __APP_VERSION__);
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem storageKey="sbg-theme">
      <App />
      <Toaster
        richColors
        closeButton
        position="top-center"
        // The app is a standalone PWA with viewport-fit=cover and a translucent
        // status bar, so the viewport starts behind the notch/Dynamic Island.
        // Without the inset a top-center toast renders under it.
        offset={{ top: 'calc(env(safe-area-inset-top, 0px) + 24px)' }}
        mobileOffset={{
          top: 'calc(env(safe-area-inset-top, 0px) + 12px)',
          left: '12px',
          right: '12px',
        }}
        toastOptions={{
          classNames: {
            toast: 'rounded-2xl border border-borderSoft bg-card/95 backdrop-blur-xl shadow-[0_8px_40px_rgba(16,24,40,0.14)]',
            title: 'text-textPrimary font-semibold',
            description: 'text-textMuted text-sm',
            success: 'border-success/30',
            error: 'border-error/30',
            warning: 'border-warning/30',
            info: 'border-brand/30',
          },
        }}
      />
    </ThemeProvider>
  </React.StrictMode>
);