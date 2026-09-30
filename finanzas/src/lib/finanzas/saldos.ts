import type { Cents, Cuenta, Movimiento } from '../../types';

/**
 * Saldos de cuentas.
 *
 * El saldo de una cuenta es su saldo inicial más el efecto de cada movimiento
 * con fecha igual o posterior a la de ese saldo. Lo anterior se da por
 * incluido en el número que la persona escribió.
 *
 * En una tarjeta de crédito o un préstamo el "saldo" es lo que se debe. Por eso el efecto de
 * un movimiento depende de qué clase de cuenta toca: una compra baja la plata
 * de una cuenta de débito y sube la deuda de una tarjeta.
 */

export function esTarjeta(c: Pick<Cuenta, 'tipo'>): boolean {
  return c.tipo === 'tarjeta-credito';
}

export function esPrestamo(c: Pick<Cuenta, 'tipo'>): boolean {
  return c.tipo === 'prestamo';
}

/**
 * Una cuenta cuyo saldo es lo que se debe: tarjeta de crédito o préstamo.
 * Nunca es plata disponible, y pagarla no es un gasto.
 */
export function esDeuda(c: Pick<Cuenta, 'tipo'>): boolean {
  return esTarjeta(c) || esPrestamo(c);
}

/**
 * Cuánto cambia el saldo de `cuenta` por el movimiento `m`.
 *
 * Las reglas que no se pueden romper:
 * - una transferencia entre cuentas propias resta de una y suma a la otra: el
 *   total no cambia;
 * - pagar la tarjeta baja la plata de la cuenta y la deuda de la tarjeta, y no
 *   es un gasto nuevo: las compras ya se anotaron cuando se hicieron.
 */
export function efecto(m: Movimiento, cuenta: Cuenta): Cents {
  const origen = m.cuentaId === cuenta.id;
  const destino = m.cuentaDestinoId === cuenta.id;
  if (!origen && !destino) return 0;
  const tarjeta = esDeuda(cuenta);

  switch (m.tipo) {
    case 'gasto':
      return origen ? (tarjeta ? m.importe : -m.importe) : 0;
    case 'ingreso':
      return origen ? (tarjeta ? -m.importe : m.importe) : 0;
    case 'devolucion':
      // En una tarjeta, la devolución baja lo que se debe.
      return origen ? (tarjeta ? -m.importe : m.importe) : 0;
    case 'transferencia':
      if (origen && destino) return 0;
      if (origen) return tarjeta ? m.importe : -m.importe;
      return tarjeta ? -m.importe : m.importe;
    case 'pago-tarjeta':
      if (origen && destino) return 0;
      if (origen) return tarjeta ? m.importe : -m.importe;
      return tarjeta ? -m.importe : m.importe;
    case 'ajuste':
      // El ajuste ya viene con signo, en el sentido del saldo de esa cuenta.
      return origen ? m.importe : 0;
  }
}

export function saldo(cuenta: Cuenta, movimientos: readonly Movimiento[]): Cents {
  let total = cuenta.saldoInicial;
  for (const m of movimientos) {
    if (m.fecha < cuenta.fechaSaldo) continue;
    total += efecto(m, cuenta);
  }
  return total;
}
