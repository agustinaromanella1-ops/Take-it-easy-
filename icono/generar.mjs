/**
 * Dibuja el icono definitivo y exporta los archivos que piden las tiendas.
 *
 * El dibujo es el que eligió Agustina —una burbuja de diálogo con las agujas
 * marcando las nueve— redibujado como vector y con la paleta de la app.
 *
 * Por qué no se usa su verde original (#058065): está a distancia 89 del verde
 * de WhatsApp (#25d366) en RGB, y una burbuja de chat sobre un verde así se lee
 * como "app oficial de WhatsApp". Para una app cuya función es abrir WhatsApp,
 * eso es riesgo de rechazo en la tienda y de marca. La tinta de la app,
 * #123f3c, está a 155: casi el doble de lejos, y además es el color con el que
 * ya está pintada la app entera.
 *
 * Uso:  node icono/generar.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';

const aqui = dirname(fileURLToPath(import.meta.url));
const raiz = join(aqui, '..');
const previa = join(aqui, 'salida');
const assets = join(raiz, 'assets');

/** Colores leídos de theme.ts, para que el icono no se despegue de la app. */
const tema = readFileSync(join(raiz, 'src/theme.ts'), 'utf8');
const color = (clave) => {
  const m = new RegExp(`^\\s*${clave}: '(#[0-9a-fA-F]{6})',`, 'm').exec(
    tema.slice(tema.indexOf('const light')),
  );
  if (!m) throw new Error(`no encontré ${clave} en theme.ts`);
  return m[1];
};

const TINTA = color('ink');
const CREMA = color('surface') === '#ffffff' ? '#fdf9f2' : color('surface');
const CORAL = color('primary');
const GRAD = /gradient: \['(#[0-9a-f]{6})', '(#[0-9a-f]{6})', '(#[0-9a-f]{6})'\]/.exec(
  tema.slice(tema.indexOf('const light')),
);

const LIENZO = 1024;

/**
 * El dibujo, centrado en (0,0) y pensado para un cuadrado de 1024.
 *
 * `escala` lo achica para el icono adaptativo de Android: el sistema recorta el
 * borde con máscaras distintas según el fabricante, así que todo lo importante
 * tiene que vivir en el 66 % central.
 */
function burbuja({ relleno, agujas, minutero, escala = 1 }) {
  const r = 300;
  // La colita corre el dibujo hacia abajo y a la derecha, así que el centro
  // óptico no es el geométrico: sin esta corrección el icono se ve desplazado.
  const CORRECCION = 'translate(-22 5)';
  return `<g transform="translate(${LIENZO / 2} ${LIENZO / 2}) scale(${escala}) ${CORRECCION}">
    <g transform="translate(0 -30)">
      <circle cx="0" cy="0" r="${r}" fill="${relleno}"/>
      <!-- La colita: sale a las cuatro y media y baja hacia afuera. -->
      <path d="M 256 156 Q 334 238 344 350 Q 248 312 150 260 Z" fill="${relleno}"/>
    </g>
    <g stroke-linecap="round" fill="none">
      <!-- Minutero a las 12 y horario a las 9: las nueve en punto. -->
      <line x1="0" y1="-30" x2="0" y2="-206" stroke="${minutero}" stroke-width="46"/>
      <line x1="0" y1="-30" x2="-176" y2="-30" stroke="${agujas}" stroke-width="46"/>
    </g>
    <circle cx="0" cy="-30" r="32" fill="${agujas}"/>
  </g>`;
}

const svg = (fondo, contenido, defs = '') =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${LIENZO}" height="${LIENZO}" viewBox="0 0 ${LIENZO} ${LIENZO}">
  ${defs}
  ${fondo}
  ${contenido}
