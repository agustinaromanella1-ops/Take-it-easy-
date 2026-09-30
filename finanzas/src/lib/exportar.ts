import type { AppData, Compromiso, Cuenta, Preferencias } from '../types';
import { formatMoney } from './money';
import { addDays } from './dates';

/** Descarga un archivo generado en el momento. No sale nada del dispositivo: se guarda en él. */
export function descargar(nombre: string, contenido: string, tipo: string): void {
  const blob = new Blob([contenido], { type: tipo });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportarJSON(data: AppData): string {
  return JSON.stringify(data, null, 2);
}

function celda(v: string): string {
  // Una celda que empieza con =, +, - o @ se ejecuta como fórmula al abrirla
  // en una planilla: se antepone un apóstrofo.
  const seguro = /^[=+\-@]/.test(v) ? `'${v}` : v;
  return /[",;\n]/.test(seguro) ? `"${seguro.replace(/"/g, '""')}"` : seguro;
}

const TIPOS: Record<string, string> = {
  gasto: 'Gasto',
  ingreso: 'Ingreso',
  transferencia: 'Entre mis cuentas',
  devolucion: 'Devolución',
  'pago-tarjeta': 'Pago de tarjeta',
  ajuste: 'Diferencia sin conciliar',
};

/** CSV de movimientos, con punto y coma: es lo que espera una planilla en castellano. */
export function exportarCSV(data: AppData): string {
  const nombre = new Map<string, string>(data.cuentas.map((c: Cuenta) => [c.id, c.nombre]));
  const filas = [['Fecha', 'Tipo', 'Importe', 'Moneda', 'Cuenta', 'Cuenta destino', 'Comercio', 'Categoría', 'Cuotas', 'Nota']];
  const movs = [...data.movimientos].sort((a, b) => (a.fecha < b.fecha ? -1 : 1));
  for (const m of movs) {
    const signo = m.tipo === 'gasto' || m.tipo === 'pago-tarjeta' ? -1 : 1;
    const centavos = m.tipo === 'ajuste' ? m.importe : signo * m.importe;
    filas.push([
      m.fecha,
      TIPOS[m.tipo] ?? m.tipo,
      (centavos / 100).toFixed(2).replace('.', ','),
      m.moneda,
      m.cuentaId ? nombre.get(m.cuentaId) ?? '' : 'Sin cuenta',
      m.cuentaDestinoId ? nombre.get(m.cuentaDestinoId) ?? '' : '',
      m.comercio,
      m.categoria,
      String(m.cuotas),
      m.nota,
    ]);
  }
  return '\uFEFF' + filas.map((f) => f.map(celda).join(';')).join('\r\n');
}

/** Escapa texto para ICS. Ojo: en JavaScript '\;' es ';', por eso va '\;'. */
function textoICS(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

/**
 * Un vencimiento como evento de calendario, con su recordatorio.
 *
 * Es lo que avisa con la app cerrada: el calendario del teléfono sí suena.
 * Por defecto el texto no dice qué ni cuánto ("Vence un pago"), para que no
 * se lea en la pantalla bloqueada.
 */
export function compromisoICS(k: Compromiso, prefs: Pick<Preferencias, 'calendarioConDetalle' | 'recordatorioMin'>, uid: string): string {
  const dia = k.vencimiento.replace(/-/g, '');
  const siguiente = addDays(k.vencimiento, 1).replace(/-/g, '');
  const titulo = prefs.calendarioConDetalle
    ? `Vence ${k.nombre}${k.importe !== null ? ` (${formatMoney(k.importe, k.moneda)})` : ''}`
    : 'Vence un pago';
  const sello = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const lineas = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Salchi//ES',
    'BEGIN:VEVENT',
    `UID:${uid}@salchi`,
    `DTSTAMP:${sello}`,
    `DTSTART;VALUE=DATE:${dia}`,
    `DTEND;VALUE=DATE:${siguiente}`,
    `SUMMARY:${textoICS(titulo)}`,
    k.recurrencia === 'mensual' ? 'RRULE:FREQ=MONTHLY' : '',
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${textoICS(titulo)}`,
    // Un evento de día entero empieza a las 0: el recordatorio se cuenta desde ahí.
    `TRIGGER:-PT${Math.max(0, prefs.recordatorioMin)}M`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter((l) => l !== '');
  return lineas.join('\r\n');
}
