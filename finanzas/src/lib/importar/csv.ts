import type { Cents, DateISO, Moneda, Movimiento } from '../../types';
import { isValidISODate } from '../dates';
import { parseMoney } from '../money';
import { normalizar, posiblesDuplicados } from '../finanzas/duplicados';
import { categoriaPara } from '../texto/categorias';

/**
 * Importar movimientos de un archivo CSV del banco o la billetera.
 *
 * Cada banco exporta distinto: separador, orden de columnas, fechas, una
 * columna de importe con signo o dos columnas (débito y crédito). Por eso se
 * adivina lo que se puede y la persona confirma las columnas antes de
 * importar. La columna de saldo nunca se usa como importe.
 *
 * Nada se importa sin revisión: todo entra marcado "para revisar", con su
 * origen anotado, y lo que parece repetido viene destildado.
 */

/**
 * Pasa los bytes del archivo a texto. Muchos bancos exportan en Windows-1252
 * (latin1) y no en UTF-8: leído como UTF-8, "Débito" sale "D�bito" y la
 * columna no se reconoce. Se prueba UTF-8 estricto y, si falla, latin1.
 */
export function decodificar(bytes: ArrayBuffer): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder('windows-1252').decode(bytes);
  }
}

/** Separa un CSV en filas y celdas, respetando comillas. Detecta `;`, `,` o tabulador. */
export function leerCSV(texto: string): string[][] {
  const limpio = texto.replace(/^﻿/, '');
  const primera = limpio.split(/\r?\n/).find((l) => l.trim() !== '') ?? '';
  const candidatos = [';', ',', '\t'];
  const sep = candidatos.reduce((mejor, c) => (contar(primera, c) > contar(primera, mejor) ? c : mejor), ';');

  const filas: string[][] = [];
  let fila: string[] = [];
  let celda = '';
  let comillas = false;
  for (let i = 0; i < limpio.length; i++) {
    const ch = limpio[i];
    if (comillas) {
      if (ch === '"' && limpio[i + 1] === '"') {
        celda += '"';
        i++;
      } else if (ch === '"') comillas = false;
      else celda += ch;
    } else if (ch === '"') comillas = true;
    else if (ch === sep) {
      fila.push(celda.trim());
      celda = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && limpio[i + 1] === '\n') i++;
      fila.push(celda.trim());
      if (fila.some((c) => c !== '')) filas.push(fila);
      fila = [];
      celda = '';
    } else celda += ch;
  }
  fila.push(celda.trim());
  if (fila.some((c) => c !== '')) filas.push(fila);
  return filas;
}

function contar(s: string, c: string): number {
  // No cuenta lo que está entre comillas: "1.234,56" no tiene una coma separadora.
  return s.replace(/"[^"]*"/g, '').split(c).length - 1;
}

export interface Columnas {
  fecha: number;
  descripcion: number;
  /** Importe con signo. -1 si el banco usa débito y crédito por separado. */
  importe: number;
  debito: number;
  credito: number;
  /** La fila de títulos, si hay; se saltea al importar. */
  conTitulos: boolean;
}

const NOMBRES = {
  fecha: ['fecha', 'fecha operacion', 'fecha de operacion', 'fecha movimiento', 'date', 'dia', 'fecha valor'],
  descripcion: ['descripcion', 'concepto', 'detalle', 'movimiento', 'comercio', 'description', 'referencia', 'leyenda'],
  importe: ['importe', 'monto', 'amount', 'valor', 'importe en pesos', 'monto ars'],
  debito: ['debito', 'debitos', 'debe', 'egreso', 'egresos', 'salida', 'cargo'],
  credito: ['credito', 'creditos', 'haber', 'ingreso', 'ingresos', 'entrada', 'abono'],
};

