// @ts-check
import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";
import node from "@astrojs/node";
import db from "@astrojs/db";

// https://astro.build/config
export default defineConfig({
  site: 'https://astro-news-pytrpecapa-uc.a.run.app/',
  base: 'devtools-times/',
  integrations: [react(), db()],
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
  experimental: {
    chromeDevtoolsWorkspace: true,
    csp: {
      directives: [
        "default-src 'self' https://astro-news-1026410574114.us-central1.run.app https://us-central1-web-devrel-apps.cloudfunctions.net https://chrome.dev",
        "font-src 'self' https://fonts.gstatic.com data:",
        "img-src 'self'"
      ],
      styleDirective: {
        resources: [
          "'self'",
          "https://fonts.googleapis.com"
        ]
      },
      scriptDirective: {
        resources: [
          "'self'",
          "https://us-central1-web-devrel-apps.cloudfunctions.net"
        ]
      }
    }
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