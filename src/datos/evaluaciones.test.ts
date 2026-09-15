import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';

import { altaMasiva } from './alumnos';
import { calificar, NotaInvalidaError } from './calificaciones';
import { db } from './db';
import { CONCEPTUAL_COMUN, NUMERICA_1_10, cabeEnLaEscala, comoSeEscribe, leerNumero } from './escalas';
import {
  borrarEvaluacion,
  crearEvaluacion,
  distribucion,
  evaluacionesDeMateria,
  planillaDeEvaluacion,
  promedioDeEvaluacion,
} from './evaluaciones';
import { inscribir } from './inscripciones';
import { crearMateria } from './materias';
import type { Id } from './tipos';

const hoy = '2026-09-12';
let materiaId: Id;
let alumnos: Id[];

beforeEach(async () => {
  await db.delete();
  await db.open();
  materiaId = await crearMateria({
    nombre: 'Historia', anio: '4', division: 'A', escuela: 'Escuela N.º 12', colorPastel: 'celeste',
  });
  const { creados } = await altaMasiva([
    { apellido: 'Acuña', nombre: 'Malena' },
    { apellido: 'Barreto', nombre: 'Ignacio' },
  ]);
  alumnos = creados;
  await inscribir(materiaId, creados, hoy);
});

const nueva = (extra = {}) => ({
  materiaId, nombre: 'Parcial 1', fecha: hoy, tipo: 'parcial', ...extra,
});

describe('crear una evaluación', () => {
  it('hereda la escala de la materia', async () => {
    const id = await crearEvaluacion(nueva());

    expect((await db.evaluaciones.get(id))?.escala).toEqual(NUMERICA_1_10);
  });

  it('puede tener otra escala que la materia: un TP conceptual en una materia numérica', async () => {
    const id = await crearEvaluacion(nueva({ escala: CONCEPTUAL_COMUN }));

    expect((await db.evaluaciones.get(id))?.escala.tipo).toBe('conceptual');
  });

  it('la escala se copia, así cambiar la de la materia no reinterpreta notas viejas', async () => {
    const id = await crearEvaluacion(nueva());

    await db.materias.update(materiaId, { escalaPorDefecto: CONCEPTUAL_COMUN });

    expect((await db.evaluaciones.get(id))?.escala).toEqual(NUMERICA_1_10);
  });

  it('dos del mismo día se ordenan por nombre, y no al azar', async () => {
    await crearEvaluacion(nueva({ nombre: 'Oral' }));
    await crearEvaluacion(nueva({ nombre: 'Escrito' }));
    await crearEvaluacion(nueva({ nombre: 'Álbum' }));

    const nombres = (await evaluacionesDeMateria(materiaId)).map((e) => e.nombre);

    expect(nombres).toEqual(['Álbum', 'Escrito', 'Oral']);
  });

  it('las lista de la más nueva a la más vieja', async () => {
    await crearEvaluacion(nueva({ nombre: 'Vieja', fecha: '2026-03-01' }));
    await crearEvaluacion(nueva({ nombre: 'Nueva', fecha: '2026-09-01' }));
    await crearEvaluacion(nueva({ nombre: 'Del medio', fecha: '2026-06-01' }));

    const nombres = (await evaluacionesDeMateria(materiaId)).map((e) => e.nombre);

    expect(nombres).toEqual(['Nueva', 'Del medio', 'Vieja']);
  });
});

describe('la planilla', () => {
  it('trae a todos los inscriptos, con nota o sin ella', async () => {
    const id = await crearEvaluacion(nueva());
    await calificar({ evaluacionId: id, alumnoId: alumnos[0], valor: 8 });

    const planilla = await planillaDeEvaluacion(id);

    expect(planilla?.notas).toHaveLength(2);
    expect(planilla?.cargadas).toBe(1);
  });

  it('sin nota es nulo, no cero: el que falta corregir no puede parecer aplazado', async () => {
    const id = await crearEvaluacion(nueva());

    const planilla = await planillaDeEvaluacion(id);

    expect(planilla?.notas.every((n) => n.valor === null)).toBe(true);
  });

  it('un alumno dado de baja deja de aparecer', async () => {
    const id = await crearEvaluacion(nueva());
    await db.inscripciones.where('alumnoId').equals(alumnos[1]).modify({ estado: 'baja' });

    expect((await planillaDeEvaluacion(id))?.notas).toHaveLength(1);
  });

  it('de una evaluación que no existe no hay planilla', async () => {
    expect(await planillaDeEvaluacion('no-existe')).toBeUndefined();
  });
});

