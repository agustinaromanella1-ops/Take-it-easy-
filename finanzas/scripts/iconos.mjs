/**
 * Genera los íconos de la app con el perro de Pipí Cucú tal cual
 * (`public/pipi-cucu-dog-static.png`, copia exacta del de la app hermana),
 * centrado sobre el fondo menta. El dibujo no se toca: solo se ubica.
 *
 *   node scripts/iconos.mjs
 */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const perro = `data:image/png;base64,${readFileSync(join(raiz, 'public', 'pipi-cucu-dog-static.png')).toString('base64')}`;

const navegador = await chromium.launch();
const pagina = await navegador.newPage();
const salidas = [
  // [archivo, tamaño, ancho del perro sobre el tamaño]
  ['icon-192.png', 192, 0.9],
  ['icon-512.png', 512, 0.9],
  ['apple-touch-icon.png', 180, 0.86],
  // El "maskable" deja más margen: Android lo recorta con la forma del sistema.
  ['icon-maskable-512.png', 512, 0.66],
];
for (const [nombre, tam, proporcion] of salidas) {
  await pagina.setViewportSize({ width: tam, height: tam });
  await pagina.setContent(
    `<body style="margin:0;width:${tam}px;height:${tam}px;background:#dcf3e4;display:flex;align-items:center;justify-content:center">
       <img src="${perro}" style="width:${Math.round(tam * proporcion)}px;height:auto">
     </body>`,
  );
  await pagina.waitForFunction(() => document.images[0]?.complete);
  await pagina.screenshot({ path: join(raiz, 'public', nombre), clip: { x: 0, y: 0, width: tam, height: tam } });
}
await navegador.close();
console.log('Íconos generados en public/ con el perro de Pipí Cucú.');
