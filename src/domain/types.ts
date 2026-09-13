/** Estados por los que pasa un mensaje. Ver README para el diagrama de transiciones. */
export type MessageStatus =
  | 'draft' // escrito, todavía sin fecha
  | 'scheduled' // con fecha, esperando la hora
  | 'fired' // sonó la notificación, falta confirmar
  | 'sent' // confirmado como enviado
  | 'skipped'; // la usuaria decidió no mandarlo

export interface ScheduledMessage {
  id: string;
  contactName: string | null;
  /** Siempre en E.164, ej "+5491112345678". */
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
  recurrenceRule: string | null;
  notes: string | null;
  /** Id de la notificación local agendada, para poder cancelarla. */
  notificationId: string | null;
}

/** Lo que hace falta para crear un mensaje. El resto lo completa el repositorio. */
export interface NewMessageInput {
  contactName?: string | null;
  phoneE164: string;
  body: string;
  /** Hora de pared elegida, o null para dejarlo como borrador. */
  localAt?: string | null;
  timezone?: string;
  notes?: string | null;
}

export const isPending = (m: ScheduledMessage): boolean =>
  m.status === 'scheduled' || m.status === 'fired';

export const isDone = (m: ScheduledMessage): boolean =>
  m.status === 'sent' || m.status === 'skipped';
