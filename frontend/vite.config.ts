import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react(), tailwindcss()],
    server: {
      port: 5173,
      // Forward /api/* to the FastAPI backend. The browser only ever talks to
      // this dev server, so there are no CORS problems whatever host/port
      // you open the dashboard on.
      proxy: {
        '/api': { target: env.BACKEND_URL || 'http://localhost:8000', changeOrigin: true },
      },
    },
  };
});
