import { useLiveQuery } from 'dexie-react-hooks';

import { guardarPreferencia, leerPreferencia } from './datos/preferencias';

/**
 * Cómo se ve la app y cuánto se mueve.
 *
 * Las dos elecciones terminan siendo un atributo en el `<html>`, y de ahí en
 * más el trabajo lo hace el CSS: `index.css` define la paleta oscura bajo
 * `[data-tema='oscuro']` y frena las transiciones bajo
 * `[data-animaciones='nunca']`. Acá no hay ni un color.
 *
 * «Automático» no escribe nada: sin atributo, las consultas de medios
 * (`prefers-color-scheme`, `prefers-reduced-motion`) mandan solas, que es
 * exactamente lo que querés cuando el teléfono cambia de tema al atardecer.
 */

export type Tema = 'sistema' | 'claro' | 'oscuro';
export type Animaciones = 'sistema' | 'siempre' | 'nunca';

export const TEMAS: { valor: Tema; texto: string }[] = [
  { valor: 'sistema', texto: 'Automático' },
  { valor: 'claro', texto: 'Claro' },
  { valor: 'oscuro', texto: 'Oscuro' },
];

export const ANIMACIONES: { valor: Animaciones; texto: string }[] = [
  { valor: 'sistema', texto: 'Según el sistema' },
  { valor: 'siempre', texto: 'Siempre' },
  { valor: 'nunca', texto: 'Nunca' },
];

const CLAVE_TEMA = 'aspecto:tema';
const CLAVE_ANIMACIONES = 'aspecto:animaciones';

/**
 * Espejo en localStorage, que es una cache y nada más.
 *
 * IndexedDB es la fuente de verdad, pero responde un instante después del
 * primer pintado: sin esto, cada arranque con el tema oscuro puesto a mano
 * empieza en claro y salta. localStorage se lee sin esperar, así que el
 * degradado correcto ya está en el primer cuadro. Si el espejo se pierde o
 * miente, la base lo corrige apenas contesta.
 */
function recordar(clave: string, valor: string): void {
  try {
    localStorage.setItem(clave, valor);
  } catch {
    // Sin localStorage la app anda igual: sólo vuelve el parpadeo.
  }
}

function recordado(clave: string): string | undefined {
  try {
    return localStorage.getItem(clave) ?? undefined;
  } catch {
    return undefined;
  }
}

function delJuego<T extends string>(valor: unknown, opciones: { valor: T }[], porOmision: T): T {
  return opciones.some((o) => o.valor === valor) ? (valor as T) : porOmision;
}

export async function leerTema(): Promise<Tema> {
  return delJuego(await leerPreferencia(CLAVE_TEMA), TEMAS, 'sistema');
}

export async function leerAnimaciones(): Promise<Animaciones> {
  return delJuego(await leerPreferencia(CLAVE_ANIMACIONES), ANIMACIONES, 'sistema');
}

export async function guardarTema(tema: Tema): Promise<void> {
  recordar(CLAVE_TEMA, tema);
  await guardarPreferencia(CLAVE_TEMA, tema);
}

export async function guardarAnimaciones(animaciones: Animaciones): Promise<void> {
  recordar(CLAVE_ANIMACIONES, animaciones);
  await guardarPreferencia(CLAVE_ANIMACIONES, animaciones);
}

/** Lo que dice la cache, para pintar antes de que conteste la base. */
export function aspectoRecordado(): { tema: Tema; animaciones: Animaciones } {
  return {
    tema: delJuego(recordado(CLAVE_TEMA), TEMAS, 'sistema'),
    animaciones: delJuego(recordado(CLAVE_ANIMACIONES), ANIMACIONES, 'sistema'),
  };
}

/**
 * Lo único que `pintar` necesita de un elemento. Pedir esto y no un
 * `HTMLElement` entero deja probarlo sin montar un DOM, que para dos
 * atributos sería traer una dependencia nueva a cambio de nada.
 */
export interface ConAtributos {
  setAttribute(nombre: string, valor: string): void;
  removeAttribute(nombre: string): void;
}

/** Escribe la elección en el `<html>`. Es todo lo que hace falta. */
export function pintar(
  tema: Tema,
  animaciones: Animaciones,
  raiz: ConAtributos = document.documentElement,
): void {
  if (tema === 'sistema') raiz.removeAttribute('data-tema');
  else raiz.setAttribute('data-tema', tema);

  if (animaciones === 'sistema') raiz.removeAttribute('data-animaciones');
  else raiz.setAttribute('data-animaciones', animaciones);
}

/**
 * Si corresponde mover las cosas. Lo necesita el perrito, porque un GIF
 * animado no se puede frenar desde CSS: hay que mostrar el otro archivo.
 */
export function seMueve(animaciones: Animaciones, pideQuieto: boolean): boolean {
  if (animaciones === 'siempre') return true;
  if (animaciones === 'nunca') return false;
  return !pideQuieto;
}

export function useTema(): Tema {
  return useLiveQuery(leerTema, [], aspectoRecordado().tema);
}

export function useAnimaciones(): Animaciones {
  return useLiveQuery(leerAnimaciones, [], aspectoRecordado().animaciones);
}
