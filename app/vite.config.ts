import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'logo.png'],
      manifest: {
        name: 'Gestionale Righetti 1967',
        short_name: 'Gestionale',
        description: 'Gestionale Studio Tricologico Righetti Since 1967',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#ffffff',
        theme_color: '#007AFF',
        lang: 'it-IT',
        icons: [
          {
            src: '/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true,
        navigateFallbackDenylist: [/^\/api/]
      },
      devOptions: {
        enabled: false
      }
    })
  ],
  server: {
    host: true,
    allowedHosts: [
      'localhost',
      'macbook-pro-di-luca.local',
      '.local',
    ],
    proxy: {
      '/api': {
        target: 'https://gestionale-righetti-production.up.railway.app',
        changeOrigin: true,
        secure: true,
      },
    },
  },
})
