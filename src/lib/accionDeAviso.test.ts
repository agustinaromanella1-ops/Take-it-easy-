import { describe, expect, it } from 'vitest';
import { leerPedido } from './accionDeAviso';

describe('la respuesta que llega desde una notificación', () => {
  it('lee la acción y la sesión', () => {
    expect(leerPedido('?hacer=vino&sesion=abc123')).toEqual({ accion: 'vino', sesion: 'abc123' });
  });

  it('acepta las cuatro respuestas y ninguna más', () => {
    for (const a of ['vino', 'falto', 'cancelo', 'reagendo']) {
      expect(leerPedido(`?hacer=${a}`).accion).toBe(a);
    }
    expect(leerPedido('?hacer=borrar').accion).toBeNull();
    expect(leerPedido('?hacer=session%2Fremove').accion).toBeNull();
  });

  it('sin parámetros no pide nada', () => {
    expect(leerPedido('')).toEqual({ accion: null, sesion: null });
    expect(leerPedido('?otra=cosa')).toEqual({ accion: null, sesion: null });
  });

  it('descarta un id absurdamente largo en vez de arrastrarlo', () => {
    expect(leerPedido(`?hacer=vino&sesion=${'x'.repeat(200)}`).sesion).toBeNull();
  });

  it('la acción sin sesión sigue siendo nula de sesión, no inventa una', () => {
    expect(leerPedido('?hacer=vino')).toEqual({ accion: 'vino', sesion: null });
  });
});
