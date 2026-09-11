import { beforeEach, describe, expect, it, vi } from 'vitest';

import { registrarAtras, volvioUnaPantalla } from './botonAtras';

// Cada test arranca sin manejadores: el registro vive en el módulo.
const registrados: (() => void)[] = [];
beforeEach(() => {
  while (registrados.length > 0) registrados.pop()!();
});
function registrar(manejador: () => boolean) {
  registrados.push(registrarAtras(manejador));
}

describe('el botón atrás de una pantalla con pasos propios', () => {
  it('sin nadie registrado, deja pasar a la pila de navegación', () => {
    expect(volvioUnaPantalla()).toBe(false);
  });

  it('una pantalla que se hace cargo evita que se cierre la app', () => {
    registrar(() => true);

    expect(volvioUnaPantalla()).toBe(true);
  });

  it('una pantalla que no se hace cargo lo deja pasar', () => {
    registrar(() => false);

    expect(volvioUnaPantalla()).toBe(false);
  });

  it('decide la de más adentro, que es la última registrada', () => {
    const afuera = vi.fn(() => true);
    registrar(afuera);
    registrar(() => true);

    expect(volvioUnaPantalla()).toBe(true);
    expect(afuera).not.toHaveBeenCalled();
  });

  it('al desmontarse la pantalla, su manejador deja de contestar', () => {
    const quitar = registrarAtras(() => true);

    quitar();

    expect(volvioUnaPantalla()).toBe(false);
  });
});
