import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';

import { db, nuevoId } from './db';
import { altaMasiva } from './alumnos';
import { marcarAsistencia } from './asistencia';
import { calificar, promedioDeAlumno } from './calificaciones';
import { crearObservacion } from './observaciones';
import { PlantillaConNombreError, guardarPlantilla } from './plantillas';
import type { Escala } from './tipos';

const claseSesionId = 'clase-1';
const evaluacionId = 'evaluacion-1';
const materiaId = 'materia-1';
const alumnoId = 'alumno-1';

const numerica: Escala = { tipo: 'numerica', min: 1, max: 10, decimales: 2 };
const conceptual: Escala = {
  tipo: 'conceptual',
  etiquetas: [
    { id: 'e1', texto: 'En proceso' },
    { id: 'e2', texto: 'Logrado' },
  ],
};

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe('asistencia', () => {
  it('el segundo toque actualiza el registro en vez de duplicarlo', async () => {
    const primero = await marcarAsistencia({ claseSesionId, alumnoId, estado: 'ausente' });
    const segundo = await marcarAsistencia({ claseSesionId, alumnoId, estado: 'presente' });

    expect(segundo).toBe(primero);
    const registros = await db.registrosAsistencia.toArray();
    expect(registros).toHaveLength(1);
    expect(registros[0].estado).toBe('presente');
  });

  it('dos toques simultáneos dejan un solo registro', async () => {
    await Promise.all([
      marcarAsistencia({ claseSesionId, alumnoId, estado: 'presente' }),
      marcarAsistencia({ claseSesionId, alumnoId, estado: 'presente' }),
    ]);

    expect(await db.registrosAsistencia.count()).toBe(1);
  });

  it('justificada se guarda sobre una llegada tarde', async () => {
    await marcarAsistencia({ claseSesionId, alumnoId, estado: 'tarde', justificada: true });

    const registro = await db.registrosAsistencia.toCollection().first();
    expect(registro).toMatchObject({ estado: 'tarde', justificada: true });
  });

  it('justificada se ignora sobre presente', async () => {
    await marcarAsistencia({ claseSesionId, alumnoId, estado: 'presente', justificada: true });

    const registro = await db.registrosAsistencia.toCollection().first();
    expect(registro?.justificada).toBe(false);
  });

  it('el índice único rechaza un segundo registro del mismo par', async () => {
    // Sin pasar por el upsert: si esto no falla, es que el esquema perdió el
    // índice único y los tests de arriba seguirían pasando igual.
    const base = { claseSesionId, alumnoId, estado: 'presente' as const, justificada: false };
    await db.registrosAsistencia.add({ ...base, id: 'r1', registradoEn: Date.now() });

    await expect(
      db.registrosAsistencia.add({ ...base, id: 'r2', registradoEn: Date.now() }),
    ).rejects.toThrow();
  });

  it('alumnos distintos en la misma clase conviven', async () => {
    await marcarAsistencia({ claseSesionId, alumnoId, estado: 'presente' });
    await marcarAsistencia({ claseSesionId, alumnoId: 'alumno-2', estado: 'ausente' });

    expect(await db.registrosAsistencia.count()).toBe(2);
  });
});

describe('calificaciones', () => {
  it('el segundo toque actualiza la nota en vez de duplicarla', async () => {
    await calificar({ evaluacionId, alumnoId, valor: 6 });
    await calificar({ evaluacionId, alumnoId, valor: 8 });

    const notas = await db.calificaciones.toArray();
    expect(notas).toHaveLength(1);
    expect(notas[0].valor).toBe(8);
  });

  it('el promedio deja afuera las evaluaciones conceptuales', async () => {
    await db.evaluaciones.bulkAdd([
      { id: 'ev-num-1', materiaId, nombre: 'Parcial', fecha: '2026-08-01', tipo: 'parcial', escala: numerica },
      { id: 'ev-num-2', materiaId, nombre: 'Oral', fecha: '2026-08-20', tipo: 'oral', escala: numerica },
      { id: 'ev-con-1', materiaId, nombre: 'TP', fecha: '2026-09-01', tipo: 'tp', escala: conceptual },
    ]);
    await calificar({ evaluacionId: 'ev-num-1', alumnoId, valor: 7 });
    await calificar({ evaluacionId: 'ev-num-2', alumnoId, valor: 8 });
    await calificar({ evaluacionId: 'ev-con-1', alumnoId, valor: 'e2' });

    expect(await promedioDeAlumno(alumnoId, materiaId)).toEqual({
      valor: 7.5,
      numericas: 2,
      conceptuales: 1,
    });
  });

  it('sin notas numéricas no hay promedio, y no hay un cero inventado', async () => {
    await db.evaluaciones.add({
      id: 'ev-con-1', materiaId, nombre: 'TP', fecha: '2026-09-01', tipo: 'tp', escala: conceptual,
    });
    await calificar({ evaluacionId: 'ev-con-1', alumnoId, valor: 'e1' });

    const promedio = await promedioDeAlumno(alumnoId, materiaId);
    expect(promedio.valor).toBeNull();
    expect(promedio.conceptuales).toBe(1);
  });
});