</svg>`;

const DEGRADADO = `<defs>
    <linearGradient id="cielo" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${GRAD[1]}"/>
      <stop offset="0.5" stop-color="${GRAD[2]}"/>
      <stop offset="1" stop-color="${GRAD[3]}"/>
    </linearGradient>
  </defs>`;

/** A — la composición de Agustina, con la tinta de la app. */
const variantes = {
  'a-tinta': svg(
    `<rect width="${LIENZO}" height="${LIENZO}" fill="${TINTA}"/>`,
    burbuja({ relleno: CREMA, agujas: TINTA, minutero: TINTA }),
  ),
  /** B — la versión de familia: el mismo cielo pastel del icono de Pipí Cucú. */
  'b-atardecer': svg(
    `<rect width="${LIENZO}" height="${LIENZO}" fill="url(#cielo)"/>`,
    burbuja({ relleno: TINTA, agujas: CREMA, minutero: CORAL }),
    DEGRADADO,
  ),
};

const rend = (s, px) =>
  new Resvg(s, { fitTo: { mode: 'width', value: px } }).render().asPng();

mkdirSync(previa, { recursive: true });
mkdirSync(assets, { recursive: true });

for (const [nombre, s] of Object.entries(variantes)) {
  writeFileSync(join(previa, `icono-${nombre}.svg`), s);
  for (const px of [1024, 48]) {
    writeFileSync(join(previa, `icono-${nombre}-${px}.png`), rend(s, px));
  }
  console.log('variante', nombre);
}

/* ---------------------------------------------------------------- *
 * Hoja de comparación a 48 px, que es el tamaño real en el cajón
 * ---------------------------------------------------------------- */
const AMP = 288;
const nombres = Object.keys(variantes);
const muestras = nombres
  .map((n, i) => {
    const b64 = readFileSync(join(previa, `icono-${n}-48.png`)).toString('base64');
    const x = 40 + i * (AMP + 40);
    return `  <image x="${x}" y="40" width="${AMP}" height="${AMP}"
         image-rendering="pixelated" href="data:image/png;base64,${b64}"/>
  <text x="${x + AMP / 2}" y="${AMP + 78}" text-anchor="middle"
        font-family="sans-serif" font-size="22" fill="#123f3c">${n}</text>`;
  })
  .join('\n');
const ancho = 80 + nombres.length * AMP + (nombres.length - 1) * 40;
writeFileSync(
  join(previa, 'icono-prueba-48px.png'),
  rend(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${ancho}" height="${AMP + 110}" viewBox="0 0 ${ancho} ${AMP + 110}">
      <rect width="100%" height="100%" fill="#ffffff"/>${muestras}</svg>`,
    ancho,
  ),
);
console.log('hoja de 48 px');

/* ---------------------------------------------------------------- *
 * Los archivos que piden las tiendas
 * ---------------------------------------------------------------- */

/** El que se publica. Cambiar acá si se elige la otra variante. */
const ELEGIDA = 'a-tinta';
const dibujo = burbuja({ relleno: CREMA, agujas: TINTA, minutero: TINTA });

// iOS y el icono de respaldo: cuadrado lleno, sin transparencia ni esquinas
// redondeadas propias. La máscara la aplica el sistema.
writeFileSync(
  join(assets, 'icon.png'),
  rend(svg(`<rect width="${LIENZO}" height="${LIENZO}" fill="${TINTA}"/>`, dibujo), 1024),
);

// Android recorta el borde con máscaras distintas según el fabricante, así que
// el primer plano va achicado: todo lo importante tiene que caber en el 66 %
// central. El fondo lo pone app.json como color plano.
writeFileSync(
  join(assets, 'adaptive-icon.png'),
  rend(
    svg('', burbuja({ relleno: CREMA, agujas: TINTA, minutero: TINTA, escala: 0.92 })),
    1024,
  ),
);

// El splash va invertido: el fondo de arranque es el verde agua claro de la
// app, así que una burbuja crema encima no se vería. Además así la pantalla
// de arranque es del mismo color que la app y no hay un salto de oscuro a
// claro al abrir.
writeFileSync(
  join(assets, 'splash-icon.png'),
  rend(svg('', burbuja({ relleno: TINTA, agujas: CREMA, minutero: CREMA })), 1024),
);

console.log('assets escritos a partir de la variante', ELEGIDA);