describe('lo que la nota tiene que cumplir', () => {
  it('rechaza una nota fuera de la escala en vez de guardarla', async () => {
    const id = await crearEvaluacion(nueva());

    await expect(calificar({ evaluacionId: id, alumnoId: alumnos[0], valor: 47 })).rejects.toThrow(
      NotaInvalidaError,
    );
    expect(await db.calificaciones.count()).toBe(0);
  });

  it('rechaza una etiqueta que no es de esa escala', async () => {
    const id = await crearEvaluacion(nueva({ escala: CONCEPTUAL_COMUN }));

    await expect(
      calificar({ evaluacionId: id, alumnoId: alumnos[0], valor: 'inventada' }),
    ).rejects.toThrow(NotaInvalidaError);
  });

  it('rechaza un número donde la escala espera una etiqueta', async () => {
    const id = await crearEvaluacion(nueva({ escala: CONCEPTUAL_COMUN }));

    await expect(calificar({ evaluacionId: id, alumnoId: alumnos[0], valor: 7 })).rejects.toThrow(
      NotaInvalidaError,
    );
  });

  it('acepta los extremos de la escala', async () => {
    const id = await crearEvaluacion(nueva());

    await calificar({ evaluacionId: id, alumnoId: alumnos[0], valor: 1 });
    await calificar({ evaluacionId: id, alumnoId: alumnos[1], valor: 10 });

    expect(await db.calificaciones.count()).toBe(2);
  });
});

describe('promedio y distribución', () => {
  it('el promedio de una evaluación numérica sale de las notas cargadas', async () => {
    const id = await crearEvaluacion(nueva());
    await calificar({ evaluacionId: id, alumnoId: alumnos[0], valor: 7 });
    await calificar({ evaluacionId: id, alumnoId: alumnos[1], valor: 8 });
    const planilla = await planillaDeEvaluacion(id);

    expect(promedioDeEvaluacion(planilla!.evaluacion, planilla!.notas)).toBe(7.5);
  });

  it('el que no tiene nota no cuenta como cero', async () => {
    const id = await crearEvaluacion(nueva());
    await calificar({ evaluacionId: id, alumnoId: alumnos[0], valor: 8 });
    const planilla = await planillaDeEvaluacion(id);

    expect(promedioDeEvaluacion(planilla!.evaluacion, planilla!.notas)).toBe(8);
  });

  it('una evaluación conceptual no tiene promedio: tiene distribución', async () => {
    const id = await crearEvaluacion(nueva({ escala: CONCEPTUAL_COMUN }));
    await calificar({ evaluacionId: id, alumnoId: alumnos[0], valor: 'mb' });
    await calificar({ evaluacionId: id, alumnoId: alumnos[1], valor: 'mb' });
    const planilla = await planillaDeEvaluacion(id);

    expect(promedioDeEvaluacion(planilla!.evaluacion, planilla!.notas)).toBeNull();
    expect(distribucion(planilla!.evaluacion, planilla!.notas)).toEqual([
      { id: 'ns', texto: 'No satisfactorio', cuantas: 0 },
      { id: 's', texto: 'Satisfactorio', cuantas: 0 },
      { id: 'b', texto: 'Bueno', cuantas: 0 },
      { id: 'mb', texto: 'Muy bueno', cuantas: 2 },
    ]);
  });
});

describe('borrar una evaluación', () => {
  it('se lleva sus notas, que solas no significan nada', async () => {
    const id = await crearEvaluacion(nueva());
    await calificar({ evaluacionId: id, alumnoId: alumnos[0], valor: 8 });

    await borrarEvaluacion(id);

    expect(await db.evaluaciones.count()).toBe(0);
    expect(await db.calificaciones.count()).toBe(0);
  });

  it('no toca las notas de otra evaluación', async () => {
    const unaId = await crearEvaluacion(nueva({ nombre: 'Una' }));
    const otraId = await crearEvaluacion(nueva({ nombre: 'Otra' }));
    await calificar({ evaluacionId: unaId, alumnoId: alumnos[0], valor: 8 });
    await calificar({ evaluacionId: otraId, alumnoId: alumnos[0], valor: 9 });

    await borrarEvaluacion(unaId);

    expect(await db.calificaciones.count()).toBe(1);
  });
});

describe('cómo se lee y se escribe una nota', () => {
  it('acepta la coma decimal, que es la del teclado en español', () => {
    expect(leerNumero('7,5')).toBe(7.5);
    expect(leerNumero('7.5')).toBe(7.5);
  });

  it('un texto que no es un número no es cero', () => {
    expect(leerNumero('ocho')).toBeNull();
    expect(leerNumero('')).toBeNull();
  });

  it('un entero se escribe sin decimales de adorno', () => {
    expect(comoSeEscribe(NUMERICA_1_10, 7)).toBe('7');
    expect(comoSeEscribe(NUMERICA_1_10, 7.5)).toBe('7.5');
  });

  it('una conceptual se escribe con el texto de la etiqueta, no con su id', () => {
    expect(comoSeEscribe(CONCEPTUAL_COMUN, 'mb')).toBe('Muy bueno');
  });

  it('cabe en la escala es por id, no por texto', () => {
    expect(cabeEnLaEscala(CONCEPTUAL_COMUN, 'mb')).toBe(true);
    expect(cabeEnLaEscala(CONCEPTUAL_COMUN, 'Muy bueno')).toBe(false);
  });
});
