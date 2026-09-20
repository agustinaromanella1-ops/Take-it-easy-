import { defineConfig } from 'vitest/config';

// Las pruebas corren en horario argentino, que es donde corre la app. Varias
// reglas del proyecto dependen de eso: un sello UTC de las 01:00 es el día
// anterior acá, y una prueba que corriera en UTC no vería la diferencia.
process.env.TZ = 'America/Argentina/Buenos_Aires';

/**
 * La fecha del último commit. Si no hay git a mano, la de ahora.
 *
 * `PIPI_VERSION` la pisa. Existe para `e2e/actualizacion.mjs`, que necesita
 * compilar dos veces el MISMO fuente y que la segunda cuente como una versión
 * nueva; sin esto no podría probar la barra de actualizar, que es justo lo que
 * ya se rompió dos veces.
 */
function fechaDeLaVersion(): string {
  if (process.env.PIPI_VERSION) return process.env.PIPI_VERSION;
  try {
    return execSync('git log -1 --format=%cI', { encoding: 'utf8' }).trim();
  } catch {
    return new Date().toISOString();
  }
}
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { execSync } from 'node:child_process';

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
        /*
         * El celeste del amanecer de la app, no el gris de la paleta vieja.
         *
         * `background_color` es lo que Android pinta en la pantalla de arranque
         * detrás del ícono, y `theme_color` la barra de estado. Con el valor
         * viejo, abrir la app instalada empezaba con un destello gris que no es
         * de ninguna pantalla. Conviene tenerlo bien ANTES de envolverla para
         * Play: después, cambiarlo pide publicar una versión nueva.
         */
        background_color: '#d9ebfb',
        theme_color: '#d9ebfb',
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
  // La fecha de la versión, para mostrarla en Ajustes. Sin un dato visible,
  // "¿se actualizó?" solo se puede responder buscando alguna pantalla nueva.
  //
  // Es la del último commit y NO la de la compilación: con la hora de
  // compilar, dos compilaciones del mismo fuente daban archivos con distinto
  // nombre, así que un commit que solo tocara el README le hacía aparecer la
  // barra de "hay una versión nueva" a todo el mundo, con su descarga al
  // pedo. La barra tiene que significar "hay algo nuevo para vos".
  define: { __COMPILADA__: JSON.stringify(fechaDeLaVersion()) },
  base: '/',
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
