/**
 * Genera las tres direcciones de icono para "Listo para enviar".
 *
 * El icono tiene que leerse como hermano del de Pipí Cucú, que es
 * tipográfico: una letra en Playfair Display sobre un degradado pastel en
 * diagonal, con un acento naranja. Nada de contorno grueso ni sombra dura —
 * ese registro lo usa el perro, no el icono.
 *
 * Los valores están tomados del PNG original:
 *   degradado  #e8e3f5 (arriba izq) -> #fde4d6 (abajo der)
 *   letra      #2f6273
 *   acento     #ad5417
 *
 * Uso:  node icono/direcciones.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import opentype from 'opentype.js';
import { Resvg } from '@resvg/resvg-js';

const aqui = dirname(fileURLToPath(import.meta.url));
const raiz = join(aqui, '..');
const salida = join(aqui, 'salida');

const LIENZO = 1024;
const GRAD_A = '#e8e3f5';
const GRAD_B = '#fde4d6';
const TINTA = '#2f6273';
const ACENTO = '#ad5417';

// Ojo con el .buffer de un Buffer de Node: devuelve el pool entero, no este
// archivo. Sin el slice, opentype parsea basura y el glifo sale deformado.
const ttf = readFileSync(
  join(
    raiz,
    'node_modules/@expo-google-fonts/playfair-display/700Bold/PlayfairDisplay_700Bold.ttf',
  ),
);
const fuente = opentype.parse(
  ttf.buffer.slice(ttf.byteOffset, ttf.byteOffset + ttf.byteLength),
);

/** Camino de un glifo, centrado en (cx, cy) con la altura pedida. */
function glifo(texto, altura, cx, cy) {
  const escala = altura / (fuente.unitsPerEm * 0.7);
  const tam = fuente.unitsPerEm * escala;
  const camino = fuente.getPath(texto, 0, 0, tam);
  const { x1, y1, x2, y2 } = camino.getBoundingBox();
  const dx = cx - (x1 + x2) / 2;
  const dy = cy - (y1 + y2) / 2;
  return `<path d="${camino.toPathData(2)}" transform="translate(${dx.toFixed(2)} ${dy.toFixed(2)})" fill="${TINTA}"/>`;
}

const envoltura = (contenido) => `<svg xmlns="http://www.w3.org/2000/svg" width="${LIENZO}" height="${LIENZO}" viewBox="0 0 ${LIENZO} ${LIENZO}">
  <defs>
    <linearGradient id="cielo" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${GRAD_A}"/>
      <stop offset="1" stop-color="${GRAD_B}"/>
    </linearGradient>
  </defs>
  <rect width="${LIENZO}" height="${LIENZO}" fill="url(#cielo)"/>
${contenido}
</svg>`;

/* ------------------------------------------------------------------ *
 * A — La "L" con el acento
 * El hermano directo: misma construcción que la "P", cambiando la letra.
 * El acento naranja pasa de ser la tilde de "Pipí" a ser la aguja de un
 * reloj: el mismo gesto diagonal, ahora significando la hora elegida.
 * ------------------------------------------------------------------ */
const A = envoltura(`  ${glifo('L', 480, 430, 560)}
  <g transform="translate(726 300)">
    <circle r="118" fill="none" stroke="${ACENTO}" stroke-width="34"/>
    <line x1="0" y1="0" x2="0" y2="-64" stroke="${ACENTO}" stroke-width="30" stroke-linecap="round"/>
    <line x1="0" y1="0" x2="-58" y2="0" stroke="${ACENTO}" stroke-width="30" stroke-linecap="round"/>
  </g>`);

/* ------------------------------------------------------------------ *
 * B — Las nueve en punto
 * Sin letra. Una esfera con el trazo modulado del serif: el círculo es
 * grueso a los costados y fino arriba y abajo, como la panza de una "O" de
 * Playfair. La aguja de la hora en naranja.
 * ------------------------------------------------------------------ */
