import { describe, expect, it } from 'vitest';

import { aLinea, type Entrada } from './registro.js';

const base: Entrada = {
  momento: 1789163277423,
  estado: 200,
  latenciaMs: 1840,
  instalacion: 'instalacion-de-prueba',
};

describe('el registro', () => {
  it('escribe la metadata operativa', () => {
    expect(JSON.parse(aLinea({ ...base, tokensEntrada: 120, tokensSalida: 340 }))).toEqual({
      momento: 1789163277423,
      estado: 200,
      latenciaMs: 1840,
      instalacion: 'instalacion-de-prueba',
      tokensEntrada: 120,
      tokensSalida: 340,
    });
  });

  it('no escribe nada que no esté en la lista, aunque se lo pasen', () => {
    // Un refactor que agregue el texto a la entrada no puede terminar
    // escribiéndolo: la lista de claves es la que manda.
    const conTexto = { ...base, texto: 'Malena viene faltando', respuesta: 'algo' } as Entrada;

    const linea = aLinea(conTexto);

    expect(linea).not.toContain('Malena');
    expect(linea).not.toContain('texto');
    expect(linea).not.toContain('respuesta');
  });

  it('omite lo que no vino, en vez de escribir nulos', () => {
    expect(aLinea(base)).not.toContain('tokens');
  });

  it('el momento es un instante, no una fecha armada en UTC', () => {
    expect(typeof JSON.parse(aLinea(base)).momento).toBe('number');
  });
});
