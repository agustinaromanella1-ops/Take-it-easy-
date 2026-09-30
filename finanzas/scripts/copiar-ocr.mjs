/**
 * Copia el lector de texto (Tesseract) y el idioma español a `public/ocr/`.
 *
 * Tesseract.js, si no se le dice otra cosa, baja su motor y el idioma desde un
 * CDN la primera vez que se usa. Eso mandaría una petición a un tercero cada
 * vez que alguien lee un comprobante, y la app promete que nada sale del
 * dispositivo. Servirlos desde la propia app cumple la promesa y además hace
 * que la lectura funcione sin conexión.
 *
 * Se copian solo las variantes LSTM del motor (las que usa el modo 1) y el
 * idioma en su versión `best_int`, que pesa 2 MB en vez de 8.
 */
import { cpSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const destino = join(raiz, 'public', 'ocr');
mkdirSync(destino, { recursive: true });

const archivos = [
  ['node_modules/tesseract.js/dist/worker.min.js', 'worker.min.js'],
  ['node_modules/tesseract.js-core/tesseract-core-lstm.wasm.js', 'tesseract-core-lstm.wasm.js'],
  ['node_modules/tesseract.js-core/tesseract-core-simd-lstm.wasm.js', 'tesseract-core-simd-lstm.wasm.js'],
  ['node_modules/tesseract.js-core/tesseract-core-relaxedsimd-lstm.wasm.js', 'tesseract-core-relaxedsimd-lstm.wasm.js'],
  ['node_modules/@tesseract.js-data/spa/4.0.0_best_int/spa.traineddata.gz', 'spa.traineddata.gz'],
];

for (const [desde, hacia] of archivos) {
  const origen = join(raiz, desde);
  if (!existsSync(origen)) {
    console.error(`Falta ${desde}. ¿Corriste npm install?`);
    process.exit(1);
  }
  cpSync(origen, join(destino, hacia));
}
console.log(`Lector de texto copiado a public/ocr (${archivos.length} archivos).`);
