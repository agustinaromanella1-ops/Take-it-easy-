import { describe, expect, it } from 'vitest';

import { crearLimitador } from './limite.js';

const limite = { porVentana: 3, ventanaMs: 60_000 };
const t0 = 1_000_000;

describe('el límite por instalación', () => {
  it('deja pasar hasta el tope', () => {
    const l = crearLimitador(limite);

    expect([1, 2, 3].map(() => l.consultar('una', t0).permitido)).toEqual([true, true, true]);
  });

  it('corta al pasarse', () => {
    const l = crearLimitador(limite);
    for (let i = 0; i < 3; i += 1) l.consultar('una', t0);

    expect(l.consultar('una', t0).permitido).toBe(false);
  });

  it('cuenta cada instalación por separado', () => {
    const l = crearLimitador(limite);
    for (let i = 0; i < 3; i += 1) l.consultar('una', t0);

    expect(l.consultar('otra', t0).permitido).toBe(true);
  });

  it('la ventana corre: pasado el rato vuelve a dejar pasar', () => {
    const l = crearLimitador(limite);
    for (let i = 0; i < 3; i += 1) l.consultar('una', t0);

    expect(l.consultar('una', t0 + 60_001).permitido).toBe(true);
  });

  it('un intento rechazado no consume lugar ni corre la ventana', () => {
    const l = crearLimitador(limite);
    for (let i = 0; i < 3; i += 1) l.consultar('una', t0);

    l.consultar('una', t0 + 10);
    l.consultar('una', t0 + 20);

    // El lugar se libera por el primero, no por los rechazados.
    expect(l.consultar('una', t0 + 60_001).permitido).toBe(true);
  });

  it('dice cuánto falta para poder volver a preguntar', () => {
    const l = crearLimitador(limite);
    for (let i = 0; i < 3; i += 1) l.consultar('una', t0);

    expect(l.consultar('una', t0 + 20_000).esperarMs).toBe(40_000);
  });

  it('limpiar saca las instalaciones sin uso reciente, que si no crecen sin fin', () => {
    const l = crearLimitador(limite);
    l.consultar('vieja', t0);
    l.consultar('nueva', t0 + 59_000);

    l.limpiar(t0 + 60_001);

    expect(l.tamaño).toBe(1);
  });
});
