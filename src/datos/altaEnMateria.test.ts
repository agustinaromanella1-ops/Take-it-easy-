import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';

import { agregarAlumnosAMateria, deshacerAltaEnMateria } from './altaEnMateria';
import { db } from './db';
import { alumnosInscriptos, darDeBaja, inscribir } from './inscripciones';
import { crearMateria } from './materias';

const hoy = '2026-09-10';

beforeEach(async () => {
  await db.delete();
  await db.open();
});

function materiaDePrueba(nombre = 'Historia') {
  return crearMateria({
    nombre, anio: '4', division: 'A',
    escuela: 'Escuela N.º 12', colorPastel: 'celeste',
  });
}

describe('deshacer el alta en una materia', () => {
  it('borra los alumnos creados y también sus inscripciones', async () => {
    const materiaId = await materiaDePrueba();
    const alta = await agregarAlumnosAMateria(
      materiaId,
      [{ apellido: 'Acuña', nombre: 'Malena' }, { apellido: 'Gauna', nombre: 'Renata' }],
      hoy,
    );

    await deshacerAltaEnMateria(materiaId, alta);

    expect(await db.alumnos.count()).toBe(0);
    expect(await db.inscripciones.count()).toBe(0);
  });

  it('al que ya existía de otra materia lo desinscribe sin borrarlo', async () => {
    const lengua = await materiaDePrueba('Lengua');
    const historia = await materiaDePrueba('Historia');
    await agregarAlumnosAMateria(lengua, [{ apellido: 'Acuña', nombre: 'Malena' }], hoy);

    const alta = await agregarAlumnosAMateria(
      historia, [{ apellido: 'Acuña', nombre: 'Malena' }], hoy,
    );
    expect(alta.repetidos).toHaveLength(1);

    await deshacerAltaEnMateria(historia, alta);

    expect(await db.alumnos.count()).toBe(1);
    expect(await alumnosInscriptos(historia)).toHaveLength(0);
    expect(await alumnosInscriptos(lengua)).toHaveLength(1);
  });

  it('no desinscribe a quien ya estaba en la materia de antes', async () => {
    // Pegar la misma lista dos veces y deshacer la segunda no puede dejar
    // al curso vacío: esa inscripción no la creó esta acción.
    const materiaId = await materiaDePrueba();
    await agregarAlumnosAMateria(materiaId, [{ apellido: 'Acuña', nombre: 'Malena' }], hoy);

    const segunda = await agregarAlumnosAMateria(
      materiaId, [{ apellido: 'Acuña', nombre: 'Malena' }], hoy,
    );
    await deshacerAltaEnMateria(materiaId, segunda);

    expect(await alumnosInscriptos(materiaId)).toHaveLength(1);
    expect(await db.alumnos.count()).toBe(1);
  });

  it('deshacer una reactivación devuelve la baja', async () => {
    const materiaId = await materiaDePrueba();
    const alta = await agregarAlumnosAMateria(
      materiaId, [{ apellido: 'Acuña', nombre: 'Malena' }], hoy,
    );
    await darDeBaja(materiaId, alta.creados[0], hoy);

    const segunda = await agregarAlumnosAMateria(
      materiaId, [{ apellido: 'Acuña', nombre: 'Malena' }], hoy,
    );
    expect(segunda.inscripcion.reactivadas).toHaveLength(1);

    await deshacerAltaEnMateria(materiaId, segunda);

    expect(await alumnosInscriptos(materiaId)).toHaveLength(0);
    expect(await db.alumnos.count()).toBe(1);
  });
});

describe('inscribir informa qué cambió', () => {
  it('distingue nuevas de las que ya estaban', async () => {
    const materiaId = await materiaDePrueba();
    const primera = await inscribir(materiaId, ['a1', 'a2'], hoy);
    expect(primera.nuevas).toHaveLength(2);

    const segunda = await inscribir(materiaId, ['a1', 'a2', 'a3'], hoy);
    expect(segunda.nuevas).toEqual(['a3']);
    expect(segunda.reactivadas).toHaveLength(0);
  });
});
