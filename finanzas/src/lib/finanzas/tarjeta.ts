import type { Cents, Cuenta, DateISO, Movimiento } from '../../types';
import { addMonthsISO, conDia } from '../dates';

/**
 * Resúmenes de tarjeta de crédito, con cuotas.
 *
 * Es donde más fácil se cuenta dos veces lo mismo, así que la regla es una
 * sola y está acá:
 *
 * - Cada compra con tarjeta se parte en sus cuotas, y cada cuota cae en un
 *   resumen según el día de cierre. La compra es el gasto; las cuotas son lo
 *   que vence cada mes.
 * - Los pagos, las devoluciones y los ajustes a la baja se aplican a las cuotas
 *   de la más vieja a la más nueva.
 * - Lo que "vence en el período" es la suma de lo que quede sin pagar de los
 *   resúmenes que vencen hasta esa fecha. Las cuotas NO se guardan como
 *   compromisos aparte: si se guardaran, habría dos lugares desde donde
 *   restarlas.
 */

export interface Resumen {
  cierre: DateISO;
  vencimiento: DateISO;
  total: Cents;
  pendiente: Cents;
}

/** El cierre del resumen en el que cae una compra hecha en `fecha`. */
export function cierreDe(fecha: DateISO, diaCierre: number): DateISO {
  const este = conDia(fecha, diaCierre);
  // La compra del mismo día del cierre entra en ese resumen.
  return fecha <= este ? este : conDia(addMonthsISO(`${fecha.slice(0, 7)}-01`, 1), diaCierre);
}

/** El vencimiento de un resumen que cierra en `cierre`: el primer día de vencimiento posterior. */
export function vencimientoDe(cierre: DateISO, diaVencimiento: number): DateISO {
  const este = conDia(cierre, diaVencimiento);
  return este > cierre ? este : conDia(addMonthsISO(`${cierre.slice(0, 7)}-01`, 1), diaVencimiento);
}

/**
 * Parte un importe en cuotas enteras de centavos. El resto de la división va
 * en la primera, para que la suma dé exacto.
 */
export function partirEnCuotas(importe: Cents, cuotas: number): Cents[] {
  const n = Math.max(1, Math.floor(cuotas));
  const base = Math.floor(importe / n);
  const resto = importe - base * n;
  return Array.from({ length: n }, (_, i) => (i === 0 ? base + resto : base));
}

interface Cargo {
  cierre: DateISO;
  importe: Cents;
}

/** Lo que se sumó a la deuda (con el cierre al que pertenece) y lo que se restó (con su fecha). */
export interface Movimientos {
  cargos: (Cargo & { movimientoId: string | null })[];
  abonos: { fecha: DateISO; importe: Cents }[];
}

export function cargosYAbonos(tarjeta: Cuenta, movimientos: readonly Movimiento[]): Movimientos {
  const diaCierre = tarjeta.diaCierre ?? 25;
  const res: Movimientos = { cargos: [], abonos: [] };

  // Lo que se debía al cargar la tarjeta se toma como parte del próximo
  // resumen. Es un supuesto, y la pantalla lo dice.
  if (tarjeta.saldoInicial > 0) {
    res.cargos.push({ cierre: cierreDe(tarjeta.fechaSaldo, diaCierre), importe: tarjeta.saldoInicial, movimientoId: null });
  } else if (tarjeta.saldoInicial < 0) {
    res.abonos.push({ fecha: tarjeta.fechaSaldo, importe: -tarjeta.saldoInicial });
  }

  for (const m of movimientos) {
    if (m.fecha < tarjeta.fechaSaldo) continue;
    const enOrigen = m.cuentaId === tarjeta.id;
    const enDestino = m.cuentaDestinoId === tarjeta.id;
    if (!enOrigen && !enDestino) continue;

    if (m.tipo === 'gasto' && enOrigen) {
      const primero = cierreDe(m.fecha, diaCierre);
      partirEnCuotas(m.importe, m.cuotas).forEach((importe, k) => {
        res.cargos.push({ cierre: conDia(addMonthsISO(`${primero.slice(0, 7)}-01`, k), diaCierre), importe, movimientoId: m.id });
      });
    } else if (m.tipo === 'ajuste' && enOrigen) {
      if (m.importe > 0) res.cargos.push({ cierre: cierreDe(m.fecha, diaCierre), importe: m.importe, movimientoId: m.id });
      else res.abonos.push({ fecha: m.fecha, importe: -m.importe });
    } else if ((m.tipo === 'pago-tarjeta' || m.tipo === 'transferencia') && enDestino && !enOrigen) {
      res.abonos.push({ fecha: m.fecha, importe: m.importe });
    } else if ((m.tipo === 'devolucion' || m.tipo === 'ingreso') && enOrigen) {
      res.abonos.push({ fecha: m.fecha, importe: m.importe });
    }
  }
  return res;
}

