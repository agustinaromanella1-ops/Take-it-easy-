import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';

import { borrarBorrador, guardarBorrador, leerBorrador } from './borradores';
import { db } from './db';

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe('borradores', () => {
  it('devuelve lo guardado', async () => {
    await guardarBorrador('materia-nueva', { nombre: 'Historia', anio: '4' });

    expect(await leerBorrador('materia-nueva')).toEqual({ nombre: 'Historia', anio: '4' });
  });

  it('guardar de nuevo pisa el anterior en vez de acumular', async () => {
    await guardarBorrador('materia-nueva', { nombre: 'Hist' });
    await guardarBorrador('materia-nueva', { nombre: 'Historia' });

    expect(await db.borradores.count()).toBe(1);
    expect(await leerBorrador('materia-nueva')).toEqual({ nombre: 'Historia' });
  });

  it('una clave sin borrador no devuelve nada', async () => {
    expect(await leerBorrador('no-existe')).toBeUndefined();
  });

  it('cada materia tiene su propio borrador de lista', async () => {
    await guardarBorrador('alumnos:materia-1', { texto: 'ACUÑA, Malena' });
    await guardarBorrador('alumnos:materia-2', { texto: 'GAUNA, Renata' });

    expect(await leerBorrador('alumnos:materia-1')).toEqual({ texto: 'ACUÑA, Malena' });
    expect(await leerBorrador('alumnos:materia-2')).toEqual({ texto: 'GAUNA, Renata' });
  });

  it('borrar lo deja sin rastro', async () => {
    await guardarBorrador('materia-nueva', { nombre: 'Historia' });
    await borrarBorrador('materia-nueva');

    expect(await leerBorrador('materia-nueva')).toBeUndefined();
    expect(await db.borradores.count()).toBe(0);
  });

  it('borrar algo que no existe no explota', async () => {
    await expect(borrarBorrador('no-existe')).resolves.toBeUndefined();
  });
});
