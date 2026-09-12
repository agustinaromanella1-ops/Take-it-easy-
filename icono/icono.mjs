/**
 * El ícono de la app: la cara de un perrito salchicha con los ojos cerrados y
 * una T. arriba, pintado como una acuarela.
 *
 * Está dibujado acá y no guardado como imagen suelta para que se pueda volver
 * a generar: los PNG de Android son diez archivos en cinco tamaños, y a mano
 * eso se desincroniza el primer día que alguien toca un color.
 *
 * La acuarela se hace con tres cosas, y las tres son filtros SVG:
 *
 * - `feTurbulence` + `feDisplacementMap` deforman el borde de cada mancha, que
 *   es lo que distingue una acuarela de una figura vectorial.
 * - Cada mancha se pinta dos veces, con semillas distintas y poca opacidad, y
 *   donde se superponen el color queda más cargado. Es lo que hace el agua.
 * - Un borde más oscuro y difuminado por fuera, que es el pigmento que la
 *   acuarela empuja hacia el filo al secarse.
 */

export const COLORES = {
  fondo: '#fff4ea',
  papel: '#f6e4d3',
  pelo: '#bd7838',
  peloOscuro: '#9a5a28',
  oreja: '#87451e',
  hocico: '#e0b787',
  nariz: '#4a3328',
  ojo: '#4a3328',
  letra: '#7b5ea7',
};

/** El dibujo, centrado en un lienzo de 512. */
function arte() {
  const c = COLORES;
  return `
  <!-- Orejas: largas, anchas y caídas, colgando del costado del cráneo. Es lo
       primero que se reconoce de un salchicha, y lo único que sobrevive
       entero cuando el ícono se dibuja a 48 píxeles. -->
  ${mancha('M 186 214 C 132 226, 108 300, 120 368 C 130 428, 172 452, 198 424 C 216 404, 202 330, 206 262 Z', c.oreja, 11)}
  ${mancha('M 326 214 C 380 226, 404 300, 392 368 C 382 428, 340 452, 314 424 C 296 404, 310 330, 306 262 Z', c.oreja, 23)}

  <!-- El cráneo: redondeado y ancho arriba, angostándose hacia el morro. -->
  ${mancha('M 256 186 C 316 186, 342 228, 340 276 C 338 314, 326 338, 306 352 C 290 364, 274 368, 256 368 C 238 368, 222 364, 206 352 C 186 338, 174 314, 172 276 C 170 228, 196 186, 256 186 Z', c.pelo, 5)}

  <!-- El morro: largo y angosto, que es la otra mitad de la raza. Sin esto la
       cara es la de cualquier perro de orejas largas. -->
  ${mancha('M 214 336 C 224 330, 288 330, 298 336 C 306 356, 302 400, 296 426 C 290 450, 274 462, 256 462 C 238 462, 222 450, 216 426 C 210 400, 206 356, 214 336 Z', c.hocico, 17)}

  <!-- Ojos cerrados: el párpado bajo, curvado hacia abajo en las puntas. -->
  ${trazo('M 200 292 C 212 274, 238 274, 250 292', c.ojo, 9, 31)}
  ${trazo('M 262 292 C 274 274, 300 274, 312 292', c.ojo, 9, 37)}

  <!-- La nariz, en la punta del morro. -->
  ${mancha('M 256 404 C 274 404, 284 414, 282 424 C 280 435, 269 440, 256 440 C 243 440, 232 435, 230 424 C 228 414, 238 404, 256 404 Z', c.nariz, 41)}
  ${trazo('M 256 440 L 256 450', c.nariz, 5, 43)}
  ${trazo('M 236 450 C 243 459, 253 459, 256 450', c.nariz, 5, 47)}
  ${trazo('M 256 450 C 259 459, 269 459, 276 450', c.nariz, 5, 53)}

  <!-- La T con el punto. Dibujada, no tipografiada: así la acuarela la toca
       igual que al resto y no depende de que haya una fuente. -->
  ${mancha('M 186 50 L 304 50 L 304 84 L 262 84 L 262 164 L 228 164 L 228 84 L 186 84 Z', c.letra, 59)}
  ${mancha('M 330 147 m -17 0 a 17 17 0 1 0 34 0 a 17 17 0 1 0 -34 0', c.letra, 61)}
  `;
}

