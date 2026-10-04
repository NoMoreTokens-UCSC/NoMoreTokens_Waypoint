import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: [
        'delivery-notifications.js',
        'waypoint.svg',
        'icons/icon-192.png',
        'icons/icon-512.png',
      ],
      manifest: {
        name: 'Waypoint Operations',
        short_name: 'Waypoint',
        description: 'Your operations workspace',
        theme_color: '#f26a2e',
        background_color: '#f5f4f2',
        display: 'standalone',
        start_url: '/',
        icons: [192, 512].map((size) => ({
          src: `/icons/icon-${size}.png`,
          sizes: `${size}x${size}`,
          type: 'image/png',
          purpose: 'any',
        })),
      },
      workbox: {
        importScripts: ['/delivery-notifications.js'],
        globPatterns: ['**/*.{js,css,html,json,svg,png,jpg,webp,woff,woff2}'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        navigateFallback: '/index.html',
        // Basemap tiles are intentionally not prefetched or promised offline.
      },
    }),
  ],
})
