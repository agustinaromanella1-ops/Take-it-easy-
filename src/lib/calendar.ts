import type { Session } from '../types';
import { fromISODate, timeToMinutes } from './dates';

/**
 * Genera un archivo .ics (iCalendar) para mandar un turno al calendario del
 * teléfono, con alarma. Es el formato que entienden tanto iOS como Android, y a
 * diferencia de una notificación web sigue avisando con la app cerrada.
 */

/** Escapa los caracteres con significado especial en iCalendar (RFC 5545). */
export function escapeICS(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/** Fecha local -> marca UTC "YYYYMMDDTHHMMSSZ", como exige el formato. */
export function toICSStamp(date: Date): string {
  const p = (n: number, len = 2) => n.toString().padStart(len, '0');
  return (
    `${p(date.getUTCFullYear(), 4)}${p(date.getUTCMonth() + 1)}${p(date.getUTCDate())}` +
    `T${p(date.getUTCHours())}${p(date.getUTCMinutes())}${p(date.getUTCSeconds())}Z`
  );
}

/**
 * Las líneas de iCalendar no pueden pasar de 75 octetos: las largas se parten
 * y las continuaciones arrancan con un espacio. Sin esto, una nota larga rompe
 * el archivo en algunos calendarios.
 */
export function foldLine(line: string): string {
  if (line.length <= 75) return line;
  const parts: string[] = [line.slice(0, 75)];
  let rest = line.slice(75);
  while (rest.length > 74) {
    parts.push(` ${rest.slice(0, 74)}`);
    rest = rest.slice(74);
  }
  if (rest.length > 0) parts.push(` ${rest}`);
  return parts.join('\r\n');
}

export interface ICSOptions {
  patientName: string;
  /** Minutos de antelación de la alarma. Cero significa aviso a la hora exacta. */
  reminderMinutes: number;
  /** Fecha de generación. Parametrizable para que los tests sean deterministas. */
  now?: Date;
}

export function sessionToICS(session: Session, options: ICSOptions): string {
  const { patientName, reminderMinutes, now = new Date() } = options;

  const startDate = fromISODate(session.date);
  startDate.setMinutes(timeToMinutes(session.time));
  const endDate = new Date(startDate.getTime() + session.durationMin * 60_000);

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Pipi Cucu//ES',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${session.id}@pipicucu`,
    `DTSTAMP:${toICSStamp(now)}`,
    `DTSTART:${toICSStamp(startDate)}`,
    `DTEND:${toICSStamp(endDate)}`,
    `SUMMARY:${escapeICS(`Sesión con ${patientName}`)}`,
    ...(session.notes.trim() === '' ? [] : [`DESCRIPTION:${escapeICS(session.notes.trim())}`]),
    'BEGIN:VALARM',
    `TRIGGER:-PT${Math.max(0, Math.round(reminderMinutes))}M`,
    'ACTION:DISPLAY',
    `DESCRIPTION:${escapeICS(`Sesión con ${patientName}`)}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ];

  // CRLF entre líneas es obligatorio en el formato, no una preferencia de estilo.
  return lines.map(foldLine).join('\r\n');
}

/** Nombre de archivo seguro en cualquier sistema. */
export function icsFileName(patientName: string, date: string): string {
  const slug = patientName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    .slice(0, 40);
  return `sesion-${slug || 'paciente'}-${date}.ics`;
}
