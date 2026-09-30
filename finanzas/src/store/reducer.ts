import type {
  Aporte,
  AppData,
  Borrados,
  Cents,
  Coleccion,
  Compromiso,
  Cuenta,
  DateISO,
  Huellitas,
  IngresoEsperado,
  Meta,
  Movimiento,
  Preferencias,
  Sellado,
} from '../types';
import { addMonthsISO } from '../lib/dates';
import { saldo } from '../lib/finanzas/saldos';

/**
 * La única puerta de entrada a los datos.
 *
 * El sello (`updatedAt`) y las lápidas los pone el reducer, no quien
 * despacha: los payloads excluyen `updatedAt` por tipo, así no hay forma de
 * olvidárselo. Los ids sí los genera quien despacha, para que el reducer sea
 * puro y se pueda repetir.
 */

type SinSello<T> = Omit<T, 'updatedAt'>;

export type Action =
  | { type: 'cuenta/agregar'; cuenta: SinSello<Cuenta> }
  | { type: 'cuenta/editar'; cuenta: SinSello<Cuenta> }
  | { type: 'cuenta/borrar'; id: string }
  | { type: 'cuenta/confirmarSaldo'; cuentaId: string; saldoReal: Cents; fecha: DateISO; ajusteId: string }
  | { type: 'mov/agregar'; mov: SinSello<Movimiento> }
  | { type: 'mov/agregarVarios'; movs: SinSello<Movimiento>[]; origen: 'importar' | 'captura' | 'resumen' }
  | { type: 'mov/editar'; mov: SinSello<Movimiento> }
  | { type: 'mov/borrar'; id: string }
  | { type: 'mov/revisado'; ids: string[] }
  | { type: 'compromiso/agregar'; compromiso: SinSello<Compromiso> }
  | { type: 'compromiso/editar'; compromiso: SinSello<Compromiso> }
  | { type: 'compromiso/borrar'; id: string }
  | { type: 'compromiso/pagar'; id: string; pago: SinSello<Movimiento> | null; siguienteId: string }
  | { type: 'ingreso/agregar'; ingreso: SinSello<IngresoEsperado> }
  | { type: 'ingreso/editar'; ingreso: SinSello<IngresoEsperado> }
  | { type: 'ingreso/borrar'; id: string }
  | { type: 'ingreso/cobrar'; id: string; cobro: SinSello<Movimiento>; siguienteId: string }
  | { type: 'meta/agregar'; meta: SinSello<Meta> }
  | { type: 'meta/editar'; meta: SinSello<Meta> }
  | { type: 'meta/borrar'; id: string }
  | { type: 'meta/destacar'; id: string }
  | { type: 'aporte/agregar'; aporte: SinSello<Aporte>; transferencia: SinSello<Movimiento> | null }
  | { type: 'aporte/borrar'; id: string }
  | { type: 'prefs/cambiar'; cambios: Partial<SinSello<Preferencias>> }
  | { type: 'huellitas/poner'; huellitas: SinSello<Huellitas> }
  | { type: 'data/replace'; payload: AppData };

function ahora(): string {
  return new Date().toISOString();
}

function sellar<T extends object>(r: T): T & Sellado {
  return { ...r, updatedAt: ahora() } as T & Sellado;
}

function agregar<K extends Coleccion>(data: AppData, col: K, registro: object): AppData {
  return { ...data, [col]: [...data[col], sellar(registro)] };
}

function editar<K extends Coleccion, R extends { id: string }>(data: AppData, col: K, registro: R): AppData {
  const lista = data[col] as Sellado[];
  if (!lista.some((r) => r.id === registro.id)) return data;
  return { ...data, [col]: lista.map((r) => (r.id === registro.id ? sellar(registro) : r)) };
}

function borrar<K extends Coleccion>(data: AppData, col: K, ids: string[]): AppData {
  const set = new Set(ids);
  const lista = data[col] as Sellado[];
  const quedan = lista.filter((r) => !set.has(r.id));
  if (quedan.length === lista.length) return data;
  const cuando = ahora();
  const deleted: Borrados = { ...data.deleted, [col]: [...data.deleted[col], ...ids.map((id) => ({ id, deletedAt: cuando }))] };
  return { ...data, [col]: quedan, deleted };
}

