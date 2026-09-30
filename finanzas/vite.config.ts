import { defineConfig, type Plugin } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { execSync } from 'node:child_process';

// Las pruebas corren en horario argentino, que es donde corre la app: un sello
// UTC de la 1 de la mañana es el día anterior acá.
process.env.TZ = 'America/Argentina/Buenos_Aires';

/** La fecha del último commit: dos compilaciones del mismo fuente son la misma versión. */
function fechaDeLaVersion(): string {
  if (process.env.SALCHI_VERSION) return process.env.SALCHI_VERSION;
  try {
    return execSync('git log -1 --format=%cI', { encoding: 'utf8' }).trim();
  } catch {
    return new Date().toISOString();
  }
}

/**
 * La promesa "nada sale del dispositivo", puesta donde el navegador la hace
 * cumplir.
 *
 * `connect-src 'self'` le prohíbe a la página y a sus workers hablar con
 * cualquier otro origen: si mañana una dependencia intenta mandar algo afuera,
 * el navegador la frena. Solo va en la compilación: el servidor de desarrollo
 * necesita scripts en línea y su websocket.
 *
 * `wasm-unsafe-eval` es lo mínimo que pide el lector de texto para compilar su
 * WebAssembly; no habilita `eval` de JavaScript.
 */
function politicaDeContenido(): Plugin {
  const politica = [
    "default-src 'self'",
    "script-src 'self' 'wasm-unsafe-eval'",
    "worker-src 'self' blob:",
    "connect-src 'self'",
    "img-src 'self' blob: data:",
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'none'",
  ].join('; ');
  return {
    name: 'politica-de-contenido',
    apply: 'build',
    transformIndexHtml(html) {
      return html.replace(
        '<meta charset="UTF-8" />',
        `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${politica}" />`,
      );
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    politicaDeContenido(),
    VitePWA({
      // 'prompt' y no 'autoUpdate': con autoUpdate la librería recarga sola y
      // la barra de "hay una versión nueva" nunca llega. Ver src/pwa.ts.
      registerType: 'prompt',
      includeAssets: ['icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'apple-touch-icon.png'],
      manifest: {
        name: 'Salchi — la plata, de a poquito',
        short_name: 'Salchi',
        description: 'Anotá gastos en dos toques, mirá cuánto podés usar y qué vence. Todo queda en tu teléfono.',
        lang: 'es-AR',
        dir: 'ltr',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#FBF8F4',
        theme_color: '#FBF8F4',
        categories: ['finance', 'productivity'],
        // Mantener apretado el ícono muestra estos atajos: anotar sin pasar por Hoy.
        shortcuts: [
          { name: 'Anotar un gasto', short_name: 'Anotar', url: '/?accion=anotar', icons: [{ src: '/icon-192.png', sizes: '192x192' }] },
          { name: 'Leer un comprobante', short_name: 'Comprobante', url: '/?accion=foto', icons: [{ src: '/icon-192.png', sizes: '192x192' }] },
          { name: 'Lo que vence', short_name: 'Vence', url: '/?accion=vence', icons: [{ src: '/icon-192.png', sizes: '192x192' }] },
        ],
        // "Compartir" un texto hacia Salchi (el aviso del banco, un mensaje)
        // abre Anotar con esa frase. Por GET: no hace falta servidor.
        share_target: { action: '/', method: 'GET', params: { title: 'titulo', text: 'texto' } },
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,woff2,woff,png,svg,gif}'],
        // El lector de texto pesa unos 6 MB y no todo el mundo lo va a usar:
        // no se baja de entrada. Se guarda la primera vez que se lee un
        // comprobante y desde ahí funciona sin conexión.
        globIgnores: ['ocr/**'],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/ocr/'),
            handler: 'CacheFirst',
            options: { cacheName: 'lector-de-texto', expiration: { maxEntries: 10 } },
          },
        ],
        cleanupOutdatedCaches: true,
        navigateFallback: '/index.html',
        // El servicio para compartir no es una página: nunca se responde con la app.
        navigateFallbackDenylist: [/^\/api\//],
      },
      devOptions: { enabled: false },
    }),
  ],
  define: { __COMPILADA__: JSON.stringify(fechaDeLaVersion()) },
  base: '/',
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts', 'server/**/*.test.ts'],
  },
});
