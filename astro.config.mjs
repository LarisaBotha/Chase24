import { defineConfig } from 'astro/config';

import tailwind from '@astrojs/tailwind';

import node from '@astrojs/node';

export default defineConfig({
  server: {
    port: 8000,  // Set to your preferred port number
  },

  output: 'hybrid',
  integrations: [tailwind()],

  adapter: node({
    mode: 'standalone',
  }),
});