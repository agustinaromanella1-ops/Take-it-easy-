import type { ScheduledMessage } from './types';
import { wallToUtc } from './time';

/**
 * El estado que se muestra al lado de cada mensaje.
 *
 * No es lo mismo que la columna `status` de la base: ahí viven las
 * transiciones internas, acá lo que necesita saber alguien que mira la lista
 * de reojo. Un mensaje `scheduled` puede estar al día, atrasado o postergado
 * según la hora y según si ya se corrió una vez.
 */
export type EstadoVisible =
  | 'programado'
  | 'postergado'
  | 'atrasado'
  | 'falta-enviar'
  | 'enviado';

export const ETIQUETAS: Record<EstadoVisible, string> = {
  programado: 'Programado',
  postergado: 'Postergado',
  atrasado: 'Atrasado',
  'falta-enviar': 'Falta enviar',
  enviado: 'Enviado',
};

/** Qué tan urgente es, para elegir el color sin atarlo a uno puntual. */
export type Tono = 'neutro' | 'aviso' | 'listo';

export const TONOS: Record<EstadoVisible, Tono> = {
  programado: 'neutro',
  postergado: 'neutro',
  atrasado: 'aviso',
  'falta-enviar': 'aviso',
  enviado: 'listo',
};

/**
 * Cuánto se queda un mensaje enviado a la vista antes de irse al historial.
 *
 * Que desaparezca apenas se confirma deja la duda de si se mandó; que se
 * quede para siempre convierte la lista de pendientes en un archivo. Una hora
 * alcanza para mirar y quedarse tranquila.
 */
export const VENTANA_ENVIADO_MINUTOS = 60;

const haceMenosDe = (
  iso: string | null,
  minutos: number,
  now: Date,
): boolean => {
  if (!iso) return false;
  const cuando = new Date(iso).getTime();
  if (Number.isNaN(cuando)) return false;
  return now.getTime() - cuando < minutos * 60_000;
};

const yaPaso = (m: ScheduledMessage, now: Date): boolean =>
  m.localAt !== null &&
  wallToUtc(m.localAt, m.timezone).getTime() <= now.getTime();

/**
 * El estado a mostrar, o null si el mensaje no va en la lista principal
 * (un borrador, algo descartado, o un enviado de hace rato).
 */
export function estadoDe(
  m: ScheduledMessage,
  now: Date = new Date(),
): EstadoVisible | null {
  switch (m.status) {
    case 'draft':
    case 'skipped':
      return null;

    case 'sent':
      return haceMenosDe(m.sentAt, VENTANA_ENVIADO_MINUTOS, now)
        ? 'enviado'
        : null;

    case 'fired':
      // Sonó el aviso y nadie confirmó todavía.
      return 'falta-enviar';

    case 'scheduled':
      if (yaPaso(m, now)) return 'atrasado';
      // Postergado es "programado, pero ya lo corriste una vez": sirve para
      // distinguir lo que se viene de lo que se está pateando.
      return m.postponedAt ? 'postergado' : 'programado';
  }
}

/** Si el mensaje tiene que aparecer en la pantalla de Programados. */
export function enListaPrincipal(
  m: ScheduledMessage,
  now: Date = new Date(),
): boolean {
  return estadoDe(m, now) !== null;
}

/** Si ya le toca al historial. */
export function enHistorial(
  m: ScheduledMessage,
  now: Date = new Date(),
): boolean {
  if (m.status === 'skipped') return true;
  return m.status === 'sent' && !haceMenosDe(m.sentAt, VENTANA_ENVIADO_MINUTOS, now);
}

/** Cuántos hay de cada estado, para el resumen de arriba de la lista. */
export function contarPorEstado(
  mensajes: readonly ScheduledMessage[],
  now: Date = new Date(),
): Record<EstadoVisible, number> {
  const cuenta: Record<EstadoVisible, number> = {
    programado: 0,
    postergado: 0,
    atrasado: 0,
    'falta-enviar': 0,
    enviado: 0,
  };
  for (const m of mensajes) {
    const estado = estadoDe(m, now);
    if (estado) cuenta[estado] += 1;
  }
  return cuenta;
}

/** Lo que de verdad reclama atención: atrasados y sin confirmar. */
export function requierenAtencion(
  cuenta: Record<EstadoVisible, number>,
): number {
  return cuenta.atrasado + cuenta['falta-enviar'];
}
