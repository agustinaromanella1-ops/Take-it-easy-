import { compromisoICS, exportarCSV, recordatorioICS, vencimientosICS } from './exportar';
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

describe('recordatorios', () => {
  it('todos los vencimientos en un solo archivo, sin importes por defecto', () => {
    const ics = vencimientosICS(
      [
        { clave: 'c:1', nombre: 'Luz', importe: 25_000_00, moneda: 'ARS', fecha: '2026-09-20', recurrente: true },
        { clave: 't:2:2026-10-05', nombre: 'Resumen de Visa', importe: 10_000_00, moneda: 'ARS', fecha: '2026-10-05', recurrente: false },
      ],
      { calendarioConDetalle: false, recordatorioMin: 1440 },
    );
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(2);
    expect(ics.match(/BEGIN:VCALENDAR/g)).toHaveLength(1);
    expect(ics).not.toContain('25.000');
    expect(ics.match(/RRULE/g)).toHaveLength(1);
  });

  it('la revisión semanal empieza el próximo día elegido, a la hora local', () => {
    // 15/9/2026 es martes; el próximo domingo es el 20.
    const ics = recordatorioICS({ titulo: 'Mirar Salchi', frecuencia: 'WEEKLY', dia: 0, hora: '19:30', desde: '2026-09-15', uid: 'r' });
    expect(ics).toContain('DTSTART:20260920T193000');
    expect(ics).toContain('RRULE:FREQ=WEEKLY;BYDAY=SU');
    expect(ics).not.toMatch(/DTSTART:.*Z/);
  });
});
