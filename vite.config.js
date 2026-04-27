import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: './',
  server: {
    host: '0.0.0.0',
    port: 5173
  },
  build: {
    target: 'es2020',
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 4096
  },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon.svg', 'favicon.svg'],
      manifest: {
        name: 'Весёлый Могильщик',
        short_name: 'Могильщик',
        description: 'Мультяшный 2.5D тайм-менеджер: симулятор кладбища мистера Юпитера.',
        lang: 'ru',
        theme_color: '#1c2a1f',
        background_color: '#0d1410',
        display: 'fullscreen',
        orientation: 'landscape',
        start_url: './',
        scope: './',
        icons: [
          { src: 'icons/icon.svg', sizes: '192x192', type: 'image/svg+xml', purpose: 'any' },
          { src: 'icons/icon.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'any' },
          { src: 'icons/icon.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2,json}'],
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024
      }
    })
  ]
});
