
import { defineConfig } from 'astro/config';
import netlify from '@astrojs/netlify';
import tailwindcss from '@tailwindcss/vite';
import VitePWA from '@vite-pwa/astro';

export default defineConfig({
  output: 'server',
  adapter: netlify(), // Ensure there is a comma here
  vite: {
    plugins: [
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        manifest: {
          name: 'Golf Handicap App',
          short_name: 'GolfHandicap',
          description: 'Track your golf scores and handicap easily on any device.',
          start_url: '/',
          display: 'standalone',
          background_color: '#e0f7fa',
          theme_color: '#005c80',
          orientation: 'portrait',
          icons: [
            {
              src: '/golf-ball.svg',
              sizes: '192x192',
              type: 'image/svg+xml',
              purpose: 'any maskable',
            },
            {
              src: '/golf-ball.svg',
              sizes: '512x512',
              type: 'image/svg+xml',
              purpose: 'any maskable',
            },
            {
              src: '/favicon.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any maskable',
            },
            {
              src: '/favicon.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any maskable',
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest}'],
        },
      }),
    ],
  },
});