import { defineConfig } from 'vite';
import copy from 'rollup-plugin-copy';
import fs from 'fs';
import path from 'path';

const wasmContentTypePlugin = {
  name: 'wasm-content-type-plugin',
  configureServer(server) {
    server.middlewares.use(async (req, res, next) => {
      if (req.url.endsWith('.wasm')) {
        res.setHeader('Content-Type', 'application/wasm');
        const newPath = req.url.replace('deps', 'dist');
        const targetPath = path.join(__dirname, newPath);
        const wasmContent = fs.readFileSync(targetPath);
        return res.end(wasmContent);
      }
      next();
    });
  },
};

export default defineConfig(({ command }) => {
  const config = {
    base: './',
    build: {
      target: 'esnext',
      rollupOptions: {
        external: ['@aztec/bb.js'],
        output: {
          format: 'es'
        }
      }
    },
    optimizeDeps: {
      esbuildOptions: {
        target: 'esnext'
      }
    },
    esbuild: {
      target: 'esnext',
      supported: {
        'top-level-await': true
      }
    }
  };

  if (command === 'serve') {
    config.plugins = [
      copy({
        targets: [{ src: 'node_modules/**/*.wasm', dest: 'node_modules/.vite/dist' }],
        copySync: true,
        hook: 'buildStart',
      }),
      wasmContentTypePlugin
    ];
  } else {
    // Configuration pour le build
    config.plugins = [
      copy({
        targets: [{ src: 'node_modules/**/*.wasm', dest: 'dist' }],
        copySync: true,
        hook: 'buildStart',
      })
    ];
  }

  return config;
});