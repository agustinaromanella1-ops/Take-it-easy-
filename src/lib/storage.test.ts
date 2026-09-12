import { describe, expect, it } from 'vitest';
import { emptyData, parseAppData, SCHEMA_VERSION } from './storage';

describe('parseAppData', () => {
  it('devuelve datos vacíos ante basura', () => {
    expect(parseAppData(null)).toEqual(emptyData());
    expect(parseAppData('texto')).toEqual(emptyData());
    expect(parseAppData(42)).toEqual(emptyData());
    expect(parseAppData([])).toEqual(emptyData());
  });

  it('conserva los datos válidos', () => {
    const parsed = parseAppData({
      version: 1,
      patients: [
        { id: 'p1', name: 'Ana', email: 'a@b.com', phone: '123', defaultFee: 500000, status: 'activo', notes: '' },
      ],
      sessions: [
        {
          id: 's1',
          patientId: 'p1',
          date: '2026-03-10',
          time: '10:00',
          durationMin: 50,
          status: 'realizada',
          fee: 500000,
          chargeable: true,
          notes: '',
        },
      ],
      payments: [{ id: 'pay1', patientId: 'p1', date: '2026-03-10', amount: 500000, method: 'efectivo', notes: '' }],
      settings: { currency: 'US$', defaultDurationMin: 45, chargeNoShowByDefault: false },
    });
    expect(parsed.patients).toHaveLength(1);
    expect(parsed.sessions).toHaveLength(1);
    expect(parsed.payments).toHaveLength(1);
    expect(parsed.settings.currency).toBe('US$');
    expect(parsed.version).toBe(SCHEMA_VERSION);
  });

  it('descarta sesiones y pagos huérfanos', () => {
    const parsed = parseAppData({
      patients: [{ id: 'p1', name: 'Ana' }],
      sessions: [
        { id: 's1', patientId: 'p1', date: '2026-03-10', time: '10:00' },
        { id: 's2', patientId: 'borrado', date: '2026-03-10', time: '11:00' },
      ],
      payments: [
        { id: 'pay1', patientId: 'p1', date: '2026-03-10', amount: 100 },
        { id: 'pay2', patientId: 'borrado', date: '2026-03-10', amount: 100 },
      ],
    });
    expect(parsed.sessions.map((s) => s.id)).toEqual(['s1']);
    expect(parsed.payments.map((p) => p.id)).toEqual(['pay1']);
  });

  it('descarta registros con fecha u hora inválida', () => {
    const parsed = parseAppData({
      patients: [{ id: 'p1', name: 'Ana' }],
      sessions: [
        { id: 'ok', patientId: 'p1', date: '2026-03-10', time: '10:00' },
        { id: 'malaFecha', patientId: 'p1', date: '2026-02-30', time: '10:00' },
        { id: 'malaHora', patientId: 'p1', date: '2026-03-10', time: '25:00' },
      ],
    });
    expect(parsed.sessions.map((s) => s.id)).toEqual(['ok']);
  });

  it('descarta pacientes sin nombre o sin id', () => {
    const parsed = parseAppData({
      patients: [{ id: 'p1', name: 'Ana' }, { id: 'p2', name: '   ' }, { name: 'Sin id' }],
    });
    expect(parsed.patients.map((p) => p.id)).toEqual(['p1']);
  });

  it('rechaza pagos de importe cero o negativo', () => {
    const parsed = parseAppData({
      patients: [{ id: 'p1', name: 'Ana' }],
      payments: [
        { id: 'ok', patientId: 'p1', date: '2026-03-10', amount: 100 },
        { id: 'cero', patientId: 'p1', date: '2026-03-10', amount: 0 },
        { id: 'negativo', patientId: 'p1', date: '2026-03-10', amount: -500 },
      ],
    });
    expect(parsed.payments.map((p) => p.id)).toEqual(['ok']);
  });

  it('rellena los campos que faltan con valores por defecto sanos', () => {
    const parsed = parseAppData({ patients: [{ id: 'p1', name: 'Ana' }] });
    const p = parsed.patients[0]!;
    expect(p.status).toBe('activo');
    expect(p.defaultFee).toBe(0);
    expect(p.email).toBe('');
    expect(parsed.settings).toEqual(emptyData().settings);
  });

  it('normaliza montos decimales a entero y no admite negativos en honorarios', () => {
    const parsed = parseAppData({ patients: [{ id: 'p1', name: 'Ana', defaultFee: -300.7 }] });
    expect(parsed.patients[0]!.defaultFee).toBe(0);
  });

  it('corrige estados desconocidos a un valor seguro', () => {
    const parsed = parseAppData({
      patients: [{ id: 'p1', name: 'Ana', status: 'vip' }],
      sessions: [{ id: 's1', patientId: 'p1', date: '2026-03-10', time: '10:00', status: 'inventado' }],
      payments: [{ id: 'pay1', patientId: 'p1', date: '2026-03-10', amount: 100, method: 'cripto' }],
    });
    expect(parsed.patients[0]!.status).toBe('activo');
    expect(parsed.sessions[0]!.status).toBe('programada');
    expect(parsed.payments[0]!.method).toBe('efectivo');
  });
});
