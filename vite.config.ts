import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: process.env.VITE_BASE ?? '/',
  // Os arquivos do PDF rodam dentro de um Web Worker: sem o "react-refresh"
  // do modo dev (ele usa `window`, que não existe no Worker).
  plugins: [react({ exclude: /\/src\/tools\/scorecomps\/pdf\// })],
  worker: { format: 'es' },
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 2500,
  },
  server: { port: 5173, strictPort: true },
  preview: { port: 5173, strictPort: true },
})
