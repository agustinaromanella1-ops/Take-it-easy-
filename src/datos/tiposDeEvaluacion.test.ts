import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';

import { db } from './db';
import {
  TIPOS_DE_FABRICA,
  olvidarTipo,
  recordarTipo,
  seLlamanIgual,
  tiposPropios,
  todosLosTipos,
} from './tiposDeEvaluacion';

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe('los tipos que agrega la docente', () => {
  it('uno escrito a mano queda para la próxima', async () => {
    // Sin esto "a gusto" dura una sola evaluación: al siguiente hay que volver
    // a escribir lo mismo.
    await recordarTipo('Coloquio');
    expect(await tiposPropios()).toEqual(['Coloquio']);
  });

  it('no se guarda dos veces', async () => {
    await recordarTipo('Coloquio');
    await recordarTipo('Coloquio');
    expect(await tiposPropios()).toEqual(['Coloquio']);
  });

  it('no se guarda uno que ya viene de fábrica', async () => {
    await recordarTipo('Parcial');
    expect(await tiposPropios()).toEqual([]);
  });

  it('tampoco si sólo cambia una mayúscula', async () => {
    await recordarTipo('parcial');
    await recordarTipo('COLOQUIO');
    await recordarTipo('coloquio');
    expect(await tiposPropios()).toEqual(['COLOQUIO']);
  });

  it('un acento distinto sí es otro tipo', async () => {
    // "Práctico" y "Practico" son palabras distintas en castellano, y quien
    // escribe una no quiso la otra.
    await recordarTipo('Coloquio');
    await recordarTipo('Colóquio');
    expect(await tiposPropios()).toHaveLength(2);
  });

  it('se le sacan los espacios de los costados', async () => {
    await recordarTipo('  Coloquio  ');
    expect(await tiposPropios()).toEqual(['Coloquio']);
  });

  it('uno vacío no se guarda', async () => {
    await recordarTipo('   ');
    expect(await tiposPropios()).toEqual([]);
  });

  it('se pueden sacar', async () => {
    await recordarTipo('Coloquio');
    await recordarTipo('Recuperatorio');
    expect(await olvidarTipo('coloquio')).toEqual(['Recuperatorio']);
  });

  it('sacar uno no toca los de fábrica', async () => {
    await olvidarTipo('Parcial');
    expect(todosLosTipos(await tiposPropios())).toContain('Parcial');
  });
});

describe('los que vienen de fábrica', () => {
  it('están los que pidió Agustina', () => {
    for (const t of [
      'Primer cuatrimestre',
      'Segundo cuatrimestre',
      'Calificación final',
      'Instancia diciembre',
      'Instancia febrero',
    ]) {
      expect(TIPOS_DE_FABRICA).toContain(t);
    }
  });

  it('primero lo que se toma durante el año y después lo que cierra', () => {
    // El orden no es decoración: son dos cosas distintas y se buscan en
    // momentos distintos del año.
    expect(TIPOS_DE_FABRICA.indexOf('Parcial')).toBeLessThan(
      TIPOS_DE_FABRICA.indexOf('Primer cuatrimestre'),
    );
    expect(TIPOS_DE_FABRICA.indexOf('Calificación final')).toBeLessThan(
      TIPOS_DE_FABRICA.indexOf('Instancia febrero'),
    );
  });

  it('los propios van atrás de los de fábrica', () => {
    const todos = todosLosTipos(['Coloquio']);
    expect(todos[todos.length - 1]).toBe('Coloquio');
  });

  it('no hay repetidos', () => {
    expect(new Set(TIPOS_DE_FABRICA).size).toBe(TIPOS_DE_FABRICA.length);
  });
});

describe('comparar nombres', () => {
  it('ignora mayúsculas', () => {
    expect(seLlamanIgual('Oral', 'oral')).toBe(true);
  });

  it('no ignora acentos', () => {
    expect(seLlamanIgual('Practico', 'Práctico')).toBe(false);
  });
});
