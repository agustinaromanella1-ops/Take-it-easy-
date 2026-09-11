import { db } from '../datos/db';
import type { Contexto } from './anonimizacion';

/**
 * El índice de nombres conocidos se arma desde IndexedDB en el momento de
 * filtrar, y con **todos** los alumnos, no sólo los de la materia en curso:
 * una consulta puede mencionar a cualquiera.
 *
 * El nombre de la docente no está acá porque la app no lo guarda en ningún
 * lado. Si algún día lo guarda, entra al contexto y se sustituye por
 * `la docente` sin tocar nada más.
 */
export async function contextoDelAsistente(): Promise<Contexto> {
  const [alumnos, escuelas, materias] = await Promise.all([
    db.alumnos.toArray(),
    db.escuelas.toArray(),
    db.materias.toArray(),
  ]);

  return {
    alumnos: alumnos.map(({ id, nombre, apellido }) => ({ id, nombre, apellido })),
    escuelas: escuelas.map((e) => e.nombre),
    materias: materias.map((m) => m.nombre),
  };
}