export function reducer(data: AppData, action: Action): AppData {
  switch (action.type) {
    case 'cuenta/agregar':
      return agregar(data, 'cuentas', action.cuenta);
    case 'cuenta/editar':
      return editar(data, 'cuentas', action.cuenta);
    case 'cuenta/borrar': {
      // Una cuenta con historia no se borra: se archiva. Borrarla dejaría
      // movimientos apuntando a la nada y cambiaría números viejos.
      if (data.movimientos.some((m) => m.cuentaId === action.id || m.cuentaDestinoId === action.id)) return data;
      const sinAportes = borrar(data, 'aportes', data.aportes.filter((a) => a.cuentaId === action.id).map((a) => a.id));
      return borrar(sinAportes, 'cuentas', [action.id]);
    }
    case 'cuenta/confirmarSaldo': {
      const c = data.cuentas.find((x) => x.id === action.cuentaId);
      if (!c) return data;
      const calculado = saldo(c, data.movimientos);
      const diferencia = action.saldoReal - calculado;
      let res = editar(data, 'cuentas', { ...c, confirmadoEn: action.fecha, aproximado: false });
      if (diferencia !== 0) {
        // Diferencia sin conciliar: se registra tal cual, sin categoría
        // inventada y sin reconstruir movimientos que nadie anotó.
        res = agregar(res, 'movimientos', {
          id: action.ajusteId,
          tipo: 'ajuste',
          importe: diferencia,
          moneda: c.moneda,
          fecha: action.fecha,
          cuentaId: c.id,
          cuentaDestinoId: null,
          categoria: '',
          comercio: '',
          nota: 'Diferencia sin conciliar',
          cuotas: 1,
          devolucionDe: null,
          origen: 'ajuste',
          aRevisar: false,
        } satisfies SinSello<Movimiento>);
      }
      return res;
    }

    case 'mov/agregar':
      return agregar(data, 'movimientos', action.mov);
    case 'mov/agregarVarios':
      // Una sola acción para que deshacer se lleve la importación entera.
      return action.movs.reduce((d, m) => agregar(d, 'movimientos', m), data);
    case 'mov/editar':
      return editar(data, 'movimientos', action.mov);
    case 'mov/borrar': {
      // Si era el pago de un compromiso, el compromiso vuelve a estar pendiente.
      let res = borrar(data, 'movimientos', [action.id]);
      for (const k of data.compromisos) {
        if (k.pagoId === action.id) res = editar(res, 'compromisos', { ...k, pagado: false, pagoId: null });
      }
      return res;
    }
    case 'mov/revisado': {
      const ids = new Set(action.ids);
      return { ...data, movimientos: data.movimientos.map((m) => (ids.has(m.id) && m.aRevisar ? sellar({ ...m, aRevisar: false }) : m)) };
    }

    case 'compromiso/agregar':
      return agregar(data, 'compromisos', action.compromiso);
    case 'compromiso/editar':
      return editar(data, 'compromisos', action.compromiso);
    case 'compromiso/borrar':
      return borrar(data, 'compromisos', [action.id]);
    case 'compromiso/pagar': {
      const k = data.compromisos.find((x) => x.id === action.id);
      if (!k || k.pagado) return data;
      let res = data;
      if (action.pago) res = agregar(res, 'movimientos', action.pago);
      res = editar(res, 'compromisos', { ...k, pagado: true, pagoId: action.pago?.id ?? null, importe: k.importe ?? action.pago?.importe ?? null });
      if (k.recurrencia === 'mensual') {
        res = agregar(res, 'compromisos', {
          ...k,
          id: action.siguienteId,
          vencimiento: addMonthsISO(k.vencimiento, 1),
          pagado: false,
          pagoId: null,
        } satisfies SinSello<Compromiso>);
      }
      return res;
    }

    case 'ingreso/agregar':
      return agregar(data, 'ingresos', action.ingreso);
    case 'ingreso/editar':
      return editar(data, 'ingresos', action.ingreso);
    case 'ingreso/borrar':
      return borrar(data, 'ingresos', [action.id]);
    case 'ingreso/cobrar': {
      const i = data.ingresos.find((x) => x.id === action.id);
      if (!i || i.cobrado) return data;
      let res = agregar(data, 'movimientos', action.cobro);
      res = editar(res, 'ingresos', { ...i, cobrado: true });
      if (i.recurrencia === 'mensual') {
        res = agregar(res, 'ingresos', { ...i, id: action.siguienteId, fecha: addMonthsISO(i.fecha, 1), cobrado: false } satisfies SinSello<IngresoEsperado>);
      }
      return res;
    }

    case 'meta/agregar': {
      // La primera meta queda destacada sola; si esta viene destacada, las demás dejan de estarlo.
      const res = action.meta.destacada ? quitarDestacadas(data) : data;
      const destacada = action.meta.destacada || !data.metas.some((m) => m.destacada && !m.esReserva);
      return agregar(res, 'metas', { ...action.meta, destacada: action.meta.esReserva ? false : destacada });
    }
    case 'meta/editar':
      return editar(data, 'metas', action.meta);
    case 'meta/borrar': {
      const res = borrar(data, 'aportes', data.aportes.filter((a) => a.metaId === action.id).map((a) => a.id));
      return borrar(res, 'metas', [action.id]);
    }
    case 'meta/destacar': {
      const res = quitarDestacadas(data);
      const m = res.metas.find((x) => x.id === action.id);
      return m ? editar(res, 'metas', { ...m, destacada: true }) : res;
    }

    case 'aporte/agregar': {
      let res = data;
      if (action.transferencia) res = agregar(res, 'movimientos', action.transferencia);
      return agregar(res, 'aportes', action.aporte);
    }
    case 'aporte/borrar':
      return borrar(data, 'aportes', [action.id]);

    case 'prefs/cambiar':
      return { ...data, preferencias: { ...data.preferencias, ...action.cambios, updatedAt: ahora() } };
    case 'huellitas/poner':
      return { ...data, huellitas: { ...action.huellitas, updatedAt: ahora() } };
    case 'data/replace':
      return action.payload;
  }
}