const B = envoltura(`  <!-- El anillo no tiene grosor parejo: es más grueso a los costados y más
       fino arriba y abajo, como la panza de una "O" de Playfair. Eso es lo que
       lo emparenta con el icono de Pipí Cucú sin usar una letra. -->
  <path d="M 244 512 a 268 268 0 1 0 536 0 a 268 268 0 1 0 -536 0 z
           M 280 512 a 232 240 0 1 0 464 0 a 232 240 0 1 0 -464 0 z"
        fill-rule="evenodd" fill="${TINTA}"/>
  <g transform="translate(512 512)">
    <line x1="0" y1="0" x2="0" y2="-158" stroke="${TINTA}" stroke-width="32" stroke-linecap="round"/>
    <line x1="0" y1="0" x2="-138" y2="0" stroke="${ACENTO}" stroke-width="36" stroke-linecap="round"/>
    <circle r="24" fill="${TINTA}"/>
  </g>`);

/* ------------------------------------------------------------------ *
 * C — La burbuja y el acento
 * Una burbuja de diálogo con el peso de un trazo serif, y encima el acento
 * naranja de Pipí Cucú, que acá marca el momento elegido. Es la que más
 * dice "mensajes" conservando la firma de la familia.
 * ------------------------------------------------------------------ */
const C = envoltura(`  <path d="M 300 250 h 424 a 90 90 0 0 1 90 90 v 270 a 90 90 0 0 1 -90 90
           h -254 l -90 122 v -122 h -80 a 90 90 0 0 1 -90 -90 v -270
           a 90 90 0 0 1 90 -90 z"
        fill="none" stroke="${TINTA}" stroke-width="40" stroke-linejoin="round"/>
  <g transform="translate(512 470)">
    <line x1="0" y1="0" x2="0" y2="-132" stroke="${TINTA}" stroke-width="32" stroke-linecap="round"/>
    <line x1="0" y1="0" x2="-112" y2="0" stroke="${ACENTO}" stroke-width="36" stroke-linecap="round"/>
    <circle r="22" fill="${TINTA}"/>
  </g>`);

const direcciones = [
  ['a-letra', A],
  ['b-reloj', B],
  ['c-burbuja', C],
];

mkdirSync(salida, { recursive: true });

for (const [nombre, svg] of direcciones) {
  writeFileSync(join(salida, `${nombre}.svg`), svg);

  // 1024 para mirarla, y 48 que es el tamaño real en el cajón de apps:
  // es la única prueba que importa.
  for (const px of [1024, 48]) {
    const png = new Resvg(svg, { fitTo: { mode: 'width', value: px } })
      .render()
      .asPng();
    writeFileSync(join(salida, `${nombre}-${px}.png`), png);
  }
  console.log('generada', nombre);
}

/* ------------------------------------------------------------------ *
 * Prueba de 48 px
 * El único tamaño que importa: así se ve en el cajón de apps. Ampliamos sin
 * suavizado para ver exactamente los píxeles que va a dibujar el sistema.
 * ------------------------------------------------------------------ */
const AMPLIADO = 288;
const muestras = direcciones
  .map(([nombre], i) => {
    const b64 = readFileSync(join(salida, `${nombre}-48.png`)).toString('base64');
    const x = 40 + i * (AMPLIADO + 40);
    return `  <image x="${x}" y="40" width="${AMPLIADO}" height="${AMPLIADO}"
         image-rendering="pixelated" href="data:image/png;base64,${b64}"/>
  <text x="${x + AMPLIADO / 2}" y="${AMPLIADO + 78}" text-anchor="middle"
        font-family="sans-serif" font-size="22" fill="#1f1e47">${nombre}</text>`;
  })
  .join('\n');

const ancho = 80 + direcciones.length * AMPLIADO + (direcciones.length - 1) * 40;
const hoja = `<svg xmlns="http://www.w3.org/2000/svg" width="${ancho}" height="${AMPLIADO + 110}" viewBox="0 0 ${ancho} ${AMPLIADO + 110}">
  <rect width="100%" height="100%" fill="#ffffff"/>
${muestras}
</svg>`;

writeFileSync(
  join(salida, 'prueba-48px.png'),
  new Resvg(hoja, { fitTo: { mode: 'width', value: ancho } }).render().asPng(),
);
console.log('generada prueba-48px');
