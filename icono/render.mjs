/**
 * Genera los íconos de Android y el favicon a partir del dibujo que hizo
 * Agustina, en `origen/icono-fuente.png`. Se corre a mano cuando cambia el
 * dibujo: `node icono/render.mjs`.
 *
 * El original queda versionado al lado: es la fuente, y sin él estos PNG no se
 * pueden volver a generar.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';

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
  throw new Error('Falta Playwright. Instalalo (npm i -D playwright) o pasá la ruta en PLAYWRIGHT=');
}

const RAIZ = new URL('..', import.meta.url).pathname;
const RES = `${RAIZ}android/app/src/main/res`;
const FUENTE = `${RAIZ}icono/origen/icono-fuente.png`;

/** El celeste del dibujo. Es también el fondo del ícono adaptativo. */
export const FONDO = '#B9DEFD';

// Los tamaños que espera Android. El frente del ícono adaptativo mide 108dp
// contra los 48dp del cuadrado, y por eso va más grande en cada densidad.
const DENSIDADES = [
  { nombre: 'mdpi', cuadrado: 48, frente: 108 },
  { nombre: 'hdpi', cuadrado: 72, frente: 162 },
  { nombre: 'xhdpi', cuadrado: 96, frente: 216 },
  { nombre: 'xxhdpi', cuadrado: 144, frente: 324 },
  { nombre: 'xxxhdpi', cuadrado: 192, frente: 432 },
];

/**
 * Cuánto del lado del frente ocupa el dibujo.
 *
 * De los 108dp del frente el teléfono muestra los 72 del centro —el resto es
 * margen para el recorte y para el movimiento al arrastrarlo— y sólo garantiza
 * los 66 centrales. El dibujo es un cuadrado, así que lo que tiene que entrar
 * en ese círculo es su diagonal, no su lado: a 0.55 las puntas quedan justo
 * adentro de la máscara redonda, que es la más filosa de las tres.
 */
const OCUPA_EL_FRENTE = 0.55;

const navegador = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox'],
});
const pagina = await navegador.newPage();
const fuente = `data:image/png;base64,${(await readFile(FUENTE)).toString('base64')}`;

/**
 * Dibuja el original en un lienzo cuadrado.
 *
 * `recortado` saca el fondo celeste y deja sólo el dibujo, centrado y a
 * escala, que es lo que necesita el frente del ícono adaptativo: el fondo lo
 * pone Android. El celeste es parejo y ningún color del dibujo se le parece,
 * así que alcanza con medir distancia al color de la esquina. El borde se
 * desvanece en vez de cortarse de golpe, si no queda un filo celeste alrededor.
 */
async function aPng(lado, recortado) {
  const dataUrl = await pagina.evaluate(
    async ({ fuente, lado, recortado, ocupa }) => {
      const img = new Image();
      await new Promise((ok, mal) => {
        img.onload = ok;
        img.onerror = mal;
        img.src = fuente;
      });

      const c = document.createElement('canvas');
      c.width = c.height = lado;
      const g = c.getContext('2d', { willReadFrequently: true });
      g.imageSmoothingQuality = 'high';

      if (!recortado) {
        g.drawImage(img, 0, 0, lado, lado);
        return c.toDataURL('image/png');
      }

      // Medir el dibujo sobre el original, a tamaño completo.
      const W = img.naturalWidth;
      const m = document.createElement('canvas');
      m.width = m.height = W;
      const mg = m.getContext('2d', { willReadFrequently: true });
      mg.drawImage(img, 0, 0);
      const d = mg.getImageData(0, 0, W, W).data;
      const fondo = [d[0], d[1], d[2]];
      const lejos = (i) =>
        Math.abs(d[i] - fondo[0]) + Math.abs(d[i + 1] - fondo[1]) + Math.abs(d[i + 2] - fondo[2]);

      let x0 = W, y0 = W, x1 = 0, y1 = 0;
      for (let y = 0; y < W; y++) {
        for (let x = 0; x < W; x++) {
          if (lejos((y * W + x) * 4) > 30) {
            if (x < x0) x0 = x;
            if (y < y0) y0 = y;
            if (x > x1) x1 = x;
            if (y > y1) y1 = y;
          }
        }
      }

      // Sacar el celeste, con el borde desvanecido.
      const dato = mg.getImageData(0, 0, W, W);
      const q = dato.data;
      for (let i = 0; i < q.length; i += 4) {
        const dist =
          Math.abs(q[i] - fondo[0]) + Math.abs(q[i + 1] - fondo[1]) + Math.abs(q[i + 2] - fondo[2]);
        if (dist < 24) q[i + 3] = 0;
        else if (dist < 70) q[i + 3] = Math.round((255 * (dist - 24)) / 46);
      }
      mg.putImageData(dato, 0, 0);

      const anchoDibujo = Math.max(x1 - x0 + 1, y1 - y0 + 1);
      const destino = lado * ocupa;
      const escala = destino / anchoDibujo;
      const cx = (x0 + x1) / 2;
      const cy = (y0 + y1) / 2;
      g.drawImage(
        m,
        cx - anchoDibujo / 2, cy - anchoDibujo / 2, anchoDibujo, anchoDibujo,
        (lado - destino) / 2, (lado - destino) / 2, destino, destino,
      );
      return c.toDataURL('image/png');
    },
    { fuente, lado, recortado, ocupa: OCUPA_EL_FRENTE },
  );
  return Buffer.from(dataUrl.split(',')[1], 'base64');
}

for (const d of DENSIDADES) {
  const carpeta = `${RES}/mipmap-${d.nombre}`;
  await mkdir(carpeta, { recursive: true });
  const cuadrado = await aPng(d.cuadrado, false);
  await writeFile(`${carpeta}/ic_launcher.png`, cuadrado);
  await writeFile(`${carpeta}/ic_launcher_round.png`, cuadrado);
  await writeFile(`${carpeta}/ic_launcher_foreground.png`, await aPng(d.frente, true));
  console.log(`${d.nombre}: ${d.cuadrado}px y frente ${d.frente}px`);
}

await writeFile(`${RAIZ}public/favicon.png`, await aPng(256, false));
console.log('favicon.png');

await navegador.close();
