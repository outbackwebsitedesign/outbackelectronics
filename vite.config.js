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
              const cssPath = resolve(ctx.bundle ? '.' : 'dist', href.slice(1));
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
        maintenance: 'maintenance.html',
      },
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
        },
      },
    },
  },
});
