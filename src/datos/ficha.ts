import { db } from './db';
import { comoSeLlama } from './materias';
import type { ColorPastel, Id, Materia } from './tipos';

/**
 * Lo que se ve en la ficha de un alumno, además de sus observaciones.
 */

export interface MateriaDelAlumno {
  id: Id;
  nombre: string;
  colorPastel: ColorPastel;
}

/** En qué está inscripto hoy. Las bajas no aparecen: ya no cursa ahí. */
export async function materiasDeAlumno(alumnoId: Id): Promise<MateriaDelAlumno[]> {
  const inscripciones = await db.inscripciones.where('alumnoId').equals(alumnoId).toArray();
  const activas = inscripciones.filter((i) => i.estado === 'activa');

  const materias = (await db.materias.bulkGet(activas.map((i) => i.materiaId))).filter(
    (m): m is Materia => m !== undefined,
  );

  return materias
    .map((m) => ({ id: m.id, nombre: comoSeLlama(m), colorPastel: m.colorPastel }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}

export interface ResumenDeAsistencia {
  /** Clases en las que se le registró algo. Las que no se tomaron no cuentan. */
  registradas: number;
  presentes: number;
  tardes: number;
  ausentes: number;
  /** Entre las ausencias y las llegadas tarde, cuántas están justificadas. */
  justificadas: number;
}

/**
 * El denominador son las clases donde se tomó lista y se lo registró, no las
 * clases del año: una clase sin lista tomada no es una falta de nadie.
 *
 * Una llegada tarde cuenta como haber estado —el alumno estuvo, llegó tarde—,
 * y por eso el detalle la nombra aparte en vez de esconderla en el número.
 */
export async function resumenDeAsistencia(
  alumnoId: Id,
  materiaId: Id,
): Promise<ResumenDeAsistencia> {
  const clases = await db.clasesSesion.where('materiaId').equals(materiaId).toArray();
  const deLaMateria = new Set(clases.map((c) => c.id));

  const registros = (await db.registrosAsistencia.where('alumnoId').equals(alumnoId).toArray())
    .filter((r) => deLaMateria.has(r.claseSesionId));

  return {
    registradas: registros.length,
    presentes: registros.filter((r) => r.estado === 'presente').length,
    tardes: registros.filter((r) => r.estado === 'tarde').length,
    ausentes: registros.filter((r) => r.estado === 'ausente').length,
    justificadas: registros.filter((r) => r.justificada).length,
  };
}

/** Cuántas veces estuvo: presente o tarde, que también es estar. */
export function estuvo(resumen: ResumenDeAsistencia): number {
  return resumen.presentes + resumen.tardes;
}

/** "1 tarde · 2 ausentes, 1 justificada". Vacío si no hay nada que aclarar. */
export function detalleDeAsistencia(resumen: ResumenDeAsistencia): string {
  const partes: string[] = [];
  if (resumen.tardes > 0) {
    partes.push(`${resumen.tardes} ${resumen.tardes === 1 ? 'tarde' : 'tardes'}`);
  }
  if (resumen.ausentes > 0) {
    partes.push(`${resumen.ausentes} ${resumen.ausentes === 1 ? 'ausente' : 'ausentes'}`);
  }
  if (resumen.justificadas > 0) {
    partes.push(
      `${resumen.justificadas} ${resumen.justificadas === 1 ? 'justificada' : 'justificadas'}`,
    );
  }
  return partes.join(' · ');
}
