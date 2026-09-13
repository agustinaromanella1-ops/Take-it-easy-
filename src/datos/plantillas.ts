import { db, nuevoId } from './db';
import { contieneNombreConocido, indiceDeNombres } from './nombres';
import type { Id, Plantilla } from './tipos';

export class PlantillaConNombreError extends Error {
  constructor() {
    super('Una plantilla grupal no puede nombrar a un alumno.');
    this.name = 'PlantillaConNombreError';
  }
}

/**
 * Una plantilla que nombra a un alumno no llega a un grupo. El bloqueo vive
 * acá, en la capa de datos: no es un cartel que se pueda ignorar, es una
 * escritura que no ocurre.
 */
export async function guardarPlantilla(entrada: {
  texto: string;
  ambito: 'individual' | 'grupal';
}): Promise<Id> {
  if (entrada.ambito === 'grupal') {
    await verificarSinNombres(entrada.texto);
  }

  const plantilla: Plantilla = {
    id: nuevoId(),
    texto: entrada.texto,
    ambito: entrada.ambito,
  };
  await db.plantillas.add(plantilla);
  return plantilla.id;
}

/** El mismo control, para el momento de aplicar una plantilla a varios alumnos. */
export async function verificarSinNombres(texto: string): Promise<void> {
  const indice = await indiceDeNombres();
  if (contieneNombreConocido(texto, indice)) {
    throw new PlantillaConNombreError();
  }
}