describe('alta masiva de alumnos', () => {
  it('crea los alumnos de la lista', async () => {
    const { creados, repetidos } = await altaMasiva([
      { apellido: 'Acuña', nombre: 'Malena' },
      { apellido: 'Barreto', nombre: 'Ignacio' },
    ]);

    expect(creados).toHaveLength(2);
    expect(repetidos).toHaveLength(0);
    expect(await db.alumnos.count()).toBe(2);
  });

  it('pegar dos veces la misma lista no duplica a nadie', async () => {
    await altaMasiva([{ apellido: 'Acuña', nombre: 'Malena' }]);
    const segunda = await altaMasiva([{ apellido: 'Acuña', nombre: 'Malena' }]);

    expect(segunda.creados).toHaveLength(0);
    expect(segunda.repetidos).toHaveLength(1);
    expect(await db.alumnos.count()).toBe(1);
  });

  it('reconoce al mismo alumno escrito con otras mayúsculas o sin acento', async () => {
    await altaMasiva([{ apellido: 'Acuña', nombre: 'Malena' }]);
    const segunda = await altaMasiva([{ apellido: 'ACUNA', nombre: 'malena' }]);

    expect(segunda.repetidos).toHaveLength(1);
    expect(await db.alumnos.count()).toBe(1);
  });

  it('detecta repetidos dentro de la misma lista pegada', async () => {
    const { creados, repetidos } = await altaMasiva([
      { apellido: 'Acuña', nombre: 'Malena' },
      { apellido: 'Acuña', nombre: 'Malena' },
    ]);

    expect(creados).toHaveLength(1);
    expect(repetidos).toHaveLength(1);
  });

  it('dos alumnos con el mismo apellido y distinto nombre son dos personas', async () => {
    const { creados } = await altaMasiva([
      { apellido: 'Acuña', nombre: 'Malena' },
      { apellido: 'Acuña', nombre: 'Tomás' },
    ]);

    expect(creados).toHaveLength(2);
  });
});

describe('observaciones', () => {
  it('nacen en la capa privada', async () => {
    const id = await crearObservacion({
      ambito: 'alumno',
      alumnoId,
      fecha: '2026-09-09',
      texto: 'No entregó el trabajo. Pidió una semana más.',
    });

    expect((await db.observaciones.get(id))?.capa).toBe('privada');
  });
});

describe('plantillas grupales', () => {
  beforeEach(async () => {
    await db.alumnos.add({
      id: nuevoId(), nombre: 'Delfina', apellido: 'Cabrera', creadoEn: Date.now(),
    });
  });

  it('rechaza el nombre de un alumno y no escribe nada', async () => {
    await expect(
      guardarPlantilla({ texto: 'Delfina no entregó el trabajo.', ambito: 'grupal' }),
    ).rejects.toThrow(PlantillaConNombreError);

    expect(await db.plantillas.count()).toBe(0);
  });

  it('rechaza el apellido escrito sin acento', async () => {
    await expect(
      guardarPlantilla({ texto: 'Hablar con la familia CABRERA.', ambito: 'grupal' }),
    ).rejects.toThrow(PlantillaConNombreError);
  });

  it('no confunde una palabra que contiene un nombre adentro', async () => {
    const id = await guardarPlantilla({
      texto: 'Recordatorio: mañana se entrega el trabajo.',
      ambito: 'grupal',
    });

    expect(await db.plantillas.get(id)).toBeDefined();
  });

  it('la plantilla individual sí puede nombrar a un alumno', async () => {
    const id = await guardarPlantilla({
      texto: 'Delfina no entregó el trabajo.',
      ambito: 'individual',
    });

    expect(await db.plantillas.get(id)).toBeDefined();
  });
});
