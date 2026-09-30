import type { AppData, Borrados, Coleccion, Huellitas, Lapida, Sellado } from '../types';
import { COLECCIONES } from '../types';

/**
 * Fusionar dos copias de los datos, registro por registro. La regla es la de
 * Pipí Cucú (`SINCRONIZACION.md`), porque la pregunta es la misma:
 *
 * - gana el sello más nuevo;
 * - una lápida más nueva que una edición borra;
 * - una edición más nueva que la lápida gana (así funciona deshacer un borrado).
 *
 * Nace para dos pestañas abiertas a la vez: sin esto, la segunda en guardar
 * pisa lo que anotó la primera y nadie se entera.
 */
export function fusionar(local: AppData, remoto: AppData): AppData {
  const deleted = {} as Borrados;
  const resultado = { ...local } as AppData;
  for (const col of COLECCIONES) {
    deleted[col] = fusionarLapidas(local.deleted[col], remoto.deleted[col]);
    (resultado[col] as Sellado[]) = fusionarRegistros<Sellado>(local[col], remoto[col], deleted[col]);
  }
  resultado.deleted = deleted;
  resultado.version = Math.max(local.version, remoto.version);
  resultado.preferencias = local.preferencias.updatedAt >= remoto.preferencias.updatedAt ? local.preferencias : remoto.preferencias;
  resultado.huellitas = fusionarHuellitas(local.huellitas, remoto.huellitas);
  return resultado;
}

function fusionarRegistros<T extends Sellado>(local: readonly T[], remoto: readonly T[], lapidas: Lapida[]): T[] {
  const porId = new Map<string, T>();
  for (const r of remoto) porId.set(r.id, r);
  for (const r of local) {
    const otro = porId.get(r.id);
    if (!otro || r.updatedAt >= otro.updatedAt) porId.set(r.id, r);
  }
  const muertos = new Map(lapidas.map((l) => [l.id, l.deletedAt]));
  const vivos: T[] = [];
  for (const r of porId.values()) {
    const enterrado = muertos.get(r.id);
    if (enterrado !== undefined && enterrado >= r.updatedAt) continue;
    vivos.push(r);
  }
  return vivos;
}

function fusionarLapidas(a: readonly Lapida[], b: readonly Lapida[]): Lapida[] {
  const porId = new Map<string, string>();
  for (const l of [...a, ...b]) {
    const previo = porId.get(l.id);
    if (previo === undefined || l.deletedAt > previo) porId.set(l.id, l.deletedAt);
  }
  return [...porId].map(([id, deletedAt]) => ({ id, deletedAt }));
}

/**
 * Las huellitas ganan por sello, pero los trucos se unen: un truco
 * desbloqueado en cualquier pestaña queda para siempre. Es la única promesa
 * del juego que no se puede romper ni por accidente.
 */
function fusionarHuellitas(a: Huellitas, b: Huellitas): Huellitas {
  const gana = a.updatedAt >= b.updatedAt ? a : b;
  const otra = gana === a ? b : a;
  const trucos = [...gana.trucos];
  for (const t of otra.trucos) if (!trucos.includes(t)) trucos.push(t);
  return { ...gana, trucos };
}

export type { Coleccion };
