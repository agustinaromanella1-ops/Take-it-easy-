import {
  dayLabel,
  groupByDay,
  pendingCountLabel,
  previewLines,
  timeLabel,
} from '../domain/grouping';
import { awaitsNotification, type ScheduledMessage } from '../domain/types';

const BA = 'America/Argentina/Buenos_Aires';
/** Lunes 14/09/2026, 10:00 en Buenos Aires. */
const NOW = new Date('2026-09-14T13:00:00.000Z');

const message = (
  id: string,
  localAt: string | null,
  overrides: Partial<ScheduledMessage> = {},
): ScheduledMessage => ({
  id,
  recipientKind: 'contacto',
  contactName: null,
  phoneE164: '+5491123456789',
  body: 'hola',
  localAt,
  scheduledAt: localAt ? `${localAt}:00.000Z` : null,
  timezone: BA,
  status: 'scheduled',
  createdAt: '2026-09-01T00:00:00.000Z',
  firedAt: null,
  sentAt: null,
  recurrenceRule: null,
  notes: null,
  notificationId: null,
  ...overrides,
});

describe('dayLabel', () => {
  it('usa palabras para hoy y mañana', () => {
    expect(dayLabel('2026-09-14T18:00', BA, NOW)).toBe('Hoy');
    expect(dayLabel('2026-09-15T09:00', BA, NOW)).toBe('Mañana');
  });

  it('usa día de la semana dentro de la semana', () => {
    expect(dayLabel('2026-09-18T09:00', BA, NOW)).toBe('Viernes 18');
  });

  it('agrega el mes cuando está más lejos', () => {
    expect(dayLabel('2026-12-24T21:00', BA, NOW)).toBe('Jueves 24 de diciembre');
  });
});

describe('timeLabel', () => {
  it('muestra la hora en formato 24 h', () => {
    expect(timeLabel('2026-09-14T09:05')).toBe('09:05');
  });
});

describe('groupByDay', () => {
  it('ordena del más próximo al más lejano y agrupa por día', () => {
    const sections = groupByDay(
      [
        message('c', '2026-09-18T10:00'),
        message('a', '2026-09-14T18:00'),
        message('b', '2026-09-15T09:00'),
        message('d', '2026-09-15T20:00'),
      ],
      BA,
      NOW,
    );

    expect(sections.map((s) => s.title)).toEqual([
      'Hoy',
      'Mañana',
      'Viernes 18',
    ]);
    expect(sections[1]?.data.map((m) => m.id)).toEqual(['b', 'd']);
  });

  it('pone los atrasados arriba de todo y los marca', () => {
    const sections = groupByDay(
      [message('futuro', '2026-09-15T09:00'), message('viejo', '2026-09-13T09:00')],
      BA,
      NOW,
    );

    expect(sections[0]?.key).toBe('overdue');
    expect(sections[0]?.overdue).toBe(true);
    expect(sections[0]?.data.map((m) => m.id)).toEqual(['viejo']);
  });

  it('ignora los que no tienen fecha', () => {
    const sections = groupByDay([message('borrador', null)], BA, NOW);
    expect(sections).toHaveLength(0);
  });
});

describe('pendingCountLabel', () => {
  it('conjuga según la cantidad', () => {
    expect(pendingCountLabel(0)).toBe('Nada programado');
    expect(pendingCountLabel(1)).toBe('1 mensaje programado');
    expect(pendingCountLabel(7)).toBe('7 mensajes programados');
  });
});

describe('previewLines', () => {
  it('devuelve como mucho dos líneas con contenido', () => {
    expect(previewLines('uno\n\ndos\ntres')).toBe('uno\ndos');
  });
});

describe('awaitsNotification', () => {
  const ahora = NOW;

  it('cuenta un programado a futuro', () => {
    const m = message('a', '2026-09-20T09:00');
    expect(awaitsNotification({ ...m, scheduledAt: '2026-09-20T12:00:00.000Z' }, ahora)).toBe(true);
  });

  it('no cuenta uno cuya hora ya pasó: no se puede agendar para atrás', () => {
    const m = message('b', '2026-09-13T09:00');
    expect(awaitsNotification({ ...m, scheduledAt: '2026-09-13T12:00:00.000Z' }, ahora)).toBe(false);
  });

  it('no cuenta uno ya disparado: su aviso ya sonó', () => {
    const m = message('c', '2026-09-20T09:00', { status: 'fired' });
    expect(awaitsNotification({ ...m, scheduledAt: '2026-09-20T12:00:00.000Z' }, ahora)).toBe(false);
  });

  it('no cuenta borradores ni cerrados', () => {
    expect(awaitsNotification(message('d', null, { status: 'draft' }), ahora)).toBe(false);
    const enviado = message('e', '2026-09-20T09:00', { status: 'sent' });
    expect(awaitsNotification({ ...enviado, scheduledAt: '2026-09-20T12:00:00.000Z' }, ahora)).toBe(false);
  });
});
