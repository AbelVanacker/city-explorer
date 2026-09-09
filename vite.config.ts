import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { port: 3000 },
  // @react-google-maps/api otherwise resolves its own React copy, which breaks hooks.
  resolve: { dedupe: ['react', 'react-dom'] },
});
