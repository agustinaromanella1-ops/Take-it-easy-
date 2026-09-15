import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function archivosDeFuente(directorio: string): string[] {
  return readdirSync(directorio).flatMap((entrada) => {
    const ruta = join(directorio, entrada);
    if (statSync(ruta).isDirectory()) return archivosDeFuente(ruta);
    return /\.tsx?$/.test(entrada) && !entrada.endsWith('.test.ts') ? [ruta] : [];
  });
}

describe('la regla de fechas locales', () => {
  it('no hay ning\u00fan toISOString en la app', () => {
    // Es la forma m\u00e1s f\u00e1cil de romper "hoy" sin darse cuenta: devuelve UTC, y
    // despu\u00e9s de las 21 h en Argentina eso ya es ma\u00f1ana. Para fechas de
    // calendario se usa hoy() de fecha.ts.
    const culpables = archivosDeFuente('src').filter((ruta) =>
      readFileSync(ruta, 'utf8').includes('toISOString'),
    );

    expect(culpables).toEqual([]);
  });
});
