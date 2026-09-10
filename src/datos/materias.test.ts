import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';

import { altaMasiva } from './alumnos';
import { claseDelDia } from './clases';
import { db } from './db';
import { alumnosInscriptos, darDeBaja, inscribir } from './inscripciones';
import { crearMateria } from './materias';

const hoy = '2026-09-10';

beforeEach(async () => {
  await db.delete();
  await db.open();
});

async function materiaDePrueba(escuela = 'Escuela N.º 12') {
  return crearMateria({
    nombre: 'Historia',
    anio: '4',
    division: 'A',
    escuela,
    colorPastel: 'celeste',
  });
}

describe('materias', () => {
  it('crea la escuela junto con la primera materia', async () => {
    await materiaDePrueba();

    expect(await db.escuelas.count()).toBe(1);
  });

  it('dos materias de la misma escuela no la duplican', async () => {
    await materiaDePrueba();
    await materiaDePrueba('escuela n.º 12');

    expect(await db.escuelas.count()).toBe(1);
    expect(await db.materias.count()).toBe(2);
  });

  it('la escala por defecto es numérica del 1 al 10', async () => {
    const id = await materiaDePrueba();

    expect((await db.materias.get(id))?.escalaPorDefecto).toMatchObject({
      tipo: 'numerica', min: 1, max: 10,
    });
  });
});

describe('inscripciones', () => {
  it('inscribe y devuelve los alumnos ordenados por apellido', async () => {
    const materiaId = await materiaDePrueba();
    const { creados } = await altaMasiva([
      { apellido: 'Gauna', nombre: 'Renata' },
      { apellido: 'Acuña', nombre: 'Malena' },
    ]);
    await inscribir(materiaId, creados, hoy);

    const alumnos = await alumnosInscriptos(materiaId);
    expect(alumnos.map((a) => a.apellido)).toEqual(['Acuña', 'Gauna']);
  });

  it('inscribir dos veces no crea una segunda inscripción', async () => {
    const materiaId = await materiaDePrueba();
    const { creados } = await altaMasiva([{ apellido: 'Acuña', nombre: 'Malena' }]);

    await inscribir(materiaId, creados, hoy);
    await inscribir(materiaId, creados, hoy);

    expect(await db.inscripciones.count()).toBe(1);
  });

  it('el mismo alumno se inscribe en dos materias sin duplicarse', async () => {
    const historia = await materiaDePrueba();
    const lengua = await crearMateria({
      nombre: 'Lengua', anio: '4', division: 'A',
      escuela: 'Escuela N.º 12', colorPastel: 'lila',
    });
    const { creados } = await altaMasiva([{ apellido: 'Acuña', nombre: 'Malena' }]);

    await inscribir(historia, creados, hoy);
    await inscribir(lengua, creados, hoy);

    expect(await db.alumnos.count()).toBe(1);
    expect(await db.inscripciones.count()).toBe(2);
  });

  it('la baja saca al alumno de la lista pero no borra la inscripción', async () => {
    const materiaId = await materiaDePrueba();
    const { creados } = await altaMasiva([{ apellido: 'Acuña', nombre: 'Malena' }]);
    await inscribir(materiaId, creados, hoy);

    await darDeBaja(materiaId, creados[0], hoy);

    expect(await alumnosInscriptos(materiaId)).toHaveLength(0);
    expect(await db.inscripciones.count()).toBe(1);
  });

  it('volver a inscribir a alguien dado de baja lo reactiva', async () => {
    const materiaId = await materiaDePrueba();
    const { creados } = await altaMasiva([{ apellido: 'Acuña', nombre: 'Malena' }]);
    await inscribir(materiaId, creados, hoy);
    await darDeBaja(materiaId, creados[0], hoy);

    await inscribir(materiaId, creados, hoy);

    expect(await alumnosInscriptos(materiaId)).toHaveLength(1);
    expect(await db.inscripciones.count()).toBe(1);
  });
});

describe('clase del día', () => {
  it('entrar dos veces el mismo día devuelve la misma clase', async () => {
    const materiaId = await materiaDePrueba();

    const primera = await claseDelDia(materiaId, hoy);
    const segunda = await claseDelDia(materiaId, hoy);

    expect(segunda.id).toBe(primera.id);
    expect(await db.clasesSesion.count()).toBe(1);
  });

  it('el centinela de bloque mantiene viva la unicidad', async () => {
    // Si las clases sin horario guardaran el bloque vacío, el índice compuesto
    // no las indexaría y esta segunda escritura pasaría sin chistar.
    const materiaId = await materiaDePrueba();
    const clase = await claseDelDia(materiaId, hoy);

    await expect(
      db.clasesSesion.add({ ...clase, id: 'otra' }),
    ).rejects.toThrow();
  });

  it('la misma materia en dos fechas son dos clases', async () => {
    const materiaId = await materiaDePrueba();

    await claseDelDia(materiaId, hoy);
    await claseDelDia(materiaId, '2026-09-11');

    expect(await db.clasesSesion.count()).toBe(2);
  });
});
