import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // On enregistre le service worker nous-mêmes dans main.jsx (virtual:pwa-register)
      // pour pouvoir afficher un toast "nouvelle version dispo" / "prêt hors-ligne".
      injectRegister: null,
      // Sans ça, le manifest + le SW ne sont générés qu'au build : impossible de tester
      // le bouton d'installation avec `npm run dev`.
      devOptions: {
        enabled: true,
        type: 'module',
      },
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
      manifest: {
        name: 'PHCIE Sainte Marie Majeure',
        short_name: 'Ste Marie Pharm',
        description: 'Plateforme de gestion pharmaceutique nouvelle génération',
        theme_color: '#1e3a8a',
        background_color: '#f0f4ff',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: 'icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'icon-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          }
        ]
      },
      workbox: {
        // Mise en cache de l'app shell (JS/CSS/HTML/fonts) pour un lancement 100% hors-ligne
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // Les appels vers l'IA (Mistral, via tes fonctions/API) restent réseau uniquement,
        // ils ne doivent jamais être servis depuis le cache.
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            // Firestore gère déjà son propre cache offline (persistentLocalCache),
            // on ajoute juste un filet réseau côté navigateur.
            urlPattern: ({ url }) => url.origin === 'https://firestore.googleapis.com',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'firestore-cache',
              networkTimeoutSeconds: 5,
            },
          },
          {
            // Images Cloudinary : cache-first, elles ne changent pas une fois uploadées
            urlPattern: ({ url }) => url.origin === 'https://res.cloudinary.com',
            handler: 'CacheFirst',
            options: {
              cacheName: 'cloudinary-images',
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],
      },
    })
  ]
})