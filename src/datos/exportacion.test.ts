import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';

import { altaMasiva } from './alumnos';
import { marcarAsistencia } from './asistencia';
import { claseDelDia } from './clases';
import { db } from './db';
import {
  CopiaInvalidaError,
  armarCopia,
  copiaAnterior,
  deshacerRestauracion,
  leerCopia,
  nombreDeArchivo,
  restaurar,
  resumirCopia,
} from './exportacion';
import { inscribir } from './inscripciones';
import { crearMateria } from './materias';
import { crearObservacion } from './observaciones';

const hoy = '2026-09-11';

beforeEach(async () => {
  await db.delete();
  await db.open();
});

async function cargarDatos() {
  const materiaId = await crearMateria({
    nombre: 'Historia', anio: '4', division: 'A',
    escuela: 'Escuela N.º 12', colorPastel: 'celeste',
  });
  const { creados } = await altaMasiva([
    { apellido: 'Acuña', nombre: 'Malena' },
    { apellido: 'Barreto', nombre: 'Ignacio' },
  ]);
  await inscribir(materiaId, creados, hoy);
  const clase = await claseDelDia(materiaId, hoy);
  await marcarAsistencia({ claseSesionId: clase.id, alumnoId: creados[0], estado: 'presente' });
  await crearObservacion({
    ambito: 'alumno', alumnoId: creados[0], fecha: hoy,
    texto: 'No entregó el trabajo. Pidió una semana más.',
  });
  return { materiaId, creados };
}

describe('armar la copia', () => {
  it('se lleva todo lo que hace falta para volver a empezar', async () => {
    await cargarDatos();

    const copia = await armarCopia();

    expect(resumirCopia(copia)).toEqual({
      materias: 1, alumnos: 2, clases: 1, observaciones: 1,
    });
    expect(copia.datos.inscripciones).toHaveLength(2);
    expect(copia.datos.registrosAsistencia).toHaveLength(1);
  });

  it('lleva la versión del esquema, para que una copia vieja siga sirviendo', async () => {
    const copia = await armarCopia();

    expect(typeof copia.version).toBe('number');
    expect(copia.app).toBe('take-it-easy');
  });

  it('no se lleva los borradores', async () => {
    await db.borradores.put({ clave: 'x', contenido: { texto: 'a medio escribir' }, guardadoEn: 1 });

    expect((await armarCopia()).datos.borradores).toBeUndefined();
  });

  it('el instante es epoch, no una fecha de calendario en UTC', async () => {
    const copia = await armarCopia();

    expect(typeof copia.exportadoEn).toBe('number');
  });
});

describe('leer un archivo', () => {
  it('acepta una copia de esta app', async () => {
    const copia = await armarCopia();

    expect(leerCopia(JSON.stringify(copia)).app).toBe('take-it-easy');
  });

  it('rechaza algo que no es JSON', () => {
    expect(() => leerCopia('esto no es un archivo')).toThrow(CopiaInvalidaError);
  });

  it('rechaza un JSON que no es de esta app', () => {
    expect(() => leerCopia('{"hola":1}')).toThrow(/no es una copia/);
  });

  it('rechaza una copia de una versión más nueva en vez de adivinar', async () => {
    const copia = { ...(await armarCopia()), version: 99 };

    expect(() => leerCopia(JSON.stringify(copia))).toThrow(/más nueva/);
  });

  it('acepta una copia de una versión anterior', async () => {
    const copia = { ...(await armarCopia()), version: 1 };

    expect(leerCopia(JSON.stringify(copia)).version).toBe(1);
  });
});

describe('restaurar', () => {
  it('deja la base como estaba cuando se hizo la copia', async () => {
    await cargarDatos();
    const copia = leerCopia(JSON.stringify(await armarCopia()));

    await db.delete();
    await db.open();
    expect(await db.alumnos.count()).toBe(0);

    await restaurar(copia);

    expect(await db.alumnos.count()).toBe(2);
    expect(await db.materias.count()).toBe(1);
    expect(await db.registrosAsistencia.count()).toBe(1);
    expect((await db.observaciones.toCollection().first())?.capa).toBe('privada');
  });

  it('reemplaza lo que había, no lo suma', async () => {
    const copia = leerCopia(JSON.stringify(await armarCopia())); // copia vacía
    await cargarDatos();

    await restaurar(copia);

    expect(await db.alumnos.count()).toBe(0);
    expect(await db.materias.count()).toBe(0);
  });

  it('se puede deshacer, porque es lo más destructivo que hace la app', async () => {
    await cargarDatos();
    const vacia = leerCopia(JSON.stringify({
      app: 'take-it-easy', version: 1, exportadoEn: 0, datos: {},
    }));

    await restaurar(vacia);
    expect(await db.alumnos.count()).toBe(0);

    expect(await deshacerRestauracion()).toBe(true);
    expect(await db.alumnos.count()).toBe(2);
    expect(await db.materias.count()).toBe(1);
    expect(await db.registrosAsistencia.count()).toBe(1);
  });

  it('sin nada que deshacer avisa en vez de romper', async () => {
    expect(await deshacerRestauracion()).toBe(false);
  });

  it('deshacer una sola vez: después ya no queda copia anterior', async () => {
    await cargarDatos();
    await restaurar(leerCopia(JSON.stringify({
      app: 'take-it-easy', version: 1, exportadoEn: 0, datos: {},
    })));

    await deshacerRestauracion();

    expect(await copiaAnterior()).toBeUndefined();
  });

  it('ida y vuelta completa: exportar, borrar todo, importar', async () => {
    const { materiaId } = await cargarDatos();
    const texto = JSON.stringify(await armarCopia());

    await db.delete();
    await db.open();
    await restaurar(leerCopia(texto));

    const materia = await db.materias.get(materiaId);
    expect(materia?.nombre).toBe('Historia');
    const alumnos = await db.alumnos.orderBy('apellido').toArray();
    expect(alumnos.map((a) => a.apellido)).toEqual(['Acuña', 'Barreto']);
  });
});

describe('nombre del archivo', () => {
  it('lleva la fecha local, no la de UTC', () => {
    // 23:40 del 11 en Argentina, cuando en UTC ya es el 12.
    expect(nombreDeArchivo(new Date('2026-09-12T02:40:00Z'))).toBe('take-it-easy-2026-09-11.json');
  });
});
