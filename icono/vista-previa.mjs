/**
 * Dibuja una maqueta de la pantalla principal con los colores reales, para
 * poder mirar la paleta sin esperar a que compile el APK.
 *
 * Los valores se leen de src/theme.ts, no se copian: si la paleta cambia y
 * esta vista no, sería peor que no tenerla.
 *
 * Uso:  node icono/vista-previa.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';

const aqui = dirname(fileURLToPath(import.meta.url));
const raiz = join(aqui, '..');
const salida = join(aqui, 'salida');

const tema = readFileSync(join(raiz, 'src/theme.ts'), 'utf8');

/** Extrae una de las dos paletas de theme.ts. */
function leerPaleta(nombre) {
  const bloque = new RegExp(`const ${nombre}: Palette = \\{([\\s\\S]*?)\\n\\};`).exec(tema);
  if (!bloque) throw new Error(`no encontré la paleta ${nombre}`);
  const cuerpo = bloque[1];
  const p = {};
  for (const [, clave, valor] of cuerpo.matchAll(/^\s*(\w+):\s*'(#[0-9a-fA-F]{6})',/gm)) {
    p[clave] = valor;
  }
  const grad = /gradient:\s*\[([^\]]+)\]/.exec(cuerpo);
  p.gradient = [...grad[1].matchAll(/'(#[0-9a-fA-F]{6})'/g)].map((m) => m[1]);
  return p;
}

const ANCHO = 420;
const ALTO = 760;
const BORDE = 2.5;

const esc = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;');

function tarjeta(p, { x, y, w, h, quien, hora, texto, fondo }) {
  return `
  <rect x="${x + 3}" y="${y + 3}" width="${w}" height="${h}" rx="22" fill="${p.shadow}"/>
  <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="22"
        fill="${fondo ?? p.surface}" stroke="${p.border}" stroke-width="${BORDE}"/>
  <text x="${x + 18}" y="${y + 32}" font-family="Nunito, sans-serif" font-size="17"
        font-weight="700" fill="${p.ink}">${esc(quien)}</text>
  <text x="${x + w - 18}" y="${y + 32}" text-anchor="end" font-family="Nunito, sans-serif"
        font-size="15" font-weight="700" fill="${p.textMuted}">${esc(hora)}</text>
  <text x="${x + 18}" y="${y + 58}" font-family="Nunito, sans-serif" font-size="15"
        fill="${p.textMuted}">${esc(texto)}</text>`;
}

function pantalla(p, titulo, id) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${ANCHO}" height="${ALTO}" viewBox="0 0 ${ANCHO} ${ALTO}">
  <defs>
    <linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${p.gradient[0]}"/>
      <stop offset="0.45" stop-color="${p.gradient[1]}"/>
      <stop offset="1" stop-color="${p.gradient[2]}"/>
    </linearGradient>
  </defs>
  <rect width="${ANCHO}" height="${ALTO}" fill="url(#${id})"/>

  <text x="24" y="70" font-family="'Playfair Display', Georgia, serif" font-size="32"
        font-weight="700" fill="${p.text}">Programados</text>
  <text x="24" y="98" font-family="Nunito, sans-serif" font-size="15"
        fill="${p.textMuted}">7 mensajes programados</text>

  <text x="24" y="140" font-family="Nunito, sans-serif" font-size="13" font-weight="700"
        letter-spacing="1" fill="${p.warning}">ATRASADO</text>
  ${tarjeta(p, { x: 24, y: 152, w: ANCHO - 48, h: 80, quien: 'Sofi', hora: '09:00',
                 texto: 'Te quería contar lo de ayer', fondo: p.warningSoft })}

  <text x="24" y="276" font-family="Nunito, sans-serif" font-size="13" font-weight="700"
        letter-spacing="1" fill="${p.textMuted}">HOY</text>
  ${tarjeta(p, { x: 24, y: 288, w: ANCHO - 48, h: 80, quien: 'Mamá', hora: '18:00',
                 texto: 'Llego tipo nueve, no me esperen' })}
  ${tarjeta(p, { x: 24, y: 384, w: ANCHO - 48, h: 80, quien: 'Consultorio', hora: '20:30',
                 texto: 'Confirmo el turno del jueves' })}

  <text x="24" y="508" font-family="Nunito, sans-serif" font-size="13" font-weight="700"
        letter-spacing="1" fill="${p.textMuted}">MAÑANA</text>
  ${tarjeta(p, { x: 24, y: 520, w: ANCHO - 48, h: 80, quien: 'Juli', hora: '09:00',
                 texto: 'Feliz cumple!! Que tengas lindo día' })}

  <!-- Vista previa del mensaje, en verde agua -->
  <rect x="150" y="620" width="246" height="56" rx="22" fill="${p.bubble}"
        stroke="${p.border}" stroke-width="${BORDE}"/>
  <text x="168" y="645" font-family="Nunito, sans-serif" font-size="15"
        fill="${p.bubbleText}">Así se va a ver el mensaje</text>
  <text x="380" y="666" text-anchor="end" font-family="Nunito, sans-serif" font-size="11"
        fill="${p.textMuted}">09:00</text>

  <!-- Botón principal -->
  <rect x="${ANCHO - 214}" y="${ALTO - 80}" width="190" height="52" rx="26" fill="${p.shadow}"
        transform="translate(4 5)"/>
  <rect x="${ANCHO - 214}" y="${ALTO - 80}" width="190" height="52" rx="26"
        fill="${p.primary}" stroke="${p.border}" stroke-width="${BORDE}"/>
  <text x="${ANCHO - 119}" y="${ALTO - 47}" text-anchor="middle" font-family="Nunito, sans-serif"
        font-size="17" font-weight="700" fill="${p.primaryText}">＋  Nuevo mensaje</text>

  <text x="24" y="${ALTO - 20}" font-family="Nunito, sans-serif" font-size="13"
        fill="${p.textMuted}">${esc(titulo)}</text>
</svg>`;
}

mkdirSync(salida, { recursive: true });

const claro = pantalla(leerPaleta('light'), 'modo claro', 'cielo-claro');
const oscuro = pantalla(leerPaleta('dark'), 'modo oscuro', 'cielo-oscuro');

// Las dos juntas, para poder compararlas de un vistazo.
const hoja = `<svg xmlns="http://www.w3.org/2000/svg" width="${ANCHO * 2 + 60}" height="${ALTO + 40}" viewBox="0 0 ${ANCHO * 2 + 60} ${ALTO + 40}">
  <rect width="100%" height="100%" fill="#ffffff"/>
  <g transform="translate(20 20)">${claro.replace(/<\/?svg[^>]*>/g, '')}</g>
  <g transform="translate(${ANCHO + 40} 20)">${oscuro.replace(/<\/?svg[^>]*>/g, '')}</g>
</svg>`;

writeFileSync(
  join(salida, 'paleta.png'),
  new Resvg(hoja, { fitTo: { mode: 'width', value: ANCHO * 2 + 60 } }).render().asPng(),
);
console.log('generada paleta.png');
