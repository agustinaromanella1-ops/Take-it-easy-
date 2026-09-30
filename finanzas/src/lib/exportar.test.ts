import { compromisoICS, exportarCSV } from './exportar';
import { compromiso, cuenta, datos, movimiento } from './fabrica';

describe('calendario', () => {
  const k = compromiso({ nombre: 'Luz; gas, agua', importe: 25_000_00, vencimiento: '2026-09-20', recurrencia: 'mensual' });

  it('por defecto no dice qué ni cuánto: no se lee en la pantalla bloqueada', () => {
    const ics = compromisoICS(k, { calendarioConDetalle: false, recordatorioMin: 1440 }, 'x');
    expect(ics).toContain('SUMMARY:Vence un pago');
    expect(ics).not.toContain('25.000');
    expect(ics).toContain('TRIGGER:-PT1440M');
    expect(ics).toContain('DTSTART;VALUE=DATE:20260920');
    expect(ics).toContain('RRULE:FREQ=MONTHLY');
  });

  it('con detalle, escapa punto y coma y comas', () => {
    const ics = compromisoICS(k, { calendarioConDetalle: true, recordatorioMin: 0 }, 'x');
    expect(ics).toContain(String.raw`SUMMARY:Vence Luz\; gas\, agua ($ 25.000)`);
  });
});

describe('planilla', () => {
  it('signo por tipo, coma decimal y sin fórmulas ejecutables', () => {
    const c = cuenta({ nombre: 'Banco' });
    const csv = exportarCSV(datos({ cuentas: [c], movimientos: [movimiento({ cuentaId: c.id, importe: 8_500_50, comercio: '=HYPERLINK("x")' })] }));
    expect(csv).toContain('-8500,50');
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`);
  });
});
