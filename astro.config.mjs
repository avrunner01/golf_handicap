import { defineConfig } from 'astro/config';
import netlify from '@astrojs/netlify';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  output: 'server',
  adapter: netlify(), // Ensure there is a comma here
  vite: {
    plugins: [tailwindcss()],
  },
});