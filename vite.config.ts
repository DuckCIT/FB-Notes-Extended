import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { copyFileSync, mkdirSync, existsSync, readdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname);
const distDir = resolve(rootDir, 'dist');

function copyPublicFiles() {
  return {
    name: 'copy-public',
    closeBundle() {
      if (!existsSync(distDir)) mkdirSync(distDir, { recursive: true });
      
      const manifestSrc = resolve(rootDir, 'public/manifest.json');
      const manifestDest = resolve(distDir, 'manifest.json');
      copyFileSync(manifestSrc, manifestDest);
      
      const iconsSrc = resolve(rootDir, 'public/icons');
      const iconsDest = resolve(distDir, 'icons');
      if (!existsSync(iconsDest)) mkdirSync(iconsDest, { recursive: true });
      
      if (existsSync(iconsSrc)) {
        readdirSync(iconsSrc).forEach(file => {
          copyFileSync(resolve(iconsSrc, file), resolve(iconsDest, file));
        });
      }
    }
  };
}

export default defineConfig({
  plugins: [react(), copyPublicFiles()],
  root: rootDir,
  publicDir: false,
  build: {
    outDir: distDir,
    rollupOptions: {
      input: {
        popup: resolve(rootDir, 'popup.html'),
        background: resolve(rootDir, 'src/background/index.ts'),
        content: resolve(rootDir, 'src/content/index.ts'),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
        dir: distDir,
      },
    },
    minify: false,
    sourcemap: false,
    target: 'esnext',
  },
  resolve: {
    alias: {
      '@': resolve(rootDir, 'src'),
    },
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
});
