/**
 * Medimos si las notificaciones están llegando a horario.
 *
 * En Android no se puede consultar desde JavaScript si el sistema va a
 * respetar una alarma exacta: depende del permiso de alarmas exactas, del modo
 * Doze y, sobre todo, de los gestores de batería propios de cada fabricante
 * (Xiaomi, Samsung, Huawei, Oppo), que matan apps en segundo plano con
 * criterios que no están documentados.
 *
 * Así que en vez de preguntar, observamos: cada vez que una notificación suena
 * comparamos la hora real con la que correspondía. Si el retraso se repite,
 * podemos avisarle a la usuaria en lugar de dejar que descubra sola que la app
 * no le sirve.
 */

export interface DeliverySample {
  /** ISO del momento en que la notificación tenía que sonar. */
  expectedAt: string;
  /** ISO del momento en que efectivamente sonó. */
  deliveredAt: string;
}

/** Muestras que guardamos. Alcanza para ver una tendencia sin acumular datos. */
export const MAX_SAMPLES = 20;

/** Por debajo de esto no lo llamamos retraso: es el ruido normal del sistema. */
export const ON_TIME_TOLERANCE_MINUTES = 2;

/** Un aviso que llega así de tarde ya es un problema real para esta app. */
export const LATE_THRESHOLD_MINUTES = 10;

/** Un único retraso de este tamaño alcanza para avisar sin esperar a que se repita. */
export const SEVERE_DELAY_MINUTES = 30;

/** Hace falta un mínimo de muestras para no alarmar por una casualidad. */
export const MIN_SAMPLES = 3;

/** Cuántos retrasos hacen falta entre las muestras recientes para avisar. */
export const LATE_COUNT_TO_WARN = 2;

/** Minutos de retraso, nunca negativo: una notificación no llega antes de tiempo. */
export function delayMinutes(sample: DeliverySample): number {
  const expected = new Date(sample.expectedAt).getTime();
  const delivered = new Date(sample.deliveredAt).getTime();
  if (Number.isNaN(expected) || Number.isNaN(delivered)) return 0;
  return Math.max(0, Math.round((delivered - expected) / 60000));
}

export function recordSample(
  samples: DeliverySample[],
  sample: DeliverySample,
): DeliverySample[] {
  return [...samples, sample].slice(-MAX_SAMPLES);
}

export type Reliability =
  | { level: 'unknown' }
  | { level: 'ok'; samples: number }
  | { level: 'degraded'; worstDelayMinutes: number; lateCount: number };

export function assessReliability(samples: DeliverySample[]): Reliability {
  if (samples.length < MIN_SAMPLES) return { level: 'unknown' };

  const delays = samples.map(delayMinutes);
  const late = delays.filter((d) => d >= LATE_THRESHOLD_MINUTES);
  const worst = Math.max(...delays);
  const mostRecent = delays[delays.length - 1] ?? 0;

  // Un retraso grave reciente pesa por sí solo: no tiene sentido esperar a que
  // vuelva a pasar para avisar que la app no está cumpliendo.
  if (mostRecent >= SEVERE_DELAY_MINUTES || late.length >= LATE_COUNT_TO_WARN) {
    return {
      level: 'degraded',
      worstDelayMinutes: worst,
      lateCount: late.length,
    };
  }

  return { level: 'ok', samples: samples.length };
}

export function describeReliability(reliability: Reliability): string {
  switch (reliability.level) {
    case 'unknown':
      return 'Todavía no hay avisos suficientes para saberlo.';
    case 'ok':
      return 'Los avisos vienen llegando a horario.';
    case 'degraded':
      return `Hubo avisos con hasta ${reliability.worstDelayMinutes} minutos de retraso.`;
  }
}

/** Un retraso por debajo de la tolerancia no se le muestra a nadie. */
export function isOnTime(sample: DeliverySample): boolean {
  return delayMinutes(sample) <= ON_TIME_TOLERANCE_MINUTES;
}
