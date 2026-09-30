import type { AccionHuellita, DateISO, Huellitas, Instante } from '../../types';

/**
 * Huellitas: una huella de cinco almohadillas que se llena con acciones de
 * organización. Al completarse, el salchicha hace un truco.
 *
 * Las reglas existen para que el juego no se pueda "farmear" y para que no
 * premie lo que no hay que premiar:
 *
 * - Cada clase de acción llena una almohadilla como mucho UNA vez por día.
 *   Anotar diez gastos no vale más que anotar uno: no se premia la cantidad
 *   de compras, y anotar compras de mentira no da nada.
 * - Como mucho dos huellas completas por día.
 * - No hay rachas ni vencimientos. Lo lleno se queda lleno aunque pasen meses,
 *   y los trucos no se pierden nunca.
 * - Nada de esto toca la plata: una meta no avanza por huellitas.
 */

export const ALMOHADILLAS = 5;
export const COMPLETAS_POR_DIA = 2;

/**
 * Los trucos, en el orden en que se aprenden. El primero es la celebración
 * inicial. Los ids no cambian nunca: están guardados en los datos de cada
 * persona. Los nombres dicen lo que se ve, porque el perro es una imagen
 * entera (el de Pipí Cucú) y no se le puede levantar una pata sola.
 */
export const TRUCOS = [
  { id: 'patita', nombre: 'Llegar volando y dar una vuelta' },
  { id: 'saltito', nombre: 'Saltitos de alegría' },
  { id: 'reverencia', nombre: 'Hacer una reverencia' },
  { id: 'giro', nombre: 'Girar sobre sí mismo' },
  { id: 'panza', nombre: 'Rodar panza arriba' },
  { id: 'pelota', nombre: 'Ir a buscar la pelota' },
  { id: 'estirarse', nombre: 'Estirarse bien largo' },
  { id: 'orejas', nombre: 'Sacudirse' },
] as const;

export type TrucoId = (typeof TRUCOS)[number]['id'];

export interface Resultado {
  huellitas: Huellitas;
  /** Si llenó una almohadilla. */
  sumo: boolean;
  /** Si completó la huella, el truco que corresponde mostrar. */
  truco: TrucoId | null;
  /** Si ese truco es nuevo. */
  nuevo: boolean;
}

export function registrarAccion(h: Huellitas, accion: AccionHuellita, hoy: DateISO, ahora: Instante): Resultado {
  const delDia = h.hoy.fecha === hoy ? h.hoy : { fecha: hoy, acciones: [], completas: 0 };

  if (delDia.acciones.includes(accion) || delDia.completas >= COMPLETAS_POR_DIA) {
    return { huellitas: h, sumo: false, truco: null, nuevo: false };
  }

  const acciones = [...delDia.acciones, accion];
  const llenas = h.almohadillas + 1;

  if (llenas < ALMOHADILLAS) {
    return {
      huellitas: { ...h, almohadillas: llenas, hoy: { ...delDia, acciones }, updatedAt: ahora },
      sumo: true,
      truco: null,
      nuevo: false,
    };
  }

  // Huella completa: se aprende el siguiente truco, o, si ya se saben todos,
  // se hace uno de los que ya sabe, rotando.
  const total = h.totalCompletas + 1;
  const siguiente = TRUCOS.find((t) => !h.trucos.includes(t.id));
  const truco: TrucoId = siguiente ? siguiente.id : (TRUCOS[(total - 1) % TRUCOS.length] ?? TRUCOS[0]).id;
  const trucos = siguiente ? [...h.trucos, siguiente.id] : h.trucos;

  return {
    huellitas: {
      almohadillas: 0,
      hoy: { fecha: hoy, acciones, completas: delDia.completas + 1 },
      totalCompletas: total,
      trucos,
      updatedAt: ahora,
    },
    sumo: true,
    truco,
    nuevo: Boolean(siguiente),
  };
}

export function nombreTruco(id: string): string {
  return TRUCOS.find((t) => t.id === id)?.nombre ?? id;
}
