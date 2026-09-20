import type { AppData, Borrados, Lapida } from '../types';

/**
 * El estado anterior, pero con sellos frescos.
 *
 * Deshacer no puede ser "volver a poner la copia de antes" tal cual. Los sellos
 * (`updatedAt`) son lo que decide quién gana al fusionar: si el deshacer
 * devolviera los sellos viejos, la fusión con lo que hay guardado —que tiene
 * los del cambio que se quiere deshacer, más nuevos— elegiría el cambio y el
 * deshacer no haría nada. Y lo mismo entre dispositivos, el día que la app
 * sincronice.
 *
 * Entonces: lo que vuelve, vuelve con la hora de ahora. Y lo que el cambio
 * había creado no se borra a secas: deja su lápida, porque si no, el otro lado
 * —que sí vio la creación— lo revive en la próxima fusión.
 */
export function volverA(actual: AppData, anterior: AppData, ahora: string): AppData {
  const patients = revivir(actual.patients, anterior.patients, ahora);
  const sessions = revivir(actual.sessions, anterior.sessions, ahora);
  const payments = revivir(actual.payments, anterior.payments, ahora);

  return {
    ...anterior,
    patients: patients.registros,
    sessions: sessions.registros,
    payments: payments.registros,
    /*
     * Se parte de las lápidas de ANTES, no de las de ahora: si el cambio que
     * se deshace era un borrado, su lápida tiene que irse para que el registro
     * vuelva a existir. Vuelve con sello fresco, así que le gana a la lápida
     * que el otro lado todavía tenga.
     */
    deleted: sumarLapidas(anterior.deleted, {
      patients: patients.nuevasLapidas,
      sessions: sessions.nuevasLapidas,
      payments: payments.nuevasLapidas,
    }),
  };
}

interface Sellado {
  id: string;
  updatedAt: string;
}

function revivir<T extends Sellado>(
  actuales: T[],
  anteriores: T[],
  ahora: string,
): { registros: T[]; nuevasLapidas: Lapida[] } {
  const porIdActual = new Map(actuales.map((r) => [r.id, r]));

  const registros = anteriores.map((viejo) => {
    const actual = porIdActual.get(viejo.id);
    // Si quedó igual, no se toca: volver a sellar algo que nadie cambió lo
    // haría parecer recién editado, que es justo lo que el sello evita.
    if (actual && mismoContenido(actual, viejo)) return actual;
    return { ...viejo, updatedAt: ahora };
  });

  const antes = new Set(anteriores.map((r) => r.id));
  const nuevasLapidas = actuales
    .filter((r) => !antes.has(r.id))
    .map((r) => ({ id: r.id, deletedAt: ahora }));

  return { registros, nuevasLapidas };
}

/** Iguales salvo el sello, que es lo que estamos por decidir. */
function mismoContenido<T extends Sellado>(a: T, b: T): boolean {
  const { updatedAt: _a, ...restoA } = a;
  const { updatedAt: _b, ...restoB } = b;
  return JSON.stringify(restoA) === JSON.stringify(restoB);
}

function sumarLapidas(previas: Borrados | undefined, nuevas: Borrados): Borrados {
  const base = previas ?? { patients: [], sessions: [], payments: [] };
  const unir = (a: Lapida[], b: Lapida[]) => {
    const porId = new Map(a.map((l) => [l.id, l]));
    for (const l of b) porId.set(l.id, l);
    return [...porId.values()];
  };
  return {
    patients: unir(base.patients, nuevas.patients),
    sessions: unir(base.sessions, nuevas.sessions),
    payments: unir(base.payments, nuevas.payments),
  };
}
