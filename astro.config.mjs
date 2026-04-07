
import { defineConfig } from 'astro/config';
import netlify from '@astrojs/netlify';
import tailwindcss from '@tailwindcss/vite';
import VitePWA from '@vite-pwa/astro';
import react from '@astrojs/react';

export default defineConfig({
  output: 'server',
  adapter: netlify(), // Ensure there is a comma here
  integrations: [react()],
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
              src: '/golf-ball.jpg',
              sizes: '192x192',
              type: 'image/jpeg',
              purpose: 'any maskable',
            },
            {
              src: '/golf-ball.jpg',
              sizes: '512x512',
              type: 'image/jpeg',
              purpose: 'any maskable',
            },
            {
              src: '/golf-ball.jpg',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any maskable',
            },
            {
              src: '/golf-ball.jpg',
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