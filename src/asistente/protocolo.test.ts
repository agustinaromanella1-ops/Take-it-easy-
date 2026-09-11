import { describe, expect, it } from 'vitest';

import { leerEventos } from './protocolo';

describe('leer lo que llega del proxy', () => {
  it('lee una línea entera', () => {
    const { eventos, pendiente } = leerEventos('', '{"tipo":"texto","texto":"Hola"}\n');

    expect(eventos).toEqual([{ tipo: 'texto', texto: 'Hola' }]);
    expect(pendiente).toBe('');
  });

  it('junta una línea que llegó partida en dos trozos', () => {
    const primero = leerEventos('', '{"tipo":"texto","tex');
    expect(primero.eventos).toEqual([]);

    const segundo = leerEventos(primero.pendiente, 'to":"Hola"}\n');
    expect(segundo.eventos).toEqual([{ tipo: 'texto', texto: 'Hola' }]);
  });

  it('lee varias líneas que vinieron en el mismo trozo', () => {
    const { eventos } = leerEventos(
      '',
      '{"tipo":"texto","texto":"a"}\n{"tipo":"texto","texto":"b"}\n{"tipo":"fin"}\n',
    );

    expect(eventos).toEqual([
      { tipo: 'texto', texto: 'a' },
      { tipo: 'texto', texto: 'b' },
      { tipo: 'fin' },
    ]);
  });

  it('una línea rota no se lleva puesto lo que llegó bien', () => {
    const { eventos } = leerEventos('', 'esto no es json\n{"tipo":"fin"}\n');

    expect(eventos).toEqual([{ tipo: 'fin' }]);
  });

  it('el error llega con su mensaje', () => {
    const { eventos } = leerEventos('', '{"tipo":"error","motivo":"limite","mensaje":"Muchas."}\n');

    expect(eventos[0]).toEqual({ tipo: 'error', motivo: 'limite', mensaje: 'Muchas.' });
  });

  it('un texto con acentos y salto de línea vuelve tal cual', () => {
    const original = 'Hablá con la familia.\nSegundo párrafo.';
    const { eventos } = leerEventos('', `${JSON.stringify({ tipo: 'texto', texto: original })}\n`);

    expect(eventos[0]).toEqual({ tipo: 'texto', texto: original });
  });
});
