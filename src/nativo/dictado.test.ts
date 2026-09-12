import { beforeEach, describe, expect, it, vi } from 'vitest';

// El código del módulo como texto, para poder afirmar cosas sobre su forma y
// no sólo sobre lo que hace hoy. `?raw` es de Vite: no hace falta @types/node.
import fuente from './dictado.ts?raw';

/**
 * La regla 1.2 dice que el dictado es local o no existe. Estos tests son los
 * que la sostienen: comprueban que el micrófono nunca se enciende sin pedir
 * reconocimiento en el dispositivo, y que un fallo no abre otro camino.
 */

const plugin = {
  isOnDeviceRecognitionAvailable: vi.fn(),
  available: vi.fn(),
  start: vi.fn(),
  stop: vi.fn(),
  addListener: vi.fn(),
  checkPermissions: vi.fn(),
  requestPermissions: vi.fn(),
};

let esNativaAhora = true;

vi.mock('@capgo/capacitor-speech-recognition', () => ({
  SpeechRecognition: plugin,
}));

vi.mock('./plataforma', () => ({
  esNativa: () => esNativaAhora,
  plataforma: () => (esNativaAhora ? 'android' : 'web'),
}));

const {
  empezarADictar,
  hayDictado,
  opcionesDeDictado,
  seEscuchaAcaMismo,
} = await import('./dictado');

const sinHacerNada = { alEntender: () => {}, alTerminar: () => {} };

beforeEach(() => {
  esNativaAhora = true;
  vi.clearAllMocks();
  plugin.isOnDeviceRecognitionAvailable.mockResolvedValue({ available: true });
  plugin.available.mockResolvedValue({ available: true });
  plugin.start.mockResolvedValue({});
  plugin.stop.mockResolvedValue(undefined);
  plugin.addListener.mockResolvedValue({ remove: vi.fn().mockResolvedValue(undefined) });
});

describe('encender el micrófono', () => {
  it('siempre pide reconocimiento en el dispositivo', async () => {
    await empezarADictar(sinHacerNada);
    expect(plugin.start).toHaveBeenCalledTimes(1);
    expect(plugin.start.mock.calls[0][0]).toMatchObject({ useOnDeviceRecognition: true });
  });

  it('nunca abre el diálogo del sistema, que es el que sube el audio', async () => {
    await empezarADictar(sinHacerNada);
    expect(plugin.start.mock.calls[0][0]).toMatchObject({ popup: false });
  });

  it('dicta en castellano de acá', async () => {
    expect(opcionesDeDictado().language).toBe('es-AR');
  });

  it('si falla, falla: no reintenta sin la opción de dispositivo', async () => {
    plugin.start.mockRejectedValue(new Error('ON_DEVICE_RECOGNITION_UNAVAILABLE'));
    await expect(empezarADictar(sinHacerNada)).rejects.toThrow();
    expect(plugin.start).toHaveBeenCalledTimes(1);
  });
});

describe('preguntar si se puede', () => {
  it('pregunta por el reconocimiento en el dispositivo y no por el otro', async () => {
    expect(await seEscuchaAcaMismo()).toBe(true);
    expect(plugin.isOnDeviceRecognitionAvailable).toHaveBeenCalledWith({ language: 'es-AR' });
    // `available()` incluye el reconocedor que manda el audio al servidor.
    // Que dé `true` no habilita nada, así que ni se lo consulta.
    expect(plugin.available).not.toHaveBeenCalled();
  });

  it('sin reconocimiento en el dispositivo, no hay dictado', async () => {
    plugin.isOnDeviceRecognitionAvailable.mockResolvedValue({ available: false });
    expect(await seEscuchaAcaMismo()).toBe(false);
  });

  it('si ni siquiera se puede preguntar, la respuesta es que no', async () => {
    plugin.isOnDeviceRecognitionAvailable.mockRejectedValue(new Error('boom'));
    expect(await seEscuchaAcaMismo()).toBe(false);
  });

  it('en el navegador no hay dictado y no se toca el plugin', async () => {
    esNativaAhora = false;
    expect(hayDictado()).toBe(false);
    expect(await seEscuchaAcaMismo()).toBe(false);
    await empezarADictar(sinHacerNada);
    expect(plugin.isOnDeviceRecognitionAvailable).not.toHaveBeenCalled();
    expect(plugin.start).not.toHaveBeenCalled();
  });
});

describe('la regla, en el código', () => {
  // Los tests de arriba prueban el camino que hay hoy. Este prueba que no se
  // le pueda agregar otro sin que salte: un respaldo por servidor se escribe
  // en dos líneas y arregla un síntoma real, así que tiene que doler ponerlo.
  it('el módulo enciende el micrófono en un solo lugar', () => {
    expect(fuente.match(/SpeechRecognition\.start\(/g)).toHaveLength(1);
  });

  it('no hay ninguna forma de arrancar sin reconocimiento en el dispositivo', () => {
    expect(fuente).not.toMatch(/useOnDeviceRecognition:\s*false/);
    expect(fuente.match(/useOnDeviceRecognition:\s*true/g)).toHaveLength(1);
  });

  it('no consulta la disponibilidad que incluye al reconocedor del servidor', () => {
    expect(fuente).not.toMatch(/SpeechRecognition\.available\(/);
  });
});
