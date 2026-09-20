import type { AppData, Borrados, Lapida } from '../types';

/**
 * Fusionar dos copias de los datos, registro por registro.
 *
 * Nace por el caso más chico posible —dos pestañas de la misma app abiertas a
 * la vez— pero la regla es la que `SINCRONIZACION.md` define para sincronizar
 * entre dispositivos, y a propósito: es la misma pregunta.
 *
 * Guardar el bloque entero y que gane el último NO alcanza. Si en una pestaña
 * se marca una sesión y en la otra se registra un cobro, la segunda en guardar
 * escribe su copia vieja más su cambio, y el de la primera desaparece sin que
 * nadie se entere. Son datos de salud y no hay servidor del que recuperarlos.
 *
 * La regla, entera:
 *
 * - **Gana el sello más nuevo.** Cada paciente, sesión y pago lleva su
 *   `updatedAt`; de dos versiones del mismo id sobrevive la de sello mayor.
 * - **Una lápida más nueva que una edición borra.** Si no, el lado que estuvo
 *   sin ver el borrado "revive" lo que el otro borró: vería un registro de un
 *   lado y nada del otro, sin forma de distinguir "esto es nuevo acá" de "esto
 *   se borró allá".
 * - **Una edición más nueva que la lápida gana.** Es lo que permite deshacer
 *   un borrado: al volver atrás, el registro sale con sello fresco.
 *
 * Es conmutativa: fusionar A con B da lo mismo que B con A, salvo los ajustes.
 */
export function fusionar(local: AppData, remoto: AppData): AppData {
  const borrados = fusionarBorrados(local.deleted, remoto.deleted);
  return {
    version: Math.max(local.version, remoto.version),
    patients: fusionarRegistros(local.patients, remoto.patients, borrados.patients),
    sessions: fusionarRegistros(local.sessions, remoto.sessions, borrados.sessions),
    payments: fusionarRegistros(local.payments, remoto.payments, borrados.payments),
    deleted: borrados,
    /*
     * Los ajustes se toman de `local` y no se fusionan.
     *
     * No llevan sello: son un puñado de preferencias —moneda, duración por
     * defecto, meta del mes— que se tocan de a una y casi nunca. Fusionarlas
     * campo por campo sin saber cuál se editó después daría un resultado
     * inventado. Gana quien está guardando, que es quien acaba de tocarlas.
     *
     * El día que la app sincronice de verdad, esto necesita su propio sello.
     */
    settings: local.settings,
  };
}

/** Lo que tienen en común todos los registros que se fusionan. */
interface Sellado {
  id: string;
  updatedAt: string;
}

function fusionarRegistros<T extends Sellado>(local: T[], remoto: T[], lapidas: Lapida[]): T[] {
  const porId = new Map<string, T>();
  // Primero el remoto y después el local: a igual sello gana el local, que es
  // quien está guardando. Importa solo para el empate exacto.
  for (const r of remoto) porId.set(r.id, r);
  for (const r of local) {
    const otro = porId.get(r.id);
    if (!otro || r.updatedAt >= otro.updatedAt) porId.set(r.id, r);
  }

  const muertos = new Map(lapidas.map((l) => [l.id, l.deletedAt]));
  const vivos: T[] = [];
  for (const r of porId.values()) {
    const enterrado = muertos.get(r.id);
    // El empate lo gana la lápida: borrar y editar en el mismo milisegundo es
    // tan raro que no vale inventar una regla más fina, y perder de menos es
    // peor que perder de más cuando lo que está en juego es un borrado pedido.
    if (enterrado !== undefined && enterrado >= r.updatedAt) continue;
    vivos.push(r);
  }
  return vivos;
}

function fusionarBorrados(local: Borrados | undefined, remoto: Borrados | undefined): Borrados {
  const vacio: Borrados = { patients: [], sessions: [], payments: [] };
  const a = local ?? vacio;
  const b = remoto ?? vacio;
  return {
    patients: fusionarLapidas(a.patients, b.patients),
    sessions: fusionarLapidas(a.sessions, b.sessions),
    payments: fusionarLapidas(a.payments, b.payments),
  };
}

/** Unión por id, quedándose con el borrado más nuevo de cada uno. */
function fusionarLapidas(a: Lapida[], b: Lapida[]): Lapida[] {
  const porId = new Map<string, string>();
  for (const l of [...a, ...b]) {
    const previo = porId.get(l.id);
    if (previo === undefined || l.deletedAt > previo) porId.set(l.id, l.deletedAt);
  }
  return [...porId].map(([id, deletedAt]) => ({ id, deletedAt }));
}
