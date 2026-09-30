import type { Aporte, Cents, Meta } from '../../types';

/**
 * Metas y reserva. Todo sale de la plata realmente apartada (los aportes),
 * nunca de huellitas ni de puntos.
 */

export function reservado(meta: Meta, aportes: readonly Aporte[]): Cents {
  return aportes.filter((a) => a.metaId === meta.id).reduce((s, a) => s + a.importe, 0);
}

/** El próximo hito de la reserva que todavía no se alcanzó, o `null` si ya se pasaron todos. */
export function proximoHito(meta: Meta, hay: Cents): Cents | null {
  const hitos = [...(meta.objetivo ? [meta.objetivo] : []), ...meta.hitos].sort((a, b) => a - b);
  return hitos.find((h) => h > hay) ?? null;
}

/**
 * Cuántos meses de gastos esenciales cubre lo reservado, con un decimal y
 * redondeando para abajo: prometer de más es peor que de menos.
 */
export function mesesCubiertos(meta: Meta, hay: Cents): number | null {
  if (!meta.esencialesPorMes || meta.esencialesPorMes <= 0) return null;
  return Math.floor((Math.max(0, hay) / meta.esencialesPorMes) * 10) / 10;
}
