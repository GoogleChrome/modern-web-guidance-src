// @ts-check
import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";
import node from "@astrojs/node";


// https://astro.build/config
export default defineConfig({
  site: 'https://astro-news-pytrpecapa-uc.a.run.app/',
  base: 'devtools-times/',
  integrations: [react()],
  vite: {
    plugins: [tailwindcss()],
  },
  adapter: node({
    mode: "standalone",
  }),
  output: "server",

  image: {
    service: {
       entrypoint: 'astro/assets/services/sharp',
       config: {
         limitInputPixels: false,
      },
     },
  },

  security: {
    checkOrigin: false,
    allowedDomains: [
      {
        hostname: 'chrome.dev',
        protocol: 'https'
      },
      {
        hostname: 'astro-news-1026410574114.us-central1.run.app',
        protocol: 'https',
      },
      {
        hostname: 'astro-news-pytrpecapa-uc.a.run.app',
        protocol: 'https',
      }
    ]
  }
});