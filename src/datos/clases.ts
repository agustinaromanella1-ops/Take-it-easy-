import { SIN_BLOQUE, db, nuevoId } from './db';
import type { ClaseSesion, Id } from './tipos';
import type { FechaLocal } from '../fecha';

/**
 * Busca la clase de esa materia en esa fecha, y la crea si no existe. Entrar
 * dos veces a tomar asistencia el mismo día no genera dos clases: si lo
 * hiciera, la asistencia quedaría partida entre las dos y el conteo mentiría.
 */
export async function claseDelDia(
  materiaId: Id,
  fecha: FechaLocal,
  bloqueHorarioId: Id = SIN_BLOQUE,
): Promise<ClaseSesion> {
  return db.transaction('rw', db.clasesSesion, async () => {
    const existente = await db.clasesSesion
      .where('[materiaId+fecha+bloqueHorarioId]')
      .equals([materiaId, fecha, bloqueHorarioId])
      .first();
    if (existente) return existente;

    const clase: ClaseSesion = { id: nuevoId(), materiaId, fecha, bloqueHorarioId };
    await db.clasesSesion.add(clase);
    return clase;
  });
}
