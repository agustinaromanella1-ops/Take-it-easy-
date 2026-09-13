import { BackupError, parseBackup, serializeBackup } from '../domain/backup';
import type { ScheduledMessage } from '../domain/types';

const message: ScheduledMessage = {
  id: 'm1',
  contactName: 'Sofi',
  phoneE164: '+5491123456789',
  body: 'hola',
  scheduledAt: '2026-09-14T12:00:00.000Z',
  localAt: '2026-09-14T09:00',
  timezone: 'America/Argentina/Buenos_Aires',
  status: 'scheduled',
  createdAt: '2026-09-01T00:00:00.000Z',
  firedAt: null,
  sentAt: null,
  recurrenceRule: null,
  notes: null,
  notificationId: 'n1',
};

const template = {
  id: 't1',
  name: 'Cumpleaños',
  body: 'Feliz cumple {nombre}',
  createdAt: '2026-09-01T00:00:00.000Z',
};

describe('backup', () => {
  it('hace ida y vuelta sin perder datos', () => {
    const parsed = parseBackup(serializeBackup([message], [template]));
    expect(parsed.messages).toEqual([message]);
    expect(parsed.templates).toEqual([template]);
  });

  it('rechaza un archivo que no es JSON', () => {
    expect(() => parseBackup('no soy json')).toThrow(BackupError);
  });

  it('rechaza un JSON que no es un backup', () => {
    expect(() => parseBackup('{"hola":1}')).toThrow(
      'El archivo no es un backup de esta app.',
    );
  });

  it('rechaza un backup de una versión más nueva', () => {
    expect(() =>
      parseBackup(JSON.stringify({ version: 99, messages: [], templates: [] })),
    ).toThrow(/versión más nueva/);
  });

  it('rechaza mensajes con forma inesperada', () => {
    expect(() =>
      parseBackup(
        JSON.stringify({ version: 1, messages: [{ id: 'x' }], templates: [] }),
      ),
    ).toThrow(/formato que no reconocemos/);
  });

  it('tolera un backup sin plantillas', () => {
    const parsed = parseBackup(JSON.stringify({ version: 1, messages: [] }));
    expect(parsed.templates).toEqual([]);
  });
});
