import type { AppData, Borrados, Lapida, Sellado } from '../types';
import { COLECCIONES } from '../types';

/**
 * El estado anterior, pero con sellos frescos (igual que en Pipí Cucú).
 *
 * Reponer la foto de antes tal cual no alcanza: con los sellos viejos, la
 * fusión contra lo ya guardado —que tiene el cambio, más nuevo— elegiría el
 * cambio y el deshacer no haría nada. Lo que vuelve, vuelve con la hora de
 * ahora; lo que el cambio había creado deja lápida.
 *
 * Los trucos desbloqueados no se deshacen: deshacer un movimiento no le quita
 * al perro lo que aprendió.
 */
export function volverA(actual: AppData, anterior: AppData, ahora: string): AppData {
  const resultado = { ...anterior } as AppData;
  const nuevas = {} as Borrados;
  for (const col of COLECCIONES) {
    const r = revivir<Sellado>(actual[col], anterior[col], ahora);
    (resultado[col] as Sellado[]) = r.registros;
    nuevas[col] = r.nuevasLapidas;
  }
  resultado.deleted = sumarLapidas(anterior.deleted, nuevas);
  resultado.preferencias = { ...anterior.preferencias, updatedAt: ahora };
  const trucos = [...anterior.huellitas.trucos];
  for (const t of actual.huellitas.trucos) if (!trucos.includes(t)) trucos.push(t);
  resultado.huellitas = { ...anterior.huellitas, trucos, updatedAt: ahora };
  return resultado;
}

function revivir<T extends Sellado>(actuales: readonly T[], anteriores: readonly T[], ahora: string) {
  const porIdActual = new Map(actuales.map((r) => [r.id, r]));
  const registros = anteriores.map((viejo) => {
    const actual = porIdActual.get(viejo.id);
    if (actual && mismoContenido(actual, viejo)) return actual;
    return { ...viejo, updatedAt: ahora };
  });
  const antes = new Set(anteriores.map((r) => r.id));
  const nuevasLapidas: Lapida[] = actuales.filter((r) => !antes.has(r.id)).map((r) => ({ id: r.id, deletedAt: ahora }));
  return { registros, nuevasLapidas };
}

function mismoContenido<T extends Sellado>(a: T, b: T): boolean {
  const { updatedAt: _a, ...restoA } = a;
  const { updatedAt: _b, ...restoB } = b;
  return JSON.stringify(restoA) === JSON.stringify(restoB);
}

function sumarLapidas(previas: Borrados, nuevas: Borrados): Borrados {
  const res = {} as Borrados;
  for (const col of COLECCIONES) {
    const porId = new Map(previas[col].map((l) => [l.id, l]));
    for (const l of nuevas[col]) porId.set(l.id, l);
    res[col] = [...porId.values()];
  }
  return res;
}
