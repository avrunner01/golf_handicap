import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import node from '@astrojs/node';
import AstroPWA from '@kreisler/vite-pwa-astro'; // Use the fork here

export default defineConfig({
  output: 'server',
  adapter: node({
    mode: 'standalone',
  }),
  integrations: [
    tailwind(),
    AstroPWA({
      /* manifest config from previous step */
      manifest: {
        name: 'Golf Handicap Tracker',
        short_name: 'GolfHandy',
        icons: [
          {
            src: 'golf-ball.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ],
});