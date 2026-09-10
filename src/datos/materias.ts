import { db, nuevoId } from './db';
import type { ColorPastel, Escala, Id, Materia } from './tipos';

export const ESCALA_NUMERICA_1_10: Escala = {
  tipo: 'numerica',
  min: 1,
  max: 10,
  decimales: 2,
};

export interface MateriaNueva {
  nombre: string;
  anio: string;
  division: string;
  escuela: string;
  colorPastel: ColorPastel;
  escalaPorDefecto?: Escala;
}

export async function crearMateria(nueva: MateriaNueva): Promise<Id> {
  return db.transaction('rw', db.escuelas, db.materias, async () => {
    const nombreEscuela = nueva.escuela.trim();
    const existente = await db.escuelas
      .filter((e) => e.nombre.toLowerCase() === nombreEscuela.toLowerCase())
      .first();

    let escuelaId = existente?.id;
    if (!escuelaId) {
      escuelaId = nuevoId();
      await db.escuelas.add({ id: escuelaId, nombre: nombreEscuela });
    }

    const materia: Materia = {
      id: nuevoId(),
      escuelaId,
      nombre: nueva.nombre.trim(),
      anio: nueva.anio.trim(),
      division: nueva.division.trim(),
      colorPastel: nueva.colorPastel,
      escalaPorDefecto: nueva.escalaPorDefecto ?? ESCALA_NUMERICA_1_10,
    };
    await db.materias.add(materia);
    return materia.id;
  });
}

export function todasLasMaterias(): Promise<Materia[]> {
  return db.materias.toArray();
}

export function materia(id: Id): Promise<Materia | undefined> {
  return db.materias.get(id);
}

export async function nombreDeEscuela(escuelaId: Id): Promise<string> {
  return (await db.escuelas.get(escuelaId))?.nombre ?? '';
}

/** "Historia · 4.º B", como se lee en la pantalla. */
export function comoSeLlama(m: Materia): string {
  return `${m.nombre} · ${m.anio}.º ${m.division}`;
}
