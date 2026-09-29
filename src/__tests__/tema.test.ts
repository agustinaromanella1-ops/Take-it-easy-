import {
  getThemePreference,
  onThemeChange,
  resolverOscuro,
  setThemePreference,
  THEME_LABELS,
  THEME_OPTIONS,
} from '../theme';

describe('resolverOscuro', () => {
  it('en automático manda el sistema', () => {
    expect(resolverOscuro('automatico', 'dark')).toBe(true);
    expect(resolverOscuro('automatico', 'light')).toBe(false);
  });

  it('claro y oscuro pisan al sistema', () => {
    expect(resolverOscuro('oscuro', 'light')).toBe(true);
    expect(resolverOscuro('claro', 'dark')).toBe(false);
  });

  it('sin respuesta del sistema, automático se queda en claro', () => {
    // useColorScheme puede devolver null antes de que el sistema conteste.
    expect(resolverOscuro('automatico', null)).toBe(false);
    expect(resolverOscuro('automatico', undefined)).toBe(false);
  });
});

describe('las opciones que se muestran', () => {
  it('son las tres, en el orden claro-automático-oscuro', () => {
    expect(THEME_OPTIONS).toEqual(['claro', 'automatico', 'oscuro']);
  });

  it('todas tienen etiqueta', () => {
    for (const opcion of THEME_OPTIONS) {
      expect(THEME_LABELS[opcion]).toBeTruthy();
    }
  });
});

describe('el store de la preferencia', () => {
  afterEach(() => setThemePreference('automatico'));

  it('guarda y devuelve lo que se le pone', () => {
    setThemePreference('oscuro');
    expect(getThemePreference()).toBe('oscuro');
  });

  it('avisa a quien esté escuchando cuando cambia', () => {
    let avisos = 0;
    const dejar = onThemeChange(() => {
      avisos += 1;
    });

    setThemePreference('claro');
    expect(avisos).toBe(1);

    // Poner el mismo valor no vuelve a avisar: si no, cada dibujado
    // dispararía una actualización de todas las pantallas.
    setThemePreference('claro');
    expect(avisos).toBe(1);

    setThemePreference('oscuro');
    expect(avisos).toBe(2);

    dejar();
    setThemePreference('automatico');
    expect(avisos).toBe(2);
  });
});
