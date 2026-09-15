// Las pantallas no llaman plugins de Capacitor directo: pasan por un módulo
// propio por función, para que cambiar de plugin sea tocar un solo archivo.

import { registerPlugin, type PluginListenerHandle } from '@capacitor/core';

import { esNativa } from './plataforma';

/**
 * Dictado por voz, y sólo el que hace el teléfono solo (1.2).
 *
 * Del otro lado no hay una dependencia: hay un plugin de esta misma app,
 * `android/app/src/main/java/ar/takeiteasy/agenda/DictadoPlugin.java`. Los dos
 * plugins que existen daban a elegir entre subir el audio al servidor y cerrar
 * la app, así que la regla que más importa la cumple código propio.
 *
 * El módulo de Android sólo sabe reconocer en el dispositivo: no tiene una rama
 * que caiga al reconocedor del servidor. Acá no hace falta cuidarlo con
 * opciones, porque no hay opción que pueda estar mal puesta.
 */

/** Se dicta en el castellano de acá, que es en el que ella escribe. */
export const IDIOMA = 'es-AR';

export type MotivoDelFin =
  | 'AUDIO'
  | 'SIN_PERMISO'
  | 'NO_SE_ENTENDIO'
  | 'OCUPADO'
  | 'IDIOMA_NO_DISPONIBLE'
  | 'SE_CORTO';

interface Dictado {
  disponible(): Promise<{ disponible: boolean }>;
  empezar(opciones: { idioma: string }): Promise<void>;
  parar(): Promise<void>;
  estaEscuchando(): Promise<{ escuchando: boolean }>;
  checkPermissions(): Promise<{ microfono: string }>;
  requestPermissions(): Promise<{ microfono: string }>;
  addListener(
    evento: 'texto',
    fn: (datos: { texto: string }) => void,
  ): Promise<PluginListenerHandle>;
  addListener(
    evento: 'fin',
    fn: (datos: { motivo?: MotivoDelFin }) => void,
  ): Promise<PluginListenerHandle>;
}

const plugin = registerPlugin<Dictado>('Dictado');

/** En el navegador no hay dictado: esto anda en el teléfono. */
export function hayDictado(): boolean {
  return esNativa();
}

/**
 * Si este teléfono reconoce voz sin mandar el audio a ningún lado. Hace falta
 * Android 13 o más nuevo.
 *
 * Es la única pregunta de disponibilidad que existe. Un `false` acá no habilita
 * ningún otro camino: esconde el micrófono.
 */
export async function seEscuchaAcaMismo(): Promise<boolean> {
  if (!hayDictado()) return false;
  try {
    const { disponible } = await plugin.disponible();
    return disponible;
  } catch {
    // Si ni siquiera se puede preguntar, la respuesta es que no.
    return false;
  }
}

export async function tenemosMicrofono(): Promise<boolean> {
  if (!hayDictado()) return false;
  const { microfono } = await plugin.checkPermissions();
  return microfono === 'granted';
}

export async function pedirMicrofono(): Promise<boolean> {
  if (!hayDictado()) return false;
  const { microfono } = await plugin.requestPermissions();
  return microfono === 'granted';
}

export interface ComoEscuchar {
  /** Lo que va entendiendo, mientras lo entiende. */
  alEntender: (texto: string) => void;
  /** Dejó de escuchar: por silencio, por error, o porque se lo pidió. */
  alTerminar: (motivo?: MotivoDelFin) => void;
}

let escuchas: PluginListenerHandle[] = [];

async function soltarEscuchas(): Promise<void> {
  const anteriores = escuchas;
  escuchas = [];
  for (const e of anteriores) await e.remove();
}

/**
 * Enciende el micrófono.
 *
 * No hay `catch` que reintente: si esto falla, falló, y se escribe a mano. Del
 * otro lado tampoco hay a dónde reintentar.
 */
export async function empezarADictar(como: ComoEscuchar): Promise<void> {
  if (!hayDictado()) return;
  await soltarEscuchas();

  escuchas.push(await plugin.addListener('texto', ({ texto }) => como.alEntender(texto)));
  escuchas.push(await plugin.addListener('fin', ({ motivo }) => como.alTerminar(motivo)));

  await plugin.empezar({ idioma: IDIOMA });
}

/**
 * Apagar el micrófono no puede fallar hacia afuera: si se queja de que no
 * estaba escuchando, el resultado que importa —que no esté escuchando— ya se
 * cumplió. Lo que sí pasa siempre es soltar los oyentes.
 */
export async function dejarDeDictar(): Promise<void> {
  if (!hayDictado()) return;
  try {
    await plugin.parar();
  } catch {
    // Ver arriba.
  } finally {
    await soltarEscuchas();
  }
}
