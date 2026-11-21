import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(() => {
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
        allowedHosts: true,
        hmr: false,
        ws: false,
        // INICIO DE LA MAGIA DEL PROXY
        proxy: {
          '/api/dnit': {
            target: 'https://ruc.sun.com.py',
            changeOrigin: true,
            rewrite: (path) => path.replace(/^\/api\/dnit/, ''),
          }
        }
        // FIN DE LA MAGIA
      },
      plugins: [react()],
      build: {
        outDir: 'dist',
        emptyOutDir: true,
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});