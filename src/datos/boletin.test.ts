import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';

import { agregarAlumnosAMateria } from './altaEnMateria';
import { boletinDeAlumno, borrarNotaFinal, NotaFinalInvalidaError, ponerNotaFinal } from './boletin';
import { calificar } from './calificaciones';
import { db } from './db';
import { CONCEPTUAL_COMUN, NUMERICA_1_10 } from './escalas';

/** Las etiquetas de la escala conceptual, ya angostadas a su variante. */
const ETIQUETAS =
  CONCEPTUAL_COMUN.tipo === 'conceptual' ? CONCEPTUAL_COMUN.etiquetas : [];
import { crearEvaluacion } from './evaluaciones';
import { crearObservacion } from './observaciones';
import type { Id } from './tipos';

const materiaId = 'materia-1';
const otraMateria = 'materia-2';
let ana: Id;

beforeEach(async () => {
  await db.delete();
  await db.open();
  await db.materias.bulkAdd([
    { id: materiaId, escuelaId: 'e1', nombre: 'Historia', anio: 4, division: 'A', colorPastel: 'lila', archivada: false },
    { id: otraMateria, escuelaId: 'e1', nombre: 'Lengua', anio: 4, division: 'A', colorPastel: 'rosa', archivada: false },
  ] as never);
  await agregarAlumnosAMateria(materiaId, [{ apellido: 'Acosta', nombre: 'Ana' }], '2026-03-01');
  await agregarAlumnosAMateria(otraMateria, [{ apellido: 'Acosta', nombre: 'Ana' }], '2026-03-01');
  ana = (await db.alumnos.toCollection().first())!.id;
});

async function evaluacion(nombre: string, fecha: string, conceptual = false) {
  return crearEvaluacion({
    materiaId,
    nombre,
    fecha,
    tipo: 'Parcial',
    escala: conceptual ? CONCEPTUAL_COMUN : NUMERICA_1_10,
  });
}

describe('el boletín de un alumno', () => {
  it('va del principio del año al final, al revés que el resto de la app', async () => {
    // Acá no se busca la última para cargarle notas: se lee cómo fue el año.
    await evaluacion('Tercero', '2026-09-01');
    await evaluacion('Primero', '2026-04-01');
    await evaluacion('Segundo', '2026-06-01');

    const b = await boletinDeAlumno(ana, materiaId);
    expect(b.lineas.map((l) => l.evaluacion.nombre)).toEqual(['Primero', 'Segundo', 'Tercero']);
  });

  it('muestra las evaluaciones sin nota, no las esconde', async () => {
    // Una evaluación que el alumno no rindió es justamente lo que hay que ver
    // al cerrar la materia.
    await evaluacion('Parcial 1', '2026-04-01');
    const b = await boletinDeAlumno(ana, materiaId);
    expect(b.lineas).toHaveLength(1);
    expect(b.lineas[0].comoSeLee).toBeNull();
  });

  it('escribe la nota numérica y la conceptual cada una como se lee', async () => {
    const num = await evaluacion('Parcial 1', '2026-04-01');
    const con = await evaluacion('Carpeta', '2026-05-01', true);
    await calificar({ evaluacionId: num, alumnoId: ana, valor: 8.5 });
    await calificar({ evaluacionId: con, alumnoId: ana, valor: ETIQUETAS[1].id });

    const b = await boletinDeAlumno(ana, materiaId);
    expect(b.lineas.map((l) => l.comoSeLee)).toEqual(['8.5', ETIQUETAS[1].texto]);
  });

  it('el promedio sale sólo de las numéricas, y cuenta las conceptuales aparte', async () => {
    const a = await evaluacion('Parcial 1', '2026-04-01');
    const c = await evaluacion('Parcial 2', '2026-05-01');
    const con = await evaluacion('Carpeta', '2026-06-01', true);
    await calificar({ evaluacionId: a, alumnoId: ana, valor: 6 });
    await calificar({ evaluacionId: c, alumnoId: ana, valor: 8 });
    await calificar({ evaluacionId: con, alumnoId: ana, valor: ETIQUETAS[0].id });

    const b = await boletinDeAlumno(ana, materiaId);
    expect(b.promedio).toMatchObject({ valor: 7, numericas: 2, conceptuales: 1 });
  });

  it('trae las observaciones de esta materia y no las de otra', async () => {
    await crearObservacion({ ambito: 'alumno', alumnoId: ana, materiaId, fecha: '2026-04-10', texto: 'De Historia.' });
    await crearObservacion({ ambito: 'alumno', alumnoId: ana, materiaId: otraMateria, fecha: '2026-04-11', texto: 'De Lengua.' });

    const b = await boletinDeAlumno(ana, materiaId);
    expect(b.observaciones.map((o) => o.texto)).toEqual(['De Historia.']);
  });

  it('no mezcla evaluaciones de otra materia', async () => {
    await evaluacion('Parcial 1', '2026-04-01');
    await crearEvaluacion({ materiaId: otraMateria, nombre: 'Ajeno', fecha: '2026-04-02', tipo: 'Parcial', escala: NUMERICA_1_10 });

    const b = await boletinDeAlumno(ana, materiaId);
    expect(b.lineas.map((l) => l.evaluacion.nombre)).toEqual(['Parcial 1']);
  });
});

describe('la nota final', () => {
  it('se guarda y se lee', async () => {
    await ponerNotaFinal(ana, materiaId, 8);
    expect((await boletinDeAlumno(ana, materiaId)).notaFinal).toBe(8);
  });

  it('la pone la docente: no sale del promedio', async () => {
    // La app no la calcula ni la sugiere. Cada escuela pondera distinto, y una
    // sugerencia se termina aceptando sin pensarla.
    const a = await evaluacion('Parcial 1', '2026-04-01');
    await calificar({ evaluacionId: a, alumnoId: ana, valor: 4 });
    expect((await boletinDeAlumno(ana, materiaId)).notaFinal).toBeNull();
  });

  it('no entra una que se sale de la escala', async () => {
    await expect(ponerNotaFinal(ana, materiaId, 11)).rejects.toThrow(NotaFinalInvalidaError);
    await expect(ponerNotaFinal(ana, materiaId, 0)).rejects.toThrow(NotaFinalInvalidaError);
  });

  it('no se le pone nota final a quien no está inscripto', async () => {
    await expect(ponerNotaFinal('fantasma', materiaId, 8)).rejects.toThrow(NotaFinalInvalidaError);
  });

  it('es de esta materia y no del alumno', async () => {
    await ponerNotaFinal(ana, materiaId, 8);
    expect((await boletinDeAlumno(ana, otraMateria)).notaFinal).toBeNull();
  });

  it('sacarla es distinto de ponerle uno', async () => {
    await ponerNotaFinal(ana, materiaId, 8);
    await borrarNotaFinal(ana, materiaId);
    expect((await boletinDeAlumno(ana, materiaId)).notaFinal).toBeNull();
  });

  it('se puede cambiar', async () => {
    await ponerNotaFinal(ana, materiaId, 6);
    await ponerNotaFinal(ana, materiaId, 9);
    expect((await boletinDeAlumno(ana, materiaId)).notaFinal).toBe(9);
    expect(await db.inscripciones.where('materiaId').equals(materiaId).count()).toBe(1);
  });
});
