import {
  contarPorEstado,
  enHistorial,
  enListaPrincipal,
  estadoDe,
  ETIQUETAS,
  requierenAtencion,
  VENTANA_ENVIADO_MINUTOS,
} from '../domain/estado';
import type { ScheduledMessage } from '../domain/types';

const BA = 'America/Argentina/Buenos_Aires';
/** Lunes 14/09/2026, 10:00 en Buenos Aires. */
const AHORA = new Date('2026-09-14T13:00:00.000Z');

const msg = (extra: Partial<ScheduledMessage> = {}): ScheduledMessage => ({
  id: 'm',
  recipientKind: 'contacto',
  contactName: null,
  phoneE164: '+5491123456789',
  body: 'hola',
  localAt: '2026-09-15T09:00',
  scheduledAt: '2026-09-15T12:00:00.000Z',
  timezone: BA,
  status: 'scheduled',
  createdAt: '2026-09-01T00:00:00.000Z',
  firedAt: null,
  sentAt: null,
  postponedAt: null,
  whatsappApp: null,
  recurrenceRule: null,
  notes: null,
  notificationId: null,
  ...extra,
});

describe('estadoDe', () => {
  it('programado: tiene fecha futura y nunca se corrió', () => {
    expect(estadoDe(msg(), AHORA)).toBe('programado');
  });

  it('postergado: futuro, pero ya se corrió una vez', () => {
    expect(estadoDe(msg({ postponedAt: '2026-09-14T12:00:00.000Z' }), AHORA)).toBe(
      'postergado',
    );
  });

  it('atrasado: la hora pasó y sigue esperando', () => {
    const viejo = msg({ localAt: '2026-09-13T09:00' });
    expect(estadoDe(viejo, AHORA)).toBe('atrasado');
  });

  it('un atrasado manda sobre el postergado: lo urgente es que ya pasó', () => {
    const viejo = msg({
      localAt: '2026-09-13T09:00',
      postponedAt: '2026-09-12T10:00:00.000Z',
    });
    expect(estadoDe(viejo, AHORA)).toBe('atrasado');
  });

  it('falta enviar: sonó el aviso y nadie confirmó', () => {
    expect(estadoDe(msg({ status: 'fired' }), AHORA)).toBe('falta-enviar');
  });

  it('enviado: se queda a la vista un rato', () => {
    const recien = msg({
      status: 'sent',
      sentAt: new Date(AHORA.getTime() - 10 * 60_000).toISOString(),
    });
    expect(estadoDe(recien, AHORA)).toBe('enviado');
  });

  it('pasada la hora, el enviado se va de la lista', () => {
    const viejo = msg({
      status: 'sent',
      sentAt: new Date(
        AHORA.getTime() - (VENTANA_ENVIADO_MINUTOS + 1) * 60_000,
      ).toISOString(),
    });
    expect(estadoDe(viejo, AHORA)).toBeNull();
  });

  it('los borradores y los descartados no llevan estado', () => {
    expect(estadoDe(msg({ status: 'draft', localAt: null }), AHORA)).toBeNull();
    expect(estadoDe(msg({ status: 'skipped' }), AHORA)).toBeNull();
  });

  it('todos los estados tienen etiqueta', () => {
    for (const etiqueta of Object.values(ETIQUETAS)) {
      expect(etiqueta.trim()).not.toBe('');
    }
  });
});

describe('en qué lista va', () => {
  it('un enviado reciente sigue en la principal y todavía no en el historial', () => {
    const recien = msg({
      status: 'sent',
      sentAt: new Date(AHORA.getTime() - 5 * 60_000).toISOString(),
    });
    expect(enListaPrincipal(recien, AHORA)).toBe(true);
    expect(enHistorial(recien, AHORA)).toBe(false);
  });

  it('pasada la ventana cambia de lado, sin quedar en las dos ni en ninguna', () => {
    const viejo = msg({
      status: 'sent',
      sentAt: new Date(
        AHORA.getTime() - (VENTANA_ENVIADO_MINUTOS + 1) * 60_000,
      ).toISOString(),
    });
    expect(enListaPrincipal(viejo, AHORA)).toBe(false);
    expect(enHistorial(viejo, AHORA)).toBe(true);
  });

  it('un descartado va derecho al historial', () => {
    expect(enHistorial(msg({ status: 'skipped' }), AHORA)).toBe(true);
  });

  it('un enviado sin fecha de envío no se queda pegado en la lista', () => {
    // Dato viejo o importado: sin sentAt no se puede saber si fue recién.
    const sinFecha = msg({ status: 'sent', sentAt: null });
    expect(enListaPrincipal(sinFecha, AHORA)).toBe(false);
    expect(enHistorial(sinFecha, AHORA)).toBe(true);
  });
});

describe('el resumen de arriba', () => {
  it('cuenta cada estado por separado', () => {
    const cuenta = contarPorEstado(
      [
        msg({ id: 'a' }),
        msg({ id: 'b', localAt: '2026-09-13T09:00' }),
        msg({ id: 'c', status: 'fired' }),
        msg({ id: 'd', postponedAt: '2026-09-14T11:00:00.000Z' }),
        msg({ id: 'e', status: 'draft', localAt: null }),
      ],
      AHORA,
    );
    expect(cuenta).toEqual({
      programado: 1,
      postergado: 1,
      atrasado: 1,
      'falta-enviar': 1,
      enviado: 0,
    });
  });

  it('lo que pide atención es lo atrasado y lo sin confirmar', () => {
    expect(
      requierenAtencion({
        programado: 5,
        postergado: 3,
        atrasado: 2,
        'falta-enviar': 1,
        enviado: 4,
      }),
    ).toBe(3);
  });
});
