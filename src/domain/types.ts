import type { Adjunto } from './adjunto';

/** Estados por los que pasa un mensaje. Ver README para el diagrama de transiciones. */
export type MessageStatus =
  | 'draft' // escrito, todavía sin fecha
  | 'scheduled' // con fecha, esperando la hora
  | 'fired' // sonó la notificación, falta confirmar
  | 'sent' // confirmado como enviado
  | 'skipped'; // la usuaria decidió no mandarlo

/**
 * A quién va el mensaje.
 *
 * Un contacto se abre directo en su chat con el texto ya puesto. Un grupo no:
 * WhatsApp no publica ninguna forma de abrir un grupo concreto desde afuera,
 * así que el grupo se guarda solo como nombre —para saber de qué mensaje se
 * trata— y al momento de mandarlo se abre el selector de chats de WhatsApp con
 * el texto listo. Es un toque más y no se puede hacer mejor.
 */
export type RecipientKind = 'contacto' | 'grupo';

/**
 * Desde qué WhatsApp se manda. Quien tiene las dos instaladas no quiere
 * elegir en un menú del sistema cada vez, y sobre todo no quiere mandar un
 * mensaje de trabajo desde la cuenta personal por error.
 */
export type WhatsAppApp = 'normal' | 'business';

export interface ScheduledMessage {
  id: string;
  recipientKind: RecipientKind;
  contactName: string | null;
  /** En E.164, ej "+5491112345678". Vacío cuando el destinatario es un grupo. */
  phoneE164: string;
  body: string;
  /**
   * Instante de envío en UTC (ISO). Es el valor con el que se ordena y se
   * programa la notificación. Se recalcula desde localAt + timezone cuando
   * cambian las reglas del huso.
   */
  scheduledAt: string | null;
  /**
   * La hora de pared elegida, sin huso: "2026-09-14T09:00".
   * Es la fuente de verdad de la intención ("el lunes a las 9").
   */
  localAt: string | null;
  /** Zona IANA, ej "America/Argentina/Buenos_Aires". */
  timezone: string;
  status: MessageStatus;
  createdAt: string;
  firedAt: string | null;
  sentAt: string | null;
  /** Cuándo se corrió por última vez desde el aviso. Marca los postergados. */
  postponedAt: string | null;
  /** Desde qué WhatsApp sale. Null: se usa lo que diga Ajustes. */
  whatsappApp: WhatsAppApp | null;
  recurrenceRule: string | null;
  notes: string | null;
  /** Id de la notificación local agendada, para poder cancelarla. */
  notificationId: string | null;
  /**
   * El adjunto va en cuatro columnas planas y no en un objeto porque el
   * repositorio lee las filas de SQLite directo a este tipo, sin traductor.
   * Para trabajar con él está `adjuntoDe`.
   */
  attachmentFile: string | null;
  attachmentName: string | null;
  attachmentMime: string | null;
  attachmentBytes: number | null;
}

/** Junta las cuatro columnas en el objeto con el que trabaja el dominio. */
export function adjuntoDe(m: {
  attachmentFile: string | null;
  attachmentName: string | null;
  attachmentMime: string | null;
  attachmentBytes: number | null;
}): Adjunto | null {
  if (!m.attachmentFile) return null;
  return {
    archivo: m.attachmentFile,
    nombre: m.attachmentName ?? m.attachmentFile,
    mime: m.attachmentMime ?? 'application/octet-stream',
    bytes: m.attachmentBytes ?? 0,
  };
}

/** El camino inverso: el objeto desarmado en las columnas que guarda la base. */
export function columnasDeAdjunto(
  a: Adjunto | null,
): Pick<
  ScheduledMessage,
  'attachmentFile' | 'attachmentName' | 'attachmentMime' | 'attachmentBytes'
> {
  return {
    attachmentFile: a?.archivo ?? null,
    attachmentName: a?.nombre ?? null,
    attachmentMime: a?.mime ?? null,
    attachmentBytes: a?.bytes ?? null,
  };
}

/** Lo que hace falta para crear un mensaje. El resto lo completa el repositorio. */
export interface NewMessageInput {
  recipientKind?: RecipientKind;
  whatsappApp?: WhatsAppApp | null;
  contactName?: string | null;
  phoneE164: string;
  body: string;
  /** Hora de pared elegida, o null para dejarlo como borrador. */
  localAt?: string | null;
  timezone?: string;
  notes?: string | null;
  /** Regla de repetición, ej "FREQ=WEEKLY". Null para un mensaje único. */
  recurrenceRule?: string | null;
  /** Archivo ya copiado a la carpeta de la app. Ver `src/files/adjuntos.ts`. */
  adjunto?: Adjunto | null;
}

/**
 * Terminado desde el punto de vista de los datos. Para saber en qué lista va
 * un mensaje hay que mirar `estado.ts`: un enviado sigue a la vista un rato.
 */
export const isDone = (m: ScheduledMessage): boolean =>
  m.status === 'sent' || m.status === 'skipped';

/**
 * Mensajes que deberían tener un aviso agendado en el sistema ahora mismo.
 *
 * No es lo mismo que "pendiente": un mensaje ya disparado no tiene aviso
 * porque ya sonó, y uno cuya hora pasó tampoco, porque no se puede agendar
 * para el pasado. Comparar los pendientes contra lo que agendó el sistema
 * daría falsos negativos apenas suena el primer aviso.
 */
export const awaitsNotification = (
  m: ScheduledMessage,
  now: Date = new Date(),
): boolean =>
  m.status === 'scheduled' &&
  m.scheduledAt !== null &&
  new Date(m.scheduledAt).getTime() > now.getTime();
