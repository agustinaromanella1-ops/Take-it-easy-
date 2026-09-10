import { db, nuevoId } from './db';
import type { EstadoAsistencia, Id, RegistroAsistencia } from './tipos';

export interface MarcaAsistencia {
  claseSesionId: Id;
  alumnoId: Id;
  estado: EstadoAsistencia;
  justificada?: boolean;
}

/**
 * Upsert por el par [claseSesionId + alumnoId]: marcar dos veces al mismo
 * alumno en la misma clase actualiza el registro, nunca inserta un segundo.
 * La pantalla no tiene que defenderse del doble toque.
 */
export async function marcarAsistencia(marca: MarcaAsistencia): Promise<Id> {
  // Justificada sólo tiene sentido sobre una ausencia o una llegada tarde.
  // Sobre presente se ignora, en vez de rechazar: es un toque de más, no un error.
  const justificada = marca.estado === 'presente' ? false : (marca.justificada ?? false);

  return db.transaction('rw', db.registrosAsistencia, async () => {
    const existente = await db.registrosAsistencia
      .where('[claseSesionId+alumnoId]')
      .equals([marca.claseSesionId, marca.alumnoId])
      .first();

    if (existente) {
      await db.registrosAsistencia.update(existente.id, {
        estado: marca.estado,
        justificada,
        registradoEn: Date.now(),
      });
      return existente.id;
    }

    const registro: RegistroAsistencia = {
      id: nuevoId(),
      claseSesionId: marca.claseSesionId,
      alumnoId: marca.alumnoId,
      estado: marca.estado,
      justificada,
      registradoEn: Date.now(),
    };
    await db.registrosAsistencia.add(registro);
    return registro.id;
  });
}

export function asistenciaDeLaClase(claseSesionId: Id): Promise<RegistroAsistencia[]> {
  return db.registrosAsistencia.where('claseSesionId').equals(claseSesionId).toArray();
}
