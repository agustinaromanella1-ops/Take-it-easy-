import type { AppData, PaymentMethod, Session } from '../types';

/**
 * Planillas para abrir en Excel.
 *
 * Tres detalles que deciden si el archivo se abre bien o queda ilegible, y que
 * son la razón de que esto no sea un `join(',')`:
 *
 * - **Separador `;`**. Excel en español espera punto y coma. Con comas mete
 *   todas las columnas en una sola y la planilla no sirve para nada.
 * - **Decimales con coma**. 35000,50 y no 35000.50, que es lo que Excel en
 *   español entiende como número. Si no, lo toma como texto y no suma.
 * - **BOM al principio**. Sin esas tres letras invisibles, Excel lee el
 *   archivo como Latin-1 y los acentos salen rotos: "sesión" se convierte en
 *   "sesiÃ³n".
 *
 * Las fechas van con el año completo aunque en pantalla se muestren sin él:
 * una planilla se guarda, se junta con la del año pasado y se mira en enero.
 */
const BOM = '﻿';
const SEP = ';';

/**
 * Un texto que Excel va a tomar como fórmula en vez de como texto.
 *
 * Una nota que arranca con `=`, `+`, `@`, un tabulador o un retorno de carro se
 * ejecuta al abrir la planilla: `=1+1` muestra 2, y hay fórmulas que llegan a
 * abrir otros archivos. El `-` también encabeza fórmulas, pero es además el
 * signo de los importes negativos, así que solo se considera peligroso cuando
 * lo que sigue no es un número (`-35000,50` es una cifra, `-1+1` no).
 */
function pareceFormula(s: string): boolean {
  if (s === '') return false;
  if (/^[=+@\t\r]/.test(s)) return true;
  return s.startsWith('-') && !/^-\d+(,\d+)?$/.test(s);
}

/** Un valor listo para meter en una celda, con las comillas que haga falta. */
function celda(valor: string | number): string {
  let s = String(valor);
  // El apóstrofo al principio es la marca de "esto es texto" de Excel: sin él,
  // una nota del paciente se evalúa como fórmula al abrir el archivo.
  if (pareceFormula(s)) s = `'${s}`;
  // Comillas dobles adentro se escriben duplicadas, y el campo entero va entre
  // comillas si trae el separador, comillas o un salto de línea.
  if (/[";\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** Centavos -> "35000,50", que es lo que Excel en español suma. */
export function importeCSV(centavos: number): string {
  const negativo = centavos < 0;
  const abs = Math.abs(Math.round(centavos));
  return `${negativo ? '-' : ''}${Math.floor(abs / 100)},${(abs % 100).toString().padStart(2, '0')}`;
}

function armar(encabezados: string[], filas: (string | number)[][]): string {
  const lineas = [encabezados, ...filas].map((f) => f.map(celda).join(SEP));
  // \r\n es lo que espera Excel; con \n solo, algunas versiones juntan filas.
  return BOM + lineas.join('\r\n') + '\r\n';
}

/** "2026-09-17" -> "17/09/2026". Sin tocar zonas horarias: es partir un texto. */
function fechaCSV(iso: string): string {
  const [a, m, d] = iso.split('-');
  return `${d}/${m}/${a}`;
}

const MEDIO: Record<PaymentMethod, string> = {
  efectivo: 'Efectivo',
  transferencia: 'Transferencia',
  tarjeta: 'Tarjeta',
  otro: 'Otro',
};

const ESTADO: Record<Session['status'], string> = {
  programada: 'Programada',
  realizada: 'Realizada',
  ausente: 'Ausente',
  cancelada: 'Cancelada',
};

/** Una fila por sesión: es la planilla del trabajo hecho. */
export function sesionesCSV(data: AppData): string {
  const porId = new Map(data.patients.map((p) => [p.id, p]));
  const filas = [...data.sessions]
    .sort((a, b) => (a.date === b.date ? a.time.localeCompare(b.time) : a.date.localeCompare(b.date)))
    .map((s) => [
      fechaCSV(s.date),
      s.time,
      porId.get(s.patientId)?.name ?? 'Paciente borrado',
      ESTADO[s.status],
      importeCSV(s.fee),
      s.notes ?? '',
    ]);
  return armar(['Fecha', 'Hora', 'Paciente', 'Estado', 'Honorario', 'Notas'], filas);
}

/** Una fila por cobro: es la planilla de la plata que entró. */
export function cobrosCSV(data: AppData): string {
  const porId = new Map(data.patients.map((p) => [p.id, p]));
  const filas = [...data.payments]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((p) => [
      fechaCSV(p.date),
      porId.get(p.patientId)?.name ?? 'Paciente borrado',
      importeCSV(p.amount),
      MEDIO[p.method] ?? p.method,
      p.notes ?? '',
    ]);
  return armar(['Fecha', 'Paciente', 'Importe', 'Medio', 'Notas'], filas);
}
