import type { Cents, Cuenta, DateISO, Movimiento } from '../../types';
import { addMonthsISO, conDia } from '../dates';
import type { Resumen } from './tarjeta';

/**
 * Cuotas de un préstamo.
 *
 * Igual que con la tarjeta, las cuotas NO se guardan como compromisos: se
 * derivan de la cuota mensual y del día de vencimiento. Así hay un solo lugar
 * desde donde se restan de "cuánto puedo usar".
 *
 * La primera cuota es la del primer vencimiento posterior al día en que se
 * cargó el préstamo. Los pagos se aplican de la cuota más vieja a la más
 * nueva. Si se cargó cuántas cuotas quedan, no se generan más que esas.
 *
 * Los intereses no se calculan solos: el saldo real lo dice el banco, y se
 * pone al día con "Actualizar saldo". La tasa sirve solo para simular.
 */

function primerVencimiento(p: Cuenta): DateISO {
  const dia = p.diaVencimiento ?? 10;
  const este = conDia(p.fechaSaldo, dia);
  return este > p.fechaSaldo ? este : conDia(addMonthsISO(`${p.fechaSaldo.slice(0, 7)}-01`, 1), dia);
}

/** Las cuotas desde que se cargó el préstamo hasta `hasta`, con lo que queda de cada una. */
export function cuotasPrestamo(p: Cuenta, movimientos: readonly Movimiento[], hasta: DateISO): Resumen[] {
  const cuota = p.cuotaMensual ?? 0;
  if (cuota <= 0) return [];
  const dia = p.diaVencimiento ?? 10;
  const primero = primerVencimiento(p);
  const lista: Resumen[] = [];
  for (let k = 0; k < 600; k++) {
    if (p.cuotasRestantes !== null && k >= p.cuotasRestantes) break;
    const venc = conDia(addMonthsISO(`${primero.slice(0, 7)}-01`, k), dia);
    if (venc > hasta) break;
    lista.push({ cierre: venc, vencimiento: venc, total: cuota, pendiente: cuota });
  }

  let pagado: Cents = 0;
  for (const m of movimientos) {
    if (m.fecha < p.fechaSaldo) continue;
    const destino = m.cuentaDestinoId === p.id && m.cuentaId !== p.id;
    if (destino && (m.tipo === 'pago-tarjeta' || m.tipo === 'transferencia')) pagado += m.importe;
  }
  for (const r of lista) {
    const aplicado = Math.min(pagado, r.pendiente);
    r.pendiente -= aplicado;
    pagado -= aplicado;
  }
  return lista;
}

/** Lo que queda por pagar de las cuotas que vencen hasta `hasta`, incluidas las vencidas. */
export function cuotasAPagarHasta(p: Cuenta, movimientos: readonly Movimiento[], hasta: DateISO): Cents {
  return cuotasPrestamo(p, movimientos, hasta).reduce((s, r) => s + r.pendiente, 0);
}

/** La próxima cuota con algo pendiente, mirando hasta dos meses adelante. */
export function proximaCuota(p: Cuenta, movimientos: readonly Movimiento[], hoy: DateISO): Resumen | null {
  return cuotasPrestamo(p, movimientos, addMonthsISO(hoy, 2)).find((r) => r.pendiente > 0) ?? null;
}
