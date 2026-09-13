import { beforeEach, describe, expect, it, vi } from 'vitest';

// El código del módulo como texto, para poder afirmar cosas sobre su forma y
// no sólo sobre lo que hace hoy. `?raw` es de Vite: no hace falta @types/node.
import fuente from './dictado.ts?raw';
import javaConComentarios from '../../android/app/src/main/java/ar/takeiteasy/agenda/DictadoPlugin.java?raw';

/**
 * El Java sin comentarios. Los comentarios de ese archivo nombran justamente lo
 * que está prohibido —para explicar por qué—, así que contar apariciones sobre
 * el texto entero daba tres donde hay una. Lo que se afirma es sobre el código.
 */
const androide = javaConComentarios
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\/\/.*/g, '');

/**
 * La regla 1.2 dice que el dictado es local o no existe. Estos tests son los
 * que la sostienen, de los dos lados: el módulo de JavaScript y el plugin de
 * Android que vive en este mismo repositorio.
 */

const plugin = {
  disponible: vi.fn(),
  empezar: vi.fn(),
  parar: vi.fn(),
  estaEscuchando: vi.fn(),
  checkPermissions: vi.fn(),
  requestPermissions: vi.fn(),
  addListener: vi.fn(),
};

let esNativaAhora = true;

vi.mock('@capacitor/core', () => ({
  registerPlugin: () => plugin,
}));

vi.mock('./plataforma', () => ({
  esNativa: () => esNativaAhora,
  plataforma: () => (esNativaAhora ? 'android' : 'web'),
}));

const {
  IDIOMA,
  dejarDeDictar,
  empezarADictar,
  hayDictado,
  seEscuchaAcaMismo,
} = await import('./dictado');

const sinHacerNada = { alEntender: () => {}, alTerminar: () => {} };

beforeEach(() => {
  esNativaAhora = true;
  vi.clearAllMocks();
  plugin.disponible.mockResolvedValue({ disponible: true });
  plugin.empezar.mockResolvedValue(undefined);
  plugin.parar.mockResolvedValue(undefined);
  plugin.addListener.mockResolvedValue({ remove: vi.fn().mockResolvedValue(undefined) });
});

describe('encender el micrófono', () => {
  it('dicta en castellano de acá', async () => {
    await empezarADictar(sinHacerNada);
    expect(plugin.empezar).toHaveBeenCalledWith({ idioma: 'es-AR' });
    expect(IDIOMA).toBe('es-AR');
  });

  it('si falla, falla: no reintenta por otro camino', async () => {
    plugin.empezar.mockRejectedValue(new Error('NO_SE_PUDO_EMPEZAR'));
    await expect(empezarADictar(sinHacerNada)).rejects.toThrow();
    expect(plugin.empezar).toHaveBeenCalledTimes(1);
  });

  it('apagar no falla hacia afuera, y suelta los oyentes igual', async () => {
    const sacar = vi.fn().mockResolvedValue(undefined);
    plugin.addListener.mockResolvedValue({ remove: sacar });
    await empezarADictar(sinHacerNada);
    plugin.parar.mockRejectedValue(new Error('no estaba escuchando'));

    await expect(dejarDeDictar()).resolves.toBeUndefined();
    expect(sacar).toHaveBeenCalledTimes(2);
  });
});

describe('preguntar si se puede', () => {
  it('sin reconocimiento en el dispositivo, no hay dictado', async () => {
    plugin.disponible.mockResolvedValue({ disponible: false });
    expect(await seEscuchaAcaMismo()).toBe(false);
  });

  it('si ni siquiera se puede preguntar, la respuesta es que no', async () => {
    plugin.disponible.mockRejectedValue(new Error('boom'));
    expect(await seEscuchaAcaMismo()).toBe(false);
  });

  it('en el navegador no hay dictado y no se toca el plugin', async () => {
    esNativaAhora = false;
    expect(hayDictado()).toBe(false);
    expect(await seEscuchaAcaMismo()).toBe(false);
    await empezarADictar(sinHacerNada);
    expect(plugin.disponible).not.toHaveBeenCalled();
    expect(plugin.empezar).not.toHaveBeenCalled();
  });
});

describe('la regla, en el plugin de Android', () => {
  // Un respaldo por servidor se escribe en una línea y arregla un síntoma real,
  // así que tiene que doler ponerlo. Estos tests miran el Java: no lo compilan,
  // pero sí comprueban que no aparezca el camino que la regla prohíbe.

  it('sólo crea el reconocedor del dispositivo', () => {
    expect(androide.match(/createOnDeviceSpeechRecognizer/g)).toHaveLength(1);
  });

  it('nunca crea el reconocedor común, que es el que sube el audio', () => {
    expect(androide).not.toMatch(/createSpeechRecognizer/);
  });

  it('pide sin conexión en la única intención que arma', () => {
    expect(androide.match(/EXTRA_PREFER_OFFLINE/g)).toHaveLength(1);
    expect(androide).toMatch(/EXTRA_PREFER_OFFLINE, true/);
  });

  it('no hay red en el archivo', () => {
    expect(androide).not.toMatch(/java\.net|HttpURL|okhttp|Retrofit/);
  });

  it('todo lo que toca el reconocedor corre en el hilo principal', () => {
    // Llamar a SpeechRecognizer desde otro hilo no da un error: cierra la app.
    // Es el defecto por el que este archivo existe.
    for (const llamada of ['createOnDeviceSpeechRecognizer', 'startListening', 'setRecognitionListener']) {
      const i = androide.indexOf(llamada);
      const antes = androide.slice(0, i);
      expect(antes).toMatch(/runOnUiThread/);
    }
  });

  it('el que suelta el reconocedor también', () => {
    expect(androide).toMatch(/private void soltarReconocedor\(\)/);
    // Se llama desde empezar y parar, que ya están dentro de runOnUiThread, y
    // desde handleOnDestroy, que Capacitor corre en el hilo principal.
    expect(androide).toMatch(/handleOnDestroy/);
  });
});

describe('la regla, en el módulo de JavaScript', () => {
  it('el micrófono se enciende en un solo lugar', () => {
    expect(fuente.match(/plugin\.empezar\(/g)).toHaveLength(1);
  });

  it('no queda ninguna referencia al plugin de terceros', () => {
    expect(fuente).not.toMatch(/capgo|capacitor-community/);
  });
});