function quitarDestacadas(data: AppData): AppData {
  return {
    ...data,
    metas: data.metas.map((m) => (m.destacada ? sellar({ ...m, destacada: false }) : m)),
  };
}

/**
 * Cómo se nombra cada cambio en la barra de deshacer. Sin etiqueta no se
 * ofrece deshacer, y el cambio queda sin confirmación visible: toda acción
 * nueva que toque datos tiene que tener la suya.
 */
export function etiquetaDe(action: Action): string | null {
  switch (action.type) {
    case 'cuenta/agregar':
      return 'Agregaste una cuenta';
    case 'cuenta/editar':
      return 'Editaste una cuenta';
    case 'cuenta/borrar':
      return 'Borraste una cuenta';
    case 'cuenta/confirmarSaldo':
      return 'Actualizaste un saldo';
    case 'mov/agregar':
      return action.mov.tipo === 'ingreso' ? 'Anotaste un ingreso' : action.mov.tipo === 'gasto' ? 'Anotaste un gasto' : 'Anotaste un movimiento';
    case 'mov/agregarVarios': {
      const n = action.movs.length;
      const que = n === 1 ? '1 movimiento' : `${n} movimientos`;
      return action.origen === 'importar' ? `Importaste ${que}` : `Agregaste ${que}`;
    }
    case 'mov/editar':
      return 'Editaste un movimiento';
    case 'mov/borrar':
      return 'Borraste un movimiento';
    case 'mov/revisado':
      return 'Marcaste como revisado';
    case 'compromiso/agregar':
      return 'Agregaste un compromiso';
    case 'compromiso/editar':
      return 'Editaste un compromiso';
    case 'compromiso/borrar':
      return 'Borraste un compromiso';
    case 'compromiso/pagar':
      return 'Marcaste un pago';
    case 'ingreso/agregar':
      return 'Agregaste un ingreso esperado';
    case 'ingreso/editar':
      return 'Editaste un ingreso esperado';
    case 'ingreso/borrar':
      return 'Borraste un ingreso esperado';
    case 'ingreso/cobrar':
      return 'Anotaste un cobro';
    case 'meta/agregar':
      return 'Creaste una meta';
    case 'meta/editar':
      return 'Editaste una meta';
    case 'meta/borrar':
      return 'Borraste una meta';
    case 'meta/destacar':
      return 'Cambiaste la meta destacada';
    case 'aporte/agregar':
      return action.aporte.importe < 0 ? 'Usaste plata de una meta' : 'Apartaste plata';
    case 'aporte/borrar':
      return 'Borraste un aporte';
    case 'data/replace':
      return 'Importaste una copia';
    // Las preferencias se cambian de a una y se ven al instante; las
    // huellitas acompañan a otra acción que ya tiene su deshacer.
    case 'prefs/cambiar':
    case 'huellitas/poner':
      return null;
  }
}
