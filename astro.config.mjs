// @ts-check
import { defineConfig } from 'astro/config';
import solidJs from '@astrojs/solid-js';
import tailwindcss from '@tailwindcss/vite';
import node from '@astrojs/node';

// https://astro.build/config
export default defineConfig({
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  integrations: [solidJs()],
  server: { port: 5055 },
  allowedHosts: ['praxis.levelnine.ai'],
  vite: {
    plugins: [tailwindcss()],
    server: { allowedHosts: ['praxis.levelnine.ai'] }
  }
});
