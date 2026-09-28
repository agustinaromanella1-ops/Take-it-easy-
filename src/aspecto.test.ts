import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  aspectoRecordado,
  guardarAnimaciones,
  guardarTema,
  leerAnimaciones,
  leerTema,
  pintar,
  seMueve,
} from './aspecto';
import { db } from './datos/db';
import { guardarPreferencia } from './datos/preferencias';

/**
 * Las pruebas corren en node, sin DOM. En vez de traer jsdom para dos
 * atributos y cuatro claves, se prueba contra lo mínimo que usa el módulo: un
 * localStorage de mentira y un elemento que sólo sabe poner y sacar atributos.
 */
function unLocalStorage() {
  const guardado = new Map<string, string>();
  return {
    getItem: (c: string) => guardado.get(c) ?? null,
    setItem: (c: string, v: string) => void guardado.set(c, v),
    removeItem: (c: string) => void guardado.delete(c),
    clear: () => guardado.clear(),
  };
}

function unElemento() {
  const atributos = new Map<string, string>();
  return {
    setAttribute: (n: string, v: string) => void atributos.set(n, v),
    removeAttribute: (n: string) => void atributos.delete(n),
    tiene: (n: string) => atributos.has(n),
    dice: (n: string) => atributos.get(n),
  };
}

beforeEach(async () => {
  await db.delete();
  await db.open();
  vi.stubGlobal('localStorage', unLocalStorage());
});

describe('lo elegido', () => {
  it('sin elegir nada, las dos cosas van por el sistema', async () => {
    expect(await leerTema()).toBe('sistema');
    expect(await leerAnimaciones()).toBe('sistema');
  });

  it('devuelve lo guardado', async () => {
    await guardarTema('oscuro');
    await guardarAnimaciones('nunca');

    expect(await leerTema()).toBe('oscuro');
    expect(await leerAnimaciones()).toBe('nunca');
  });

  // Una preferencia guardada por una versión anterior, o un valor a mano en
  // la base, no tiene que dejar la app con un atributo que el CSS no conoce.
  it('un valor que no existe cae en el automático', async () => {
    await guardarPreferencia('aspecto:tema', 'fucsia');

    expect(await leerTema()).toBe('sistema');
  });
});

describe('la cache de localStorage', () => {
  it('guardar deja lo elegido a mano, para pintar antes de que conteste la base', async () => {
    await guardarTema('claro');
    await guardarAnimaciones('siempre');

    expect(aspectoRecordado()).toEqual({ tema: 'claro', animaciones: 'siempre' });
  });

  it('si la cache está vacía o dice cualquier cosa, arranca en automático', () => {
    localStorage.setItem('aspecto:tema', 'fucsia');

    expect(aspectoRecordado()).toEqual({ tema: 'sistema', animaciones: 'sistema' });
  });
});

describe('pintar el html', () => {
  it('el automático no deja atributo: mandan las consultas de medios', () => {
    const raiz = unElemento();
    pintar('oscuro', 'nunca', raiz);

    pintar('sistema', 'sistema', raiz);

    expect(raiz.tiene('data-tema')).toBe(false);
    expect(raiz.tiene('data-animaciones')).toBe(false);
  });

  it('elegir a mano escribe el atributo que busca el CSS', () => {
    const raiz = unElemento();

    pintar('oscuro', 'nunca', raiz);

    expect(raiz.dice('data-tema')).toBe('oscuro');
    expect(raiz.dice('data-animaciones')).toBe('nunca');
  });
});

describe('si se mueve', () => {
  it('«siempre» se mueve aunque el sistema pida quieto', () => {
    expect(seMueve('siempre', true)).toBe(true);
  });

  it('«nunca» no se mueve aunque el sistema no pida nada', () => {
    expect(seMueve('nunca', false)).toBe(false);
  });

  it('«según el sistema» hace lo que pide el sistema', () => {
    expect(seMueve('sistema', true)).toBe(false);
    expect(seMueve('sistema', false)).toBe(true);
  });
});
