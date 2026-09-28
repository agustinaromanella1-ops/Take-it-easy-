import { db } from './db';

/**
 * Cuánto hay guardado en el teléfono, contado tabla por tabla.
 *
 * No es lo mismo que el resumen de una copia: eso describe un archivo, esto
 * describe lo que hay ahora. Sirve para dos cosas muy concretas: ver de un
 * vistazo si la restauración trajo todo, y saber qué se pierde si el teléfono
 * se rompe sin copia.
 */
export interface Inventario {
  materias: number;
  alumnos: number;
  clases: number;
  evaluaciones: number;
  notas: number;
  observaciones: number;
}

export async function contarLoGuardado(): Promise<Inventario> {
  const [materias, alumnos, clases, evaluaciones, notas, observaciones] = await Promise.all([
    db.materias.count(),
    db.alumnos.count(),
    db.clasesSesion.count(),
    db.evaluaciones.count(),
    db.calificaciones.count(),
    db.observaciones.count(),
  ]);
  return { materias, alumnos, clases, evaluaciones, notas, observaciones };
}

const NOMBRES: { clave: keyof Inventario; una: string; varias: string }[] = [
  { clave: 'materias', una: 'materia', varias: 'materias' },
  { clave: 'alumnos', una: 'alumno', varias: 'alumnos' },
  { clave: 'clases', una: 'clase registrada', varias: 'clases registradas' },
  { clave: 'evaluaciones', una: 'evaluación', varias: 'evaluaciones' },
  { clave: 'notas', una: 'nota', varias: 'notas' },
  { clave: 'observaciones', una: 'observación', varias: 'observaciones' },
];

/** Los renglones a mostrar, con el nombre ya en singular o plural. */
export function enRenglones(inventario: Inventario): { cuantos: number; texto: string }[] {
  return NOMBRES.map(({ clave, una, varias }) => ({
    cuantos: inventario[clave],
    texto: inventario[clave] === 1 ? una : varias,
  }));
}