export function resumenes(tarjeta: Cuenta, movimientos: readonly Movimiento[]): Resumen[] {
  const diaVenc = tarjeta.diaVencimiento ?? 5;
  const { cargos, abonos: listaAbonos } = cargosYAbonos(tarjeta, movimientos);
  let abonos = listaAbonos.reduce((s, a) => s + a.importe, 0);

  const porCierre = new Map<DateISO, Cents>();
  for (const c of cargos) porCierre.set(c.cierre, (porCierre.get(c.cierre) ?? 0) + c.importe);

  const lista = [...porCierre.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([cierre, total]) => ({ cierre, vencimiento: vencimientoDe(cierre, diaVenc), total, pendiente: total }));

  // Los pagos van primero a lo más viejo.
  for (const r of lista) {
    const aplicado = Math.min(abonos, r.pendiente);
    r.pendiente -= aplicado;
    abonos -= aplicado;
  }
  return lista;
}

/**
 * Lo que se debía al cierre, según lo anotado: los cargos de ese resumen y los
 * anteriores, menos lo pagado hasta ese día. Es lo mismo que el banco llama
 * "saldo actual" del resumen, así que se pueden comparar.
 */
export function deudaAlCierre(tarjeta: Cuenta, movimientos: readonly Movimiento[], cierre: DateISO): Cents {
  const { cargos, abonos } = cargosYAbonos(tarjeta, movimientos);
  const cargado = cargos.filter((c) => c.cierre <= cierre).reduce((s, c) => s + c.importe, 0);
  const pagado = abonos.filter((a) => a.fecha <= cierre).reduce((s, a) => s + a.importe, 0);
  return cargado - pagado;
}

/** Lo que se debe en total, contando cuotas futuras. */
export function deudaTotal(tarjeta: Cuenta, movimientos: readonly Movimiento[]): Cents {
  return resumenes(tarjeta, movimientos).reduce((s, r) => s + r.pendiente, 0);
}

/** Lo que queda por pagar de los resúmenes que vencen hasta `hasta` (incluidos los vencidos). */
export function aPagarHasta(tarjeta: Cuenta, movimientos: readonly Movimiento[], hasta: DateISO): Cents {
  return resumenes(tarjeta, movimientos)
    .filter((r) => r.vencimiento <= hasta)
    .reduce((s, r) => s + r.pendiente, 0);
}

/** El próximo resumen con algo pendiente, o `null`. */
export function proximoResumen(tarjeta: Cuenta, movimientos: readonly Movimiento[]): Resumen | null {
  return resumenes(tarjeta, movimientos).find((r) => r.pendiente > 0) ?? null;
}

export interface CompraEnCuotas {
  movimiento: Movimiento;
  /** Número de la cuota del próximo resumen que todavía no pasó (1 a N), o `null` si terminó. */
  proxima: number | null;
  /** Cuánto falta que venza de esta compra (sin mirar pagos: los pagos van al resumen entero). */
  faltaVencer: Cents;
}

/**
 * Compras en más de una cuota que todavía tienen cuotas por delante. Sirve
 * para ver de dónde sale cada resumen: "zapatillas, cuota 2 de 3".
 */
export function comprasEnCuotas(tarjeta: Cuenta, movimientos: readonly Movimiento[], hoy: DateISO): CompraEnCuotas[] {
  const diaCierre = tarjeta.diaCierre ?? 25;
  const diaVenc = tarjeta.diaVencimiento ?? 5;
  const res: CompraEnCuotas[] = [];
  for (const m of movimientos) {
    if (m.tipo !== 'gasto' || m.cuentaId !== tarjeta.id || m.cuotas <= 1 || m.fecha < tarjeta.fechaSaldo) continue;
    const primero = cierreDe(m.fecha, diaCierre);
    const partes = partirEnCuotas(m.importe, m.cuotas);
    let proxima: number | null = null;
    let faltaVencer: Cents = 0;
    partes.forEach((importe, k) => {
      const venc = vencimientoDe(conDia(addMonthsISO(`${primero.slice(0, 7)}-01`, k), diaCierre), diaVenc);
      if (venc >= hoy) {
        proxima ??= k + 1;
        faltaVencer += importe;
      }
    });
    if (proxima !== null) res.push({ movimiento: m, proxima, faltaVencer });
  }
  return res.sort((a, b) => (a.movimiento.fecha > b.movimiento.fecha ? -1 : 1));
}
