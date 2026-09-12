import { describe, expect, it } from 'vitest';
import { escapeICS, foldLine, icsFileName, sessionToICS, toICSStamp } from './calendar';
import type { Session } from '../types';

const session: Session = {
  id: 's1',
  patientId: 'p1',
  date: '2026-03-10',
  time: '15:00',
  durationMin: 50,
  status: 'programada',
  fee: 500000,
  chargeable: true,
  notes: '',
};

const now = new Date(Date.UTC(2026, 2, 1, 12, 0, 0));

describe('escapeICS', () => {
  // String.raw evita la trampa de contar barras invertidas: en un literal
  // común '\;' colapsa a ';' y la expectativa quedaría escrita mal.
  it('escapa los caracteres con significado en el formato', () => {
    expect(escapeICS('a;b')).toBe(String.raw`a\;b`);
    expect(escapeICS('a,b')).toBe(String.raw`a\,b`);
    expect(escapeICS('a\nb')).toBe(String.raw`a\nb`);
  });

  it('escapa la barra invertida antes que el resto, sin duplicar', () => {
    expect(escapeICS(String.raw`a\b`)).toBe(String.raw`a\\b`);
    expect(escapeICS(String.raw`a\;b`)).toBe(String.raw`a\\\;b`);
  });

  it('deja el texto común intacto', () => {
    expect(escapeICS('Sesión con María')).toBe('Sesión con María');
  });
});

describe('toICSStamp', () => {
  it('produce una marca UTC con el formato exacto', () => {
    expect(toICSStamp(new Date(Date.UTC(2026, 2, 10, 18, 5, 7)))).toBe('20260310T180507Z');
  });

  it('rellena con ceros', () => {
    expect(toICSStamp(new Date(Date.UTC(2026, 0, 2, 3, 4, 5)))).toBe('20260102T030405Z');
  });
});

describe('foldLine', () => {
  it('deja las líneas cortas como están', () => {
    expect(foldLine('SUMMARY:corto')).toBe('SUMMARY:corto');
  });

  it('parte las líneas largas con continuación indentada', () => {
    const folded = foldLine(`DESCRIPTION:${'x'.repeat(200)}`);
    const parts = folded.split('\r\n');
    expect(parts.length).toBeGreaterThan(1);
    expect(parts[0]!.length).toBe(75);
    for (const part of parts.slice(1)) {
      expect(part.startsWith(' ')).toBe(true);
      expect(part.length).toBeLessThanOrEqual(75);
    }
  });

  it('no pierde contenido al partir', () => {
    const original = `DESCRIPTION:${'abc'.repeat(60)}`;
    expect(foldLine(original).split('\r\n').map((l, i) => (i === 0 ? l : l.slice(1))).join('')).toBe(original);
  });
});

describe('sessionToICS', () => {
  const ics = sessionToICS(session, { patientName: 'María Gómez', reminderMinutes: 30, now });

  it('arma un calendario con un evento completo', () => {
    expect(ics.startsWith('BEGIN:VCALENDAR')).toBe(true);
    expect(ics.trimEnd().endsWith('END:VCALENDAR')).toBe(true);
    expect(ics).toContain('BEGIN:VEVENT');
    expect(ics).toContain('SUMMARY:Sesión con María Gómez');
  });

  it('usa CRLF entre líneas, como exige el formato', () => {
    expect(ics).toContain('\r\n');
    expect(ics.split('\r\n').length).toBeGreaterThan(10);
  });

  it('incluye la alarma con los minutos pedidos', () => {
    expect(ics).toContain('BEGIN:VALARM');
    expect(ics).toContain('TRIGGER:-PT30M');
    expect(ics).toContain('ACTION:DISPLAY');
  });

  it('respeta la duración de la sesión entre inicio y fin', () => {
    const start = /DTSTART:(\d{8}T\d{6}Z)/.exec(ics)![1]!;
    const end = /DTEND:(\d{8}T\d{6}Z)/.exec(ics)![1]!;
    const parse = (v: string) =>
      Date.UTC(+v.slice(0, 4), +v.slice(4, 6) - 1, +v.slice(6, 8), +v.slice(9, 11), +v.slice(11, 13));
    expect((parse(end) - parse(start)) / 60000).toBe(50);
  });

  it('mantiene la hora local del turno al convertir a UTC', () => {
    // La marca UTC debe corresponder a las 15:00 locales del 10 de marzo.
    const esperado = new Date(2026, 2, 10, 15, 0, 0);
    expect(ics).toContain(`DTSTART:${toICSStamp(esperado)}`);
  });

  it('omite la descripción cuando no hay notas', () => {
    expect(ics).not.toContain('DESCRIPTION:\r\n');
    const conNotas = sessionToICS({ ...session, notes: 'Traer informe' }, { patientName: 'Ana', reminderMinutes: 0, now });
    expect(conNotas).toContain('DESCRIPTION:Traer informe');
  });

  it('acepta alarma en cero', () => {
    const ics0 = sessionToICS(session, { patientName: 'Ana', reminderMinutes: 0, now });
    expect(ics0).toContain('TRIGGER:-PT0M');
  });

  it('escapa el nombre del paciente', () => {
    const raro = sessionToICS(session, { patientName: 'Ariel C., Hospital; Italiano', reminderMinutes: 10, now });
    expect(raro).toContain(String.raw`SUMMARY:Sesión con Ariel C.\, Hospital\; Italiano`);
  });
});

describe('icsFileName', () => {
  it('arma un nombre de archivo seguro', () => {
    expect(icsFileName('María Gómez', '2026-03-10')).toBe('sesion-maria-gomez-2026-03-10.ics');
  });

  it('limpia acentos y símbolos', () => {
    expect(icsFileName('Ariel C. — Hospital Italiano', '2026-03-10')).toBe(
      'sesion-ariel-c-hospital-italiano-2026-03-10.ics',
    );
  });

  it('no queda vacío si el nombre no aporta letras', () => {
    expect(icsFileName('!!!', '2026-03-10')).toBe('sesion-paciente-2026-03-10.ics');
  });
});