/**
 * Una mancha de acuarela: dos capas translúcidas con bordes deformados
 * distinto, y el filo más cargado.
 */
function mancha(d, color, semilla) {
  return `
  <g>
    <path d="${d}" fill="${color}" opacity="0.34" filter="url(#agua${semilla})"/>
    <path d="${d}" fill="${color}" opacity="0.42" filter="url(#agua${semilla + 1})"/>
    <path d="${d}" fill="none" stroke="${color}" stroke-width="7" opacity="0.30"
          filter="url(#filo${semilla})"/>
  </g>`;
}

/** Un trazo de pincel: una línea, con la misma deformación. */
function trazo(d, color, grosor, semilla) {
  return `
  <g>
    <path d="${d}" fill="none" stroke="${color}" stroke-width="${grosor}" stroke-linecap="round"
          opacity="0.55" filter="url(#agua${semilla})"/>
    <path d="${d}" fill="none" stroke="${color}" stroke-width="${grosor * 0.7}" stroke-linecap="round"
          opacity="0.55" filter="url(#agua${semilla + 1})"/>
  </g>`;
}

const SEMILLAS = [5, 6, 11, 12, 17, 18, 23, 24, 31, 32, 37, 38, 41, 42, 43, 44, 47, 48, 53, 54, 59, 60, 61, 62];

function filtros() {
  const agua = SEMILLAS.map(
    (s) => `
    <filter id="agua${s}" x="-30%" y="-30%" width="160%" height="160%">
      <feTurbulence type="fractalNoise" baseFrequency="0.022" numOctaves="4" seed="${s}" result="r"/>
      <feDisplacementMap in="SourceGraphic" in2="r" scale="16"
                         xChannelSelector="R" yChannelSelector="G"/>
    </filter>`,
  ).join('');

  const filo = SEMILLAS.map(
    (s) => `
    <filter id="filo${s}" x="-30%" y="-30%" width="160%" height="160%">
      <feTurbulence type="fractalNoise" baseFrequency="0.03" numOctaves="4" seed="${s + 100}" result="r"/>
      <feDisplacementMap in="SourceGraphic" in2="r" scale="18"
                         xChannelSelector="R" yChannelSelector="G" result="d"/>
      <feGaussianBlur in="d" stdDeviation="2.5"/>
    </filter>`,
  ).join('');

  return agua + filo;
}

/**
 * El grano del papel. Va encima de todo y en modo multiplicar, que es como se
 * comporta el pigmento cuando se asienta en la fibra.
 */
function grano(lado) {
  return `
  <filter id="grano">
    <feTurbulence type="fractalNoise" baseFrequency="0.75" numOctaves="4" seed="9"/>
    <feColorMatrix type="saturate" values="0"/>
    <feComponentTransfer><feFuncA type="linear" slope="0.5"/></feComponentTransfer>
  </filter>
  <rect id="papel" width="${lado}" height="${lado}" filter="url(#grano)"/>`;
}

/**
 * @param {{ conFondo: boolean, escala: number }} opciones
 *   `conFondo` para el ícono cuadrado y redondo; sin fondo para el frente del
 *   ícono adaptativo, que pone el fondo Android. `escala` achica el dibujo:
 *   el ícono adaptativo sólo garantiza el 66% del centro, y lo de afuera se lo
 *   puede comer el recorte del teléfono.
 */
export function svg({ conFondo, escala }) {
  const lado = 512;
  const centro = lado / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${lado}" height="${lado}" viewBox="0 0 ${lado} ${lado}">
  <defs>${filtros()}</defs>
  ${conFondo ? `<rect width="${lado}" height="${lado}" fill="${COLORES.fondo}"/>` : ''}
  ${
    conFondo
      ? `<g opacity="0.5"><path d="M 60 60 C 200 30, 330 40, 452 62 C 470 190, 476 330, 452 452 C 320 474, 190 470, 60 452 C 38 320, 40 190, 60 60 Z" fill="${COLORES.papel}" filter="url(#agua5)"/></g>`
      : ''
  }
  <g transform="translate(${centro} ${centro}) scale(${escala}) translate(${-centro} ${-centro})">
    ${arte()}
  </g>
  <g style="mix-blend-mode: multiply" opacity="0.13">${grano(lado)}</g>
</svg>`;
}
