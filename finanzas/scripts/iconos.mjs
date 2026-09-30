/**
 * Genera los íconos de la app a partir del dibujo del perro, con el
 * navegador de Playwright. Solo hace falta si cambia el dibujo.
 *
 *   node scripts/iconos.mjs
 */
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const perro = `
<g transform="translate(-6 10)">
  <path d="M196 56 Q214 48 220 26" fill="none" stroke="#2b2340" stroke-width="9" stroke-linecap="round"/>
  <path d="M196 56 Q214 48 220 26" fill="none" stroke="#e38a4f" stroke-width="4.5" stroke-linecap="round"/>
  <rect x="166" y="66" width="13" height="32" rx="6.5" fill="#e38a4f" stroke="#2b2340" stroke-width="3"/>
  <rect x="182" y="66" width="13" height="32" rx="6.5" fill="#8b4a2b" stroke="#2b2340" stroke-width="3"/>
  <rect x="88" y="66" width="13" height="32" rx="6.5" fill="#8b4a2b" stroke="#2b2340" stroke-width="3"/>
  <rect x="58" y="38" width="146" height="44" rx="22" fill="#e38a4f" stroke="#2b2340" stroke-width="3"/>
  <path d="M78 70 Q130 84 190 70" fill="none" stroke="#f8dcba" stroke-width="9" stroke-linecap="round"/>
  <rect x="70" y="66" width="13" height="32" rx="6.5" fill="#e38a4f" stroke="#2b2340" stroke-width="3"/>
  <ellipse cx="50" cy="44" rx="25" ry="23" fill="#e38a4f" stroke="#2b2340" stroke-width="3"/>
  <ellipse cx="27" cy="55" rx="20" ry="12" fill="#f8dcba" stroke="#2b2340" stroke-width="3"/>
  <circle cx="10" cy="51" r="5.5" fill="#2b2340"/>
  <path d="M41 40 Q47 34 53 40" fill="none" stroke="#2b2340" stroke-width="3" stroke-linecap="round"/>
  <path d="M18 62 Q26 68 34 62" fill="none" stroke="#2b2340" stroke-width="2.5" stroke-linecap="round"/>
  <path d="M58 26 Q86 30 78 62 Q70 70 62 60 Q56 44 58 26 Z" fill="#8b4a2b" stroke="#2b2340" stroke-width="3" stroke-linejoin="round"/>
</g>`;

function svg(tam, margen) {
  // El perro es largo: se centra en un cuadrado con fondo menta.
  const ancho = 240 * (1 + margen * 2);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${tam}" height="${tam}" viewBox="${-240 * margen} ${60 - ancho / 2} ${ancho} ${ancho}">
    <rect x="${-240 * margen}" y="${60 - ancho / 2}" width="${ancho}" height="${ancho}" fill="#dcf3e4"/>${perro}</svg>`;
}

const navegador = await chromium.launch();
const pagina = await navegador.newPage();
const salidas = [
  ['icon-192.png', 192, 0.08],
  ['icon-512.png', 512, 0.08],
  ['apple-touch-icon.png', 180, 0.1],
  // El "maskable" deja más margen: Android lo recorta con la forma del sistema.
  ['icon-maskable-512.png', 512, 0.25],
];
for (const [nombre, tam, margen] of salidas) {
  await pagina.setViewportSize({ width: tam, height: tam });
  await pagina.setContent(`<body style="margin:0">${svg(tam, margen)}</body>`);
  await pagina.screenshot({ path: join(raiz, 'public', nombre), clip: { x: 0, y: 0, width: tam, height: tam } });
}
await navegador.close();
console.log('Íconos generados en public/.');
