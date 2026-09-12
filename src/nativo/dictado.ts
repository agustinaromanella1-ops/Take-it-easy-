// Las pantallas no llaman plugins de Capacitor directo: pasan por un módulo
// propio por función, para que cambiar de plugin sea tocar un solo archivo.

import { SpeechRecognition } from '@capgo/capacitor-speech-recognition';

import { esNativa } from './plataforma';

/**
 * Dictado por voz, y sólo el que hace el teléfono solo (1.2).
 *
 * Lo que se dicta acá es una observación sobre un alumno. El reconocimiento
 * que trae Android por defecto manda el audio a un servidor; ese, entonces,
 * no se usa nunca, ni como respaldo ni cuando el otro falla.
 *
 * La regla está hecha estructural de dos maneras:
 *
 * - Este módulo no pregunta nunca si "hay reconocimiento". Pregunta si hay
 *   reconocimiento **en el dispositivo**, que es lo único que cuenta como
 *   disponible. El plugin expone las dos preguntas; acá existe una sola.
 * - `start` se llama siempre con las mismas opciones, armadas por una función
 *   sin parámetros. No hay una rama que pueda quedar sin `useOnDeviceRecognition`,
 *   porque no hay rama.
 *
 * Si el teléfono no puede, `seEscuchaAcaMismo()` da `false`, el micrófono no
 * aparece en ninguna pantalla y se escribe con el teclado.
 */

/** Se dicta en el castellano de acá, que es en el que ella escribe. */
export const IDIOMA = 'es-AR';

/**
 * Las únicas opciones con las que este módulo enciende el micrófono.
 *
 * `useOnDeviceRecognition` es la regla. `popup` tiene que quedar en `false`
 * por la misma razón: el diálogo del sistema es el reconocedor de Android, que
 * es el que sube el audio. El plugin además rechaza las dos juntas.
 */
export function opcionesDeDictado() {
  return {
    language: IDIOMA,
    useOnDeviceRecognition: true,
    partialResults: true,
    popup: false,
    maxResults: 1,
  } as const;
}

/** En el navegador no hay dictado: esto anda en el teléfono. */
export function hayDictado(): boolean {
  return esNativa();
}

/**
 * APAGADO: el plugin cierra la app al preguntar.
 *
 * `isOnDeviceRecognitionAvailable` del plugin llama a
 * `SpeechRecognizer.createOnDeviceSpeechRecognizer()` y `checkRecognitionSupport()`
 * sin pasar al hilo principal, y `SpeechRecognizer` de Android sólo se puede
 * usar desde ahí. Capacitor corre los métodos de los plugins en un hilo aparte,
 * así que la excepción sale y Capacitor la relanza en ese hilo: la app se cierra
 * de golpe. Pasa en la pantalla de un alumno, que es la que pregunta al abrirse.
 *
 * El `try/catch` de JavaScript no sirve para esto: el proceso muere antes de que
 * ninguna promesa se rechace.
 *
 * Está igual en la 8.3.0, así que no se arregla actualizando. Hasta que el
 * dictado tenga un camino propio que pregunte en el hilo principal, la app no
 * toca el plugin: devolver `false` acá es lo único que hace falta, porque todo
 * lo demás cuelga de esta respuesta y el micrófono no se dibuja.
 */
export async function seEscuchaAcaMismo(): Promise<boolean> {
  return false;
}

/** Lo que haría si el plugin se pudiera preguntar sin cerrar la app. */
export async function preguntarSiSeEscuchaAcaMismo(): Promise<boolean> {
  if (!hayDictado()) return false;
  try {
    const { available } = await SpeechRecognition.isOnDeviceRecognitionAvailable({
      language: IDIOMA,
    });
    return available;
  } catch {
    // Si ni siquiera se puede preguntar, la respuesta es que no.
    return false;
  }
}

export async function tenemosMicrofono(): Promise<boolean> {
  if (!hayDictado()) return false;
  const { speechRecognition } = await SpeechRecognition.checkPermissions();
  return speechRecognition === 'granted';
}

export async function pedirMicrofono(): Promise<boolean> {
  if (!hayDictado()) return false;
  const { speechRecognition } = await SpeechRecognition.requestPermissions();
  return speechRecognition === 'granted';
}

export interface ComoEscuchar {
  /** Lo que va entendiendo, mientras lo entiende. */
  alEntender: (texto: string) => void;
  /** Dejó de escuchar: por silencio, por error, o porque se lo pidió. */
  alTerminar: (motivo?: string) => void;
}

type Sacar = { remove: () => Promise<void> };
let escuchas: Sacar[] = [];

async function soltarEscuchas(): Promise<void> {
  const anteriores = escuchas;
  escuchas = [];
  for (const e of anteriores) await e.remove();
}

/**
 * Enciende el micrófono. Devuelve una función para apagarlo.
 *
 * No hay `catch` que reintente: si esto falla, falló, y se escribe a mano. Un
 * reintento sin `useOnDeviceRecognition` sería exactamente lo que la regla
 * prohíbe.
 */
export async function empezarADictar(como: ComoEscuchar): Promise<void> {
  if (!hayDictado()) return;
  await soltarEscuchas();

  escuchas.push(
    await SpeechRecognition.addListener('partialResults', (datos) => {
      const texto = datos.accumulatedText ?? datos.matches?.[0];
      if (texto) como.alEntender(texto);
    }),
  );

  escuchas.push(
    await SpeechRecognition.addListener('listeningState', (datos) => {
      const parado = datos.state === 'stopped' || datos.status === 'stopped';
      if (parado) como.alTerminar(datos.errorCode);
    }),
  );

  await SpeechRecognition.start(opcionesDeDictado());
}

/**
 * Apagar el micrófono no puede fallar hacia afuera: si el plugin se queja de
 * que no estaba escuchando, el resultado que importa —que no esté escuchando—
 * ya se cumplió. Lo que sí pasa siempre es soltar los oyentes.
 */
export async function dejarDeDictar(): Promise<void> {
  if (!hayDictado()) return;
  try {
    await SpeechRecognition.stop();
  } catch {
    // Ver arriba.
  } finally {
    await soltarEscuchas();
  }
}
