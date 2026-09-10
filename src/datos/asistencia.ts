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

export interface ResultadoToque {
  /** Cómo estaba antes, para poder deshacer exactamente eso. */
  anterior: RegistroAsistencia | undefined;
  justificada: boolean;
}

/**
 * Un toque en la pantalla: elige el estado, y si repite el que ya estaba,
 * alterna la marca de justificada.
 *
 * Lee y escribe dentro de la misma transacción a propósito. Si la pantalla
 * decidiera el alternado con lo que tiene en la mano, dos toques rápidos
 * decidirían los dos sobre el mismo estado viejo y el segundo se perdería.
 */
export async function tocarEstado(
  claseSesionId: Id,
  alumnoId: Id,
  estado: EstadoAsistencia,
): Promise<ResultadoToque> {
  return db.transaction('rw', db.registrosAsistencia, async () => {
    const anterior = await db.registrosAsistencia
      .where('[claseSesionId+alumnoId]')
      .equals([claseSesionId, alumnoId])
      .first();

    const justificada =
      estado !== 'presente' && anterior?.estado === estado ? !anterior.justificada : false;

    await marcarAsistencia({ claseSesionId, alumnoId, estado, justificada });
    return { anterior, justificada };
  });
}

export function asistenciaDeLaClase(claseSesionId: Id): Promise<RegistroAsistencia[]> {
  return db.registrosAsistencia.where('claseSesionId').equals(claseSesionId).toArray();
}

/** Para deshacer la primera marca de un alumno, que antes no tenía registro. */
export async function borrarAsistencia(claseSesionId: Id, alumnoId: Id): Promise<void> {
  await db.registrosAsistencia
    .where('[claseSesionId+alumnoId]')
    .equals([claseSesionId, alumnoId])
    .delete();
}
