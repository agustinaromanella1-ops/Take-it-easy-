/**
 * Leer el texto de una imagen, en el dispositivo.
 *
 * Usa Tesseract, servido desde la propia app (`public/ocr/`, lo copia
 * `scripts/copiar-ocr.mjs`). No se pide nada a ningún tercero: la política de
 * contenido de la app (`connect-src 'self'`) ni siquiera lo permitiría.
 *
 * Se carga la primera vez que hace falta —pesa unos megas— y queda listo para
 * las siguientes.
 */
import type { Worker } from 'tesseract.js';

export type Etapa = 'cargando' | 'leyendo';

let trabajador: Promise<Worker> | null = null;
let alProgreso: ((etapa: Etapa, avance: number) => void) | null = null;

async function obtener(): Promise<Worker> {
  if (!trabajador) {
    trabajador = (async () => {
      const { createWorker } = await import('tesseract.js');
      return createWorker('spa', 1, {
        workerPath: '/ocr/worker.min.js',
        corePath: '/ocr/',
        langPath: '/ocr',
        gzip: true,
        // Con blob, el worker se armaría desde un texto en memoria; desde la
        // ruta propia alcanza y respeta la política de contenido.
        workerBlobURL: false,
        logger: (m: { status: string; progress: number }) => {
          alProgreso?.(m.status === 'recognizing text' ? 'leyendo' : 'cargando', m.progress);
        },
      });
    })();
    trabajador.catch(() => {
      trabajador = null;
    });
  }
  return trabajador;
}

export class LecturaCancelada extends Error {}

/** Cuánto se espera antes de darse por vencido. Un teléfono viejo puede tardar. */
const LIMITE_MS = 120_000;

export async function leerTexto(imagen: Blob, progreso: (etapa: Etapa, avance: number) => void, senal: AbortSignal): Promise<string> {
  alProgreso = progreso;
  const w = await obtener();
  if (senal.aborted) throw new LecturaCancelada();

  return new Promise<string>((ok, mal) => {
    const cortar = (error: Error) => {
      // Tesseract no sabe cancelar una lectura a la mitad: se descarta el
      // trabajador entero y la próxima vez se arma otro.
      void w.terminate();
      trabajador = null;
      mal(error);
    };
    const limite = setTimeout(() => cortar(new Error('La lectura tardó demasiado.')), LIMITE_MS);
    senal.addEventListener('abort', () => {
      clearTimeout(limite);
      cortar(new LecturaCancelada());
    });
    w.recognize(imagen)
      .then((r) => {
        clearTimeout(limite);
        ok(r.data.text);
      })
      .catch((e: unknown) => {
        clearTimeout(limite);
        trabajador = null;
        mal(e instanceof Error ? e : new Error('No se pudo leer la imagen.'));
      });
  });
}
