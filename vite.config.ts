/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/setupTests.ts'],
    globals: true,
    // supabase/tests/ é um script de integração contra um projeto real (roda
    // com `node`, não com o runner do Vitest) — não faz parte desta suíte.
    exclude: ['node_modules/**', 'supabase/**'],
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // Bluetooth/impressão nativa não passa por aqui (isso é o app WEB
      // instalável); o app empacotado com Capacitor usa os plugins nativos.
      manifest: {
        name: 'Abz Gestão',
        short_name: 'Abz Gestão',
        description: 'Gestão operacional do Abrazo Drink Bar',
        start_url: '/',
        display: 'standalone',
        background_color: '#150f0b',
        theme_color: '#150f0b',
        icons: [
          { src: '/pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/pwa-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
    }),
  ],
})
