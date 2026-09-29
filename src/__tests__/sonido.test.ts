import {
  CANALES,
  CANAL_VIEJO,
  esSonido,
  SONIDOS,
  SONIDO_DETALLES,
  SONIDO_LABELS,
} from '../domain/sonido';

describe('las opciones de sonido', () => {
  it('son las tres', () => {
    expect(SONIDOS).toEqual(['predeterminado', 'vibracion', 'silencioso']);
  });

  it('todas tienen etiqueta y explicación', () => {
    for (const s of SONIDOS) {
      expect(SONIDO_LABELS[s].trim()).not.toBe('');
      expect(SONIDO_DETALLES[s].trim()).not.toBe('');
    }
  });
});

describe('los canales', () => {
  it('cada opción usa uno distinto', () => {
    // Android congela el sonido de un canal al crearlo: dos opciones que
    // compartieran id sonarían igual para siempre.
    const ids = SONIDOS.map((s) => CANALES[s]);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('ninguno reutiliza el canal de la primera versión', () => {
    // Ese se creó sin sonido; recrearlo con el mismo id lo dejaría mudo,
    // porque Android recuerda la configuración de los canales borrados.
    for (const s of SONIDOS) {
      expect(CANALES[s]).not.toBe(CANAL_VIEJO);
    }
  });
});

describe('esSonido', () => {
  it('acepta los válidos', () => {
    for (const s of SONIDOS) expect(esSonido(s)).toBe(true);
  });

  it('rechaza cualquier otra cosa guardada en la base', () => {
    expect(esSonido('fuerte')).toBe(false);
    expect(esSonido(null)).toBe(false);
    expect(esSonido(undefined)).toBe(false);
    expect(esSonido(3)).toBe(false);
  });
});
