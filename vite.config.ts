import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // 'prompt' y no 'autoUpdate': con autoUpdate la librería ignora el
      // onNeedRefresh de src/pwa.ts y recarga la página sola, que es
      // justamente lo que se quiso sacar. Con 'prompt' el aviso llega a la app
      // y aparece la barra de "hay una versión nueva".
      registerType: 'prompt',
      includeAssets: ['apple-touch-icon.png', 'favicon-48.png', 'fonts/*.woff2', 'pipi-cucu-dog-flying.gif', 'pipi-cucu-dog-static.png', 'pipi-cucu-clouds.webp'],
      manifest: {
        name: 'Pipí Cucú — tu agenda, pipí cucú',
        short_name: 'Pipí Cucú',
        description: 'Tu agenda, pipí cucú. Pacientes, sesiones y honorarios para consultorio psicológico.',
        lang: 'es',
        dir: 'ltr',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#eef2f7',
        theme_color: '#eef2f7',
        categories: ['productivity', 'medical', 'finance'],
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          // Android recorta el ícono con la forma del sistema: el "maskable"
          // tiene el contenido más adentro para que no le corte la P.
          { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Todo lo que la app necesita para arrancar queda guardado de entrada,
        // así funciona sin conexión desde la primera visita.
        globPatterns: ['**/*.{js,css,html,woff2,png,svg,ico,webp,gif}'],
        // Las fuentes pesan; el tope por defecto de 2 MB no alcanzaría si la
        // app creciera.
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        cleanupOutdatedCaches: true,
        navigateFallback: '/index.html',
      },
      devOptions: { enabled: false },
    }),
  ],
  // La fecha de compilación, para mostrarla en Ajustes. Sin un dato visible,
  // "¿se actualizó?" solo se puede responder buscando alguna pantalla nueva.
  define: { __COMPILADA__: JSON.stringify(new Date().toISOString()) },
  base: '/',
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
