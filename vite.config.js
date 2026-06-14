import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'fs';
import { resolve } from 'path';

function inlineCssPlugin() {
  return {
    name: 'inline-css',
    enforce: 'post',
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        return html.replace(
          /<link rel="stylesheet" crossorigin href="(\/assets\/[^"]+\.css)">/g,
          (match, href) => {
            try {
              const assetKey = href.slice(1);
              if (ctx.bundle && ctx.bundle[assetKey]) {
                const css = ctx.bundle[assetKey].source;
                if (css) return `<style>${css}</style>`;
              }
              const cssPath = resolve('dist', href.slice(1));
              const css = readFileSync(cssPath, 'utf8');
              return `<style>${css}</style>`;
            } catch {
              return match;
            }
          }
        );
      },
    },
  };
}

export default defineConfig({
  plugins: [react(), inlineCssPlugin()],
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: 'index.html',
        admin: 'admin-login.html',
        portal: 'portal.html',
        games: 'games.html',
        tools: 'tools.html',
        weather: 'weather.html',
        maintenance: 'maintenance.html',
        ai: 'ai.html',
        hub: 'hub.html',
        solar: 'solar.html',
        sky: 'sky.html',
        fire: 'fire.html',
        maps: 'maps.html',
        coverage: 'coverage.html',
      },
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
        },
      },
    },
  },
});
