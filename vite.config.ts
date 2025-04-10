import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000, // or any preferred port
  },
  resolve: {
    alias: {
      '@': '/src', // Example alias for your src folder
    },
  },
});