/** Adivina las columnas por los títulos, o por el contenido si no hay títulos. */
export function adivinarColumnas(filas: string[][]): Columnas {
  const titulos = (filas[0] ?? []).map(normalizar);
  const buscar = (lista: string[]) => titulos.findIndex((t) => lista.includes(t) || lista.some((n) => t.startsWith(`${n} `)));
  const col: Columnas = {
    fecha: buscar(NOMBRES.fecha),
    descripcion: buscar(NOMBRES.descripcion),
    importe: buscar(NOMBRES.importe),
    debito: buscar(NOMBRES.debito),
    credito: buscar(NOMBRES.credito),
    conTitulos: false,
  };
  col.conTitulos = col.fecha !== -1 || col.descripcion !== -1 || col.importe !== -1 || col.debito !== -1;
  if (col.conTitulos) return col;

  // Sin títulos: la primera columna con fechas, la primera con importes y la
  // más larga de texto.
  const muestra = filas.slice(0, 5);
  const ancho = Math.max(0, ...muestra.map((f) => f.length));
  for (let i = 0; i < ancho; i++) {
    const valores = muestra.map((f) => f[i] ?? '');
    if (col.fecha === -1 && valores.every((v) => leerFecha(v) !== null)) col.fecha = i;
    else if (col.importe === -1 && valores.every((v) => v !== '' && parseMoney(v) !== null)) col.importe = i;
  }
  let largo = -1;
  for (let i = 0; i < ancho; i++) {
    if (i === col.fecha || i === col.importe) continue;
    const promedio = muestra.reduce((s, f) => s + (f[i]?.length ?? 0), 0);
    if (promedio > largo) {
      largo = promedio;
      col.descripcion = i;
    }
  }
  return col;
}

/** dd/mm/aaaa, dd-mm-aa, aaaa-mm-dd. */
export function leerFecha(v: string): DateISO | null {
  const t = v.trim().slice(0, 10);
  let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
  if (m) return isValidISODate(t) ? t : null;
  m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/.exec(t);
  if (!m) return null;
  const anio = (m[3] ?? '').length === 2 ? `20${m[3]}` : m[3];
  const iso = `${anio}-${(m[2] ?? '').padStart(2, '0')}-${(m[1] ?? '').padStart(2, '0')}`;
  return isValidISODate(iso) ? iso : null;
}

export interface FilaImportada {
  indice: number;
  fecha: DateISO;
  descripcion: string;
  /** Con signo: negativo es plata que salió. */
  importe: Cents;
  categoria: string;
  /** Movimientos ya anotados que se le parecen. */
  duplicados: Movimiento[];
  /** Parece una transferencia: puede ser entre cuentas propias. */
  pareceTransferencia: boolean;
}

export interface ResultadoImportacion {
  filas: FilaImportada[];
  omitidas: { indice: number; motivo: string }[];
}

export function convertir(filas: string[][], col: Columnas, existentes: readonly Movimiento[], moneda: Moneda = 'ARS'): ResultadoImportacion {
  const res: ResultadoImportacion = { filas: [], omitidas: [] };
  filas.forEach((f, indice) => {
    if (indice === 0 && col.conTitulos) return;
    const fecha = leerFecha(f[col.fecha] ?? '');
    if (!fecha) {
      res.omitidas.push({ indice, motivo: 'sin fecha válida' });
      return;
    }
    let importe: Cents | null = null;
    if (col.importe !== -1) {
      importe = parseMoney(f[col.importe] ?? '');
    } else {
      const deb = parseMoney(f[col.debito] ?? '') ?? 0;
      const cre = parseMoney(f[col.credito] ?? '') ?? 0;
      importe = cre - Math.abs(deb);
    }
    if (importe === null || importe === 0) {
      res.omitidas.push({ indice, motivo: 'sin importe' });
      return;
    }
    const descripcion = (f[col.descripcion] ?? '').replace(/\s+/g, ' ').trim().slice(0, 60);
    const tipo = importe < 0 ? 'gasto' : 'ingreso';
    res.filas.push({
      indice,
      fecha,
      descripcion,
      importe,
      categoria: tipo === 'gasto' ? categoriaPara(descripcion) : '',
      duplicados: posiblesDuplicados({ tipo, importe: Math.abs(importe), moneda, fecha, comercio: descripcion }, existentes),
      pareceTransferencia: /transf|cvu|cbu|entre cuentas|debin/.test(normalizar(descripcion)),
    });
  });
  return res;
}
