import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [react()],
    define: {
      'process.env.GOOGLE_KEY_1': JSON.stringify(env.GOOGLE_KEY_1),
      'process.env.GOOGLE_KEY_2': JSON.stringify(env.GOOGLE_KEY_2),
      'process.env.GOOGLE_KEY_3': JSON.stringify(env.GOOGLE_KEY_3),
      'process.env.GOOGLE_KEY_4': JSON.stringify(env.GOOGLE_KEY_4),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    }
  };
});
