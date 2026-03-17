// @ts-check
import { defineConfig, fontProviders, memoryCache } from 'astro/config';
import solidJs from '@astrojs/solid-js';
import tailwindcss from '@tailwindcss/vite';
import node from '@astrojs/node';

// https://astro.build/config
export default defineConfig({
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  integrations: [solidJs()],
  server: { port: 5055 },

  // ── Astro 6: Built-in Fonts API ──
  fonts: [
    {
      provider: fontProviders.google(),
      name: 'Inter',
      cssVariable: '--font-inter',
      weights: [400, 500, 600, 700],
      styles: ['normal'],
      subsets: ['latin'],
      display: 'swap',
    },
    {
      provider: fontProviders.google(),
      name: 'Instrument Serif',
      cssVariable: '--font-instrument-serif',
      weights: [400],
      styles: ['normal', 'italic'],
      subsets: ['latin'],
      display: 'swap',
    },
  ],

  // ── Astro 6: Experimental features ──
  experimental: {
    queuedRendering: { enabled: true },
    rustCompiler: true,
    cache: { provider: memoryCache() },
  },

  vite: {
    plugins: [tailwindcss()],
    server: { allowedHosts: ['praxis.levelnine.ai'] }
  }
});
