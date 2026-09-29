import {
  describirVersion,
  hayActualizacion,
  MARGEN_MINUTOS,
} from '../domain/actualizacion';

const publicacion = (iso: string) => ({ publicadoEn: iso, url: 'https://x' });
const COMPILADA = '2026-09-29T12:00:00.000Z';

describe('hayActualizacion', () => {
  it('avisa cuando lo publicado es más nuevo', () => {
    expect(
      hayActualizacion(COMPILADA, publicacion('2026-09-30T12:00:00.000Z')),
    ).toBe(true);
  });

  it('no avisa cuando lo publicado es lo mismo que tenemos', () => {
    expect(hayActualizacion(COMPILADA, publicacion(COMPILADA))).toBe(false);
  });

  it('tolera el margen: la compilación termina después de grabarse la fecha', () => {
    // Unos minutos más tarde sigue siendo la misma versión; sin margen, la
    // app recién instalada se anunciaría a sí misma como desactualizada.
    const pocoDespues = new Date(
      new Date(COMPILADA).getTime() + (MARGEN_MINUTOS - 1) * 60_000,
    ).toISOString();
    expect(hayActualizacion(COMPILADA, publicacion(pocoDespues))).toBe(false);
  });

  it('avisa pasado el margen', () => {
    const bastanteDespues = new Date(
      new Date(COMPILADA).getTime() + (MARGEN_MINUTOS + 1) * 60_000,
    ).toISOString();
    expect(hayActualizacion(COMPILADA, publicacion(bastanteDespues))).toBe(true);
  });

  it('no avisa en desarrollo, donde no hay fecha de compilación', () => {
    expect(hayActualizacion(null, publicacion('2030-01-01T00:00:00.000Z'))).toBe(
      false,
    );
    expect(hayActualizacion(undefined, publicacion('2030-01-01T00:00:00.000Z'))).toBe(
      false,
    );
  });

  it('no avisa si no se pudo consultar la publicación', () => {
    expect(hayActualizacion(COMPILADA, null)).toBe(false);
  });

  it('no avisa con fechas inválidas en vez de romper', () => {
    expect(hayActualizacion('cualquier cosa', publicacion(COMPILADA))).toBe(false);
    expect(hayActualizacion(COMPILADA, publicacion('cualquier cosa'))).toBe(false);
  });
});

describe('describirVersion', () => {
  it('dice de cuándo es la versión instalada', () => {
    const ayer = new Date(Date.now() - 86_400_000).toISOString();
    expect(describirVersion(ayer)).toBe('Instalaste la versión de ayer');

    const haceCinco = new Date(Date.now() - 5 * 86_400_000).toISOString();
    expect(describirVersion(haceCinco)).toBe(
      'Instalaste la versión de hace 5 días',
    );
  });

  it('reconoce la de hoy', () => {
    expect(describirVersion(new Date().toISOString())).toBe(
      'Instalaste la versión de hoy',
    );
  });

  it('sin fecha, lo dice en vez de inventar', () => {
    expect(describirVersion(null)).toBe('Versión de desarrollo');
    expect(describirVersion('roto')).toBe('Versión de desarrollo');
  });
});
