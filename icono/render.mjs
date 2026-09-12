/**
 * Genera los PNG del ícono para Android y el favicon de la web. Se corre a
 * mano cuando cambia el dibujo: `node icono/render.mjs`.
 *
 * Usa Chromium porque los filtros SVG de la acuarela —turbulencia y
 * desplazamiento— los tiene que rasterizar un motor que los soporte de verdad.
 */
import { mkdir, writeFile } from 'node:fs/promises';

import { COLORES, svg } from './icono.mjs';

/**
 * Playwright no es dependencia del proyecto: es la herramienta con la que se
 * genera esto, no algo que la app use. Se busca donde suela estar, y si no,
 * `PLAYWRIGHT` dice dónde.
 */
const dondeBuscar = [
  process.env.PLAYWRIGHT,
  'playwright-core',
  'playwright',
  '/opt/node22/lib/node_modules/playwright/index.mjs',
].filter(Boolean);

let chromium;
for (const donde of dondeBuscar) {
  try {
    ({ chromium } = await import(donde));
    break;
  } catch {
    // Probar el siguiente.
  }
}
if (!chromium) {
  throw new Error(
    'Falta Playwright. Instalalo (npm i -D playwright) o pasá la ruta en PLAYWRIGHT=',
  );
}

const RAIZ = new URL('..', import.meta.url).pathname;
const RES = `${RAIZ}android/app/src/main/res`;

// Los tamaños que espera Android. El frente del ícono adaptativo mide 108dp
// contra los 48dp del cuadrado, y por eso va más grande en cada densidad.
const DENSIDADES = [
  { nombre: 'mdpi', cuadrado: 48, frente: 108 },
  { nombre: 'hdpi', cuadrado: 72, frente: 162 },
  { nombre: 'xhdpi', cuadrado: 96, frente: 216 },
  { nombre: 'xxhdpi', cuadrado: 144, frente: 324 },
  { nombre: 'xxxhdpi', cuadrado: 192, frente: 432 },
];

const navegador = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox'],
});

async function aPng(contenido, lado, transparente) {
  const pagina = await navegador.newPage({
    viewport: { width: lado, height: lado },
    deviceScaleFactor: 1,
  });
  await pagina.setContent(
    `<style>html,body{margin:0;padding:0;background:${transparente ? 'transparent' : COLORES.fondo}}
     svg{display:block;width:${lado}px;height:${lado}px}</style>${contenido}`,
  );
  await pagina.waitForTimeout(120);
  const png = await pagina.screenshot({ omitBackground: transparente });
  await pagina.close();
  return png;
}

const conFondo = svg({ conFondo: true, escala: 1 });
/**
 * El frente va más chico que el ícono cuadrado. De los 108dp del frente, el
 * teléfono muestra los 72dp del centro —el resto es margen para el recorte y
 * para el movimiento al arrastrarlo— y sólo garantiza que se vean los 66
 * centrales. Lo que se dibuja afuera de eso se lo puede comer cualquier
 * teléfono con una máscara distinta.
 */
const frente = svg({ conFondo: false, escala: 0.72 });

for (const d of DENSIDADES) {
  const carpeta = `${RES}/mipmap-${d.nombre}`;
  await mkdir(carpeta, { recursive: true });
  const cuadrado = await aPng(conFondo, d.cuadrado, false);
  await writeFile(`${carpeta}/ic_launcher.png`, cuadrado);
  await writeFile(`${carpeta}/ic_launcher_round.png`, cuadrado);
  await writeFile(`${carpeta}/ic_launcher_foreground.png`, await aPng(frente, d.frente, true));
  console.log(`${d.nombre}: ${d.cuadrado}px y frente ${d.frente}px`);
}

/**
 * El favicon de la web. Va en PNG y no en SVG: los filtros de la acuarela son
 * justamente lo que los navegadores no rasterizan igual —o directamente no
 * rasterizan— cuando el SVG entra por un `<link rel="icon">`.
 */
await writeFile(`${RAIZ}public/favicon.png`, await aPng(conFondo, 256, false));
console.log('favicon.png');

await navegador.close();
