import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';

import { altaMasiva } from './alumnos';
import { marcarAsistencia } from './asistencia';
import { claseDelDia } from './clases';
import { db } from './db';
import { detalleDeAsistencia, estuvo, materiasDeAlumno, resumenDeAsistencia } from './ficha';
import { darDeBaja, inscribir } from './inscripciones';
import { crearMateria } from './materias';
import type { Id } from './tipos';

let materiaId: Id;
let otraId: Id;
let alumnoId: Id;

beforeEach(async () => {
  await db.delete();
  await db.open();
  materiaId = await crearMateria({
    nombre: 'Historia', anio: '4', division: 'A', escuela: 'Escuela N.º 12', colorPastel: 'celeste',
  });
  otraId = await crearMateria({
    nombre: 'Lengua', anio: '5', division: 'C', escuela: 'Escuela N.º 12', colorPastel: 'lila',
  });
  const { creados } = await altaMasiva([{ apellido: 'Acuña', nombre: 'Malena' }]);
  alumnoId = creados[0];
  await inscribir(materiaId, creados, '2026-03-01');
  await inscribir(otraId, creados, '2026-03-01');
});

async function marcar(fecha: string, estado: 'presente' | 'ausente' | 'tarde', justificada = false) {
  const clase = await claseDelDia(materiaId, fecha);
  await marcarAsistencia({ claseSesionId: clase.id, alumnoId, estado, justificada });
}

describe('en qué materias está', () => {
  it('trae las que cursa, ordenadas', async () => {
    expect((await materiasDeAlumno(alumnoId)).map((m) => m.nombre)).toEqual([
      'Historia · 4.º A',
      'Lengua · 5.º C',
    ]);
  });

  it('una baja deja de aparecer: ya no cursa ahí', async () => {
    await darDeBaja(otraId, alumnoId, '2026-09-01');

    expect((await materiasDeAlumno(alumnoId)).map((m) => m.nombre)).toEqual(['Historia · 4.º A']);
  });
});

describe('el resumen de asistencia', () => {
  it('cuenta sólo las clases donde se tomó lista', async () => {
    await marcar('2026-09-01', 'presente');
    await marcar('2026-09-02', 'ausente');

    expect(await resumenDeAsistencia(alumnoId, materiaId)).toEqual({
      registradas: 2, presentes: 1, tardes: 0, ausentes: 1, justificadas: 0,
    });
  });

  it('una clase sin lista tomada no es una falta de nadie', async () => {
    await claseDelDia(materiaId, '2026-09-03');

    expect((await resumenDeAsistencia(alumnoId, materiaId)).registradas).toBe(0);
  });

  it('no mezcla la asistencia de otra materia', async () => {
    await marcar('2026-09-01', 'presente');
    const enLengua = await claseDelDia(otraId, '2026-09-01');
    await marcarAsistencia({ claseSesionId: enLengua.id, alumnoId, estado: 'ausente' });

    expect((await resumenDeAsistencia(alumnoId, materiaId)).ausentes).toBe(0);
  });

  it('llegar tarde es haber estado', async () => {
    await marcar('2026-09-01', 'presente');
    await marcar('2026-09-02', 'tarde');
    await marcar('2026-09-03', 'ausente');

    expect(estuvo(await resumenDeAsistencia(alumnoId, materiaId))).toBe(2);
  });

  it('la justificada se cuenta sobre la ausencia y sobre la llegada tarde', async () => {
    await marcar('2026-09-01', 'ausente', true);
    await marcar('2026-09-02', 'tarde', true);

    expect((await resumenDeAsistencia(alumnoId, materiaId)).justificadas).toBe(2);
  });
});

describe('cómo se escribe el detalle', () => {
  const vacio = { registradas: 0, presentes: 0, tardes: 0, ausentes: 0, justificadas: 0 };

  it('sin nada que aclarar no dice nada', () => {
    expect(detalleDeAsistencia({ ...vacio, registradas: 5, presentes: 5 })).toBe('');
  });

  it('nombra la llegada tarde aparte, en vez de esconderla en el número', () => {
    expect(detalleDeAsistencia({ ...vacio, tardes: 1, ausentes: 2, justificadas: 1 })).toBe(
      '1 tarde · 2 ausentes · 1 justificada',
    );
  });

  it('pluraliza en español', () => {
    expect(detalleDeAsistencia({ ...vacio, tardes: 2, ausentes: 1 })).toBe('2 tardes · 1 ausente');
  });
});

describe('borrar una observación', () => {
  it('deshacer la devuelve con su fecha y su capa, no como una nueva', async () => {
    const { crearObservacion, borrarObservacion, restaurarObservacion, observacionesDeAlumno } =
      await import('./observaciones');

    const id = await crearObservacion({
      ambito: 'alumno', alumnoId, materiaId, fecha: '2026-08-06', texto: 'Faltó al parcial.',
    });
    const original = (await db.observaciones.get(id))!;

    await borrarObservacion(id);
    expect(await db.observaciones.count()).toBe(0);

    await restaurarObservacion(original);

    const vuelta = (await observacionesDeAlumno(alumnoId))[0];
    expect(vuelta).toEqual(original);
    expect(vuelta.fecha).toBe('2026-08-06');
  });
});
