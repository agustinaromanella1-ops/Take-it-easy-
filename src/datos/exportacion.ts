import { db, VERSION_ESQUEMA } from './db';
import { guardarPreferencia, leerPreferencia } from './preferencias';

/**
 * La copia de seguridad. IndexedDB puede ser desalojada por el sistema y un
 * teléfono se pierde o se rompe; como no hay copia remota por diseño, este
 * archivo es la única red que queda.
 */

const MARCA = 'take-it-easy';
const ANTERIOR = 'copia-anterior';

/** Los borradores no entran: son texto a medio escribir, no datos. */
const TABLAS = [
  'escuelas', 'materias', 'bloquesHorario', 'alumnos', 'inscripciones',
  'clasesSesion', 'registrosAsistencia', 'evaluaciones', 'calificaciones',
  'observaciones', 'plantillas', 'entradasAgenda', 'recordatorios', 'preferencias',
] as const;

export interface Copia {
  app: typeof MARCA;
  /**
   * Versión del esquema. Sin esto, el primer cambio de modelo dejaría
   * inservibles todas las copias anteriores.
   */
  version: number;
  /** Instante, no día de calendario: epoch en milisegundos. */
  exportadoEn: number;
  datos: Record<string, unknown[]>;
}

export interface Resumen {
  materias: number;
  alumnos: number;
  clases: number;
  observaciones: number;
}

export function resumirCopia(copia: Copia): Resumen {
  return {
    materias: copia.datos.materias?.length ?? 0,
    alumnos: copia.datos.alumnos?.length ?? 0,
    clases: copia.datos.clasesSesion?.length ?? 0,
    observaciones: copia.datos.observaciones?.length ?? 0,
  };
}

export async function armarCopia(): Promise<Copia> {
  const datos: Record<string, unknown[]> = {};
  for (const tabla of TABLAS) {
    datos[tabla] = await db.table(tabla).toArray();
  }
  return { app: MARCA, version: VERSION_ESQUEMA, exportadoEn: Date.now(), datos };
}

export class CopiaInvalidaError extends Error {
  constructor(motivo: string) {
    super(motivo);
    this.name = 'CopiaInvalidaError';
  }
}

/**
 * Lee un archivo y verifica que sea una copia de esta app. Una versión que no
 * conoce se rechaza en vez de adivinar: importar a medias es peor que no
 * importar.
 */
export function leerCopia(texto: string): Copia {
  let crudo: unknown;
  try {
    crudo = JSON.parse(texto);
  } catch {
    throw new CopiaInvalidaError('El archivo no es una copia de Take It Easy.');
  }

  const copia = crudo as Partial<Copia>;
  if (copia?.app !== MARCA || typeof copia.datos !== 'object' || copia.datos === null) {
    throw new CopiaInvalidaError('El archivo no es una copia de Take It Easy.');
  }
  if (typeof copia.version !== 'number') {
    throw new CopiaInvalidaError('La copia no dice de qué versión es.');
  }
  if (copia.version > VERSION_ESQUEMA) {
    throw new CopiaInvalidaError(
      'La copia es de una versión más nueva de la app. Actualizá la app y volvé a intentar.',
    );
  }

  return copia as Copia;
}

/**
 * Restaurar reemplaza todo lo que hay. Antes de hacerlo guarda el estado
 * actual, así se puede deshacer: es la acción más destructiva de la app y no
 * puede ser la única sin vuelta atrás.
 */
export async function restaurar(copia: Copia): Promise<void> {
  const previa = await armarCopia();

  await db.transaction('rw', TABLAS as unknown as string[], async () => {
    for (const tabla of TABLAS) {
      await db.table(tabla).clear();
      const filas = copia.datos[tabla];
      if (Array.isArray(filas) && filas.length > 0) await db.table(tabla).bulkAdd(filas);
    }
  });

  await guardarPreferencia(ANTERIOR, previa);
}

export function copiaAnterior(): Promise<Copia | undefined> {
  return leerPreferencia<Copia>(ANTERIOR);
}

export async function deshacerRestauracion(): Promise<boolean> {
  const previa = await copiaAnterior();
  if (!previa) return false;

  await db.transaction('rw', TABLAS as unknown as string[], async () => {
    for (const tabla of TABLAS) {
      await db.table(tabla).clear();
      const filas = previa.datos[tabla];
      if (Array.isArray(filas) && filas.length > 0) await db.table(tabla).bulkAdd(filas);
    }
  });

  await db.preferencias.delete(ANTERIOR);
  return true;
}

/** "take-it-easy-2026-09-11.json" */
export function nombreDeArchivo(momento = new Date()): string {
  const mes = String(momento.getMonth() + 1).padStart(2, '0');
  const dia = String(momento.getDate()).padStart(2, '0');
  return `take-it-easy-${momento.getFullYear()}-${mes}-${dia}.json`;
}
