import { defineConfig } from 'astro/config';

import tailwind from '@astrojs/tailwind';

export default defineConfig({
  server: {
    port: 8000,  // Set to your preferred port number
  },

  integrations: [tailwind()],
});