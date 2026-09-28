import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';

import { contarLoGuardado, enRenglones } from './inventario';
import { db } from './db';

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe('lo guardado', () => {
  it('en un teléfono recién instalado es todo cero', async () => {
    expect(await contarLoGuardado()).toEqual({
      materias: 0,
      alumnos: 0,
      clases: 0,
      evaluaciones: 0,
      notas: 0,
      observaciones: 0,
    });
  });

  it('cuenta lo que hay en cada tabla', async () => {
    await db.materias.bulkAdd([
      { id: 'm1', nombre: 'Historia', anio: '4', division: 'A', archivada: false },
      { id: 'm2', nombre: 'Geografía', anio: '5', division: 'B', archivada: false },
    ] as never);
    await db.alumnos.add({ id: 'a1', apellido: 'Acosta', nombre: 'Ana' } as never);

    const guardado = await contarLoGuardado();

    expect(guardado.materias).toBe(2);
    expect(guardado.alumnos).toBe(1);
    expect(guardado.notas).toBe(0);
  });
});

describe('los renglones', () => {
  const cero = {
    materias: 0,
    alumnos: 0,
    clases: 0,
    evaluaciones: 0,
    notas: 0,
    observaciones: 0,
  };

  it('uno va en singular y dos en plural', () => {
    const uno = enRenglones({ ...cero, materias: 1, alumnos: 2 });

    expect(uno[0]).toEqual({ cuantos: 1, texto: 'materia' });
    expect(uno[1]).toEqual({ cuantos: 2, texto: 'alumnos' });
  });

  // Cero es plural en castellano: «0 materias», no «0 materia».
  it('cero va en plural', () => {
    expect(enRenglones(cero)[0]).toEqual({ cuantos: 0, texto: 'materias' });
  });
});
