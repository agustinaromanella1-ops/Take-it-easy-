import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';

import { altaMasiva } from '../datos/alumnos';
import { db } from '../datos/db';
import { crearMateria } from '../datos/materias';
import { crearSesionDeAnonimizacion } from './anonimizacion';
import { contextoDelAsistente } from './contexto';

beforeEach(async () => {
  await db.delete();
  await db.open();
});

async function cargar() {
  await crearMateria({
    nombre: 'Historia', anio: '4', division: 'A',
    escuela: 'Escuela N.º 12', colorPastel: 'celeste',
  });
  await altaMasiva([
    { apellido: 'Acuña', nombre: 'Malena' },
    { apellido: 'Barreto', nombre: 'Ignacio' },
  ]);
}

describe('el contexto del asistente', () => {
  it('lleva todos los alumnos, no los de una materia: el texto puede nombrar a cualquiera', async () => {
    await cargar();

    const contexto = await contextoDelAsistente();

    expect(contexto.alumnos.map((a) => a.apellido).sort()).toEqual(['Acuña', 'Barreto']);
  });

  it('lleva la escuela y la materia, que evitan marcar sospechas de más', async () => {
    await cargar();

    const contexto = await contextoDelAsistente();

    expect(contexto.escuelas).toEqual(['Escuela N.º 12']);
    expect(contexto.materias).toEqual(['Historia']);
  });

  it('sin nada cargado no rompe: devuelve un contexto vacío', async () => {
    const contexto = await contextoDelAsistente();

    expect(contexto.alumnos).toEqual([]);
    expect(contexto.escuelas).toEqual([]);
  });

  it('armado desde la base, el filtro sustituye lo que tiene que sustituir', async () => {
    await cargar();
    const sesion = crearSesionDeAnonimizacion(await contextoDelAsistente());

    const { texto } = sesion.anonimizar(
      'Malena viene faltando en Historia, en la Escuela N.º 12.',
    );

    expect(texto).toBe('Estudiante A viene faltando en Historia, en la escuela.');
  });
});
