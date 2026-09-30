import type {
  AccionHuellita,
  Aporte,
  AppData,
  Borrados,
  Companero,
  Compromiso,
  Cuenta,
  Huellitas,
  IngresoEsperado,
  Lapida,
  Meta,
  Moneda,
  Movimiento,
  OrigenMovimiento,
  Periodo,
  Preferencias,
  Recurrencia,
  TipoCuenta,
  TipoMovimiento,
  Trato,
} from '../types';
import { COLECCIONES } from '../types';
import { isValidISODate } from './dates';
import { fusionar } from './fusion';

export const STORAGE_KEY = 'salchi:datos';
export const SCHEMA_VERSION = 1;

const EPOCA = '1970-01-01T00:00:00.000Z';

export function preferenciasPorDefecto(): Preferencias {
  return {
    onboardingHecho: false,
    companero: 'visible',
    celebraciones: true,
    hormiga: true,
    bajaEnergia: false,
    trato: 'neutro',
    periodo: 'proximo-ingreso',
    calendarioConDetalle: false,
    recordatorioMin: 24 * 60,
    voz: false,
    gastoVariable: null,
    updatedAt: EPOCA,
  };
}

export function huellitasVacias(): Huellitas {
  return { almohadillas: 0, hoy: { fecha: '', acciones: [], completas: 0 }, totalCompletas: 0, trucos: [], updatedAt: EPOCA };
}

function borradosVacios(): Borrados {
  return { cuentas: [], movimientos: [], compromisos: [], ingresos: [], metas: [], aportes: [] };
}

export function emptyData(): AppData {
  return {
    version: SCHEMA_VERSION,
    cuentas: [],
    movimientos: [],
    compromisos: [],
    ingresos: [],
    metas: [],
    aportes: [],
    deleted: borradosVacios(),
    preferencias: preferenciasPorDefecto(),
    huellitas: huellitasVacias(),
  };
}

/*
 * Validación campo por campo.
 *
 * Lo que vuelve de localStorage (o de una copia importada) no es de fiar: puede
 * venir de una versión vieja, de un archivo editado a mano o de un navegador
 * que lo cortó a la mitad. Un registro al que le falta algo esencial se
 * descarta; un campo opcional roto toma su valor por defecto. Nunca un
 * `as AppData` a ciegas.
 */

type Crudo = Record<string, unknown>;
const esObjeto = (x: unknown): x is Crudo => typeof x === 'object' && x !== null && !Array.isArray(x);
const texto = (x: unknown, def = ''): string => (typeof x === 'string' ? x : def);
const bool = (x: unknown, def: boolean): boolean => (typeof x === 'boolean' ? x : def);
const entero = (x: unknown): number | null => (typeof x === 'number' && Number.isSafeInteger(x) ? x : null);
const fecha = (x: unknown): string | null => (typeof x === 'string' && isValidISODate(x) ? x : null);
const sello = (x: unknown): string => (typeof x === 'string' && !Number.isNaN(Date.parse(x)) ? x : EPOCA);
const unoDe = <T extends string>(x: unknown, opciones: readonly T[], def: T): T =>
  typeof x === 'string' && (opciones as readonly string[]).includes(x) ? (x as T) : def;
const moneda = (x: unknown): Moneda | null => (x === 'ARS' || x === 'USD' ? x : null);
const idNulo = (x: unknown): string | null => (typeof x === 'string' && x !== '' ? x : null);
const dia = (x: unknown): number | null => {
  const n = entero(x);
  return n !== null && n >= 1 && n <= 31 ? n : null;
};

const TIPOS_CUENTA: readonly TipoCuenta[] = ['efectivo', 'banco', 'billetera', 'tarjeta-credito', 'prestamo'];
const TIPOS_MOV: readonly TipoMovimiento[] = ['gasto', 'ingreso', 'transferencia', 'devolucion', 'pago-tarjeta', 'ajuste'];
const ORIGENES: readonly OrigenMovimiento[] = ['manual', 'texto', 'comprobante', 'ajuste', 'importado', 'resumen'];
const RECURRENCIAS: readonly Recurrencia[] = ['ninguna', 'mensual'];
const ACCIONES: readonly AccionHuellita[] = [
  'revisar-movimientos', 'confirmar-compromiso', 'actualizar-saldo', 'anotar', 'retomar', 'comprobante',
];

function parseCuenta(r: unknown): Cuenta | null {
  if (!esObjeto(r)) return null;
  const id = idNulo(r.id);
  const m = moneda(r.moneda);
  const saldoInicial = entero(r.saldoInicial);
  const fechaSaldo = fecha(r.fechaSaldo);
  if (!id || !m || saldoInicial === null || !fechaSaldo) return null;
  const tipo = unoDe(r.tipo, TIPOS_CUENTA, 'banco');
  return {
    id,
    updatedAt: sello(r.updatedAt),
    nombre: texto(r.nombre, 'Cuenta'),
    tipo,
    moneda: m,
    saldoInicial,
    fechaSaldo,
    aproximado: bool(r.aproximado, false),
    cuentaParaDisponible: tipo === 'tarjeta-credito' || tipo === 'prestamo' ? false : bool(r.cuentaParaDisponible, true),
    confirmadoEn: fecha(r.confirmadoEn) ?? fechaSaldo,
    alias: Array.isArray(r.alias) ? r.alias.filter((a): a is string => typeof a === 'string') : [],
    diaCierre: dia(r.diaCierre),
    diaVencimiento: dia(r.diaVencimiento),
    cuotaMensual: importeNulo(r.cuotaMensual),
    cuotasRestantes: (() => {
      const n = entero(r.cuotasRestantes);
      return n !== null && n >= 0 && n <= 600 ? n : null;
    })(),
    tasaAnual: (() => {
      const n = entero(r.tasaAnual);
      return n !== null && n >= 0 && n <= 100_000 ? n : null;
    })(),
    archivada: bool(r.archivada, false),
  };
}

function parseMovimiento(r: unknown): Movimiento | null {
  if (!esObjeto(r)) return null;
  const id = idNulo(r.id);
  const m = moneda(r.moneda);
  const importe = entero(r.importe);
  const f = fecha(r.fecha);
  const tipo = typeof r.tipo === 'string' && (TIPOS_MOV as readonly string[]).includes(r.tipo) ? (r.tipo as TipoMovimiento) : null;
  if (!id || !m || importe === null || !f || !tipo) return null;
  // Solo el ajuste puede ser negativo: el signo de lo demás lo da el tipo.
  if (tipo !== 'ajuste' && importe <= 0) return null;
  const cuotas = entero(r.cuotas);
  return {
    id,
    updatedAt: sello(r.updatedAt),
    tipo,
    importe,
    moneda: m,
    fecha: f,
    cuentaId: idNulo(r.cuentaId),
    cuentaDestinoId: idNulo(r.cuentaDestinoId),
    categoria: texto(r.categoria),
    comercio: texto(r.comercio),
    nota: texto(r.nota),
    cuotas: cuotas !== null && cuotas >= 1 && cuotas <= 72 ? cuotas : 1,
    devolucionDe: idNulo(r.devolucionDe),
    origen: unoDe(r.origen, ORIGENES, 'manual'),
    aRevisar: bool(r.aRevisar, false),
  };
}

function importeNulo(x: unknown): number | null {
  const n = entero(x);
  return n !== null && n >= 0 ? n : null;
}

function parseCompromiso(r: unknown): Compromiso | null {
  if (!esObjeto(r)) return null;
  const id = idNulo(r.id);
  const m = moneda(r.moneda);
  const v = fecha(r.vencimiento);
  if (!id || !m || !v) return null;
  return {
    id,
    updatedAt: sello(r.updatedAt),
    nombre: texto(r.nombre, 'Compromiso'),
    importe: importeNulo(r.importe),
    moneda: m,
    vencimiento: v,
    recurrencia: unoDe(r.recurrencia, RECURRENCIAS, 'ninguna'),
    pagado: bool(r.pagado, false),
    pagoId: idNulo(r.pagoId),
  };
}

function parseIngreso(r: unknown): IngresoEsperado | null {
  if (!esObjeto(r)) return null;
  const id = idNulo(r.id);
  const m = moneda(r.moneda);
  const f = fecha(r.fecha);
  if (!id || !m || !f) return null;
  return {
    id,
    updatedAt: sello(r.updatedAt),
    nombre: texto(r.nombre, 'Ingreso'),
    importe: importeNulo(r.importe),
    moneda: m,
    fecha: f,
    variable: bool(r.variable, false),
    recurrencia: unoDe(r.recurrencia, RECURRENCIAS, 'ninguna'),
    cobrado: bool(r.cobrado, false),
  };
}

function parseMeta(r: unknown): Meta | null {
  if (!esObjeto(r)) return null;
  const id = idNulo(r.id);
  const m = moneda(r.moneda);
  if (!id || !m) return null;
  const imagen = texto(r.imagen);
  return {
    id,
    updatedAt: sello(r.updatedAt),
    nombre: texto(r.nombre, 'Meta'),
    // Solo imágenes embebidas: una URL externa haría que la app pida algo afuera.
    imagen: imagen.startsWith('data:image/') ? imagen : '',
    objetivo: importeNulo(r.objetivo),
    moneda: m,
    fecha: fecha(r.fecha),
    pasoChico: texto(r.pasoChico),
    destacada: bool(r.destacada, false),
    esReserva: bool(r.esReserva, false),
    hitos: Array.isArray(r.hitos) ? r.hitos.map(importeNulo).filter((h): h is number => h !== null && h > 0).sort((a, b) => a - b) : [],
    esencialesPorMes: importeNulo(r.esencialesPorMes),
  };
}

function parseAporte(r: unknown): Aporte | null {
  if (!esObjeto(r)) return null;
  const id = idNulo(r.id);
  const metaId = idNulo(r.metaId);
  const cuentaId = idNulo(r.cuentaId);
  const importe = entero(r.importe);
  const f = fecha(r.fecha);
  if (!id || !metaId || !cuentaId || importe === null || importe === 0 || !f) return null;
  return {
    id,
    updatedAt: sello(r.updatedAt),
    metaId,
    importe,
    fecha: f,
    forma: unoDe(r.forma, ['virtual', 'real'] as const, 'virtual'),
    cuentaId,
    nota: texto(r.nota),
  };
}

function parseLapidas(x: unknown): Lapida[] {
  if (!Array.isArray(x)) return [];
  return x.flatMap((l) => {
    if (!esObjeto(l)) return [];
    const id = idNulo(l.id);
    return id ? [{ id, deletedAt: sello(l.deletedAt) }] : [];
  });
}

function parsePreferencias(x: unknown): Preferencias {
  const d = preferenciasPorDefecto();
  if (!esObjeto(x)) return d;
  const min = entero(x.recordatorioMin);
  return {
    onboardingHecho: bool(x.onboardingHecho, d.onboardingHecho),
    companero: unoDe<Companero>(x.companero, ['visible', 'ocasional', 'no'], d.companero),
    celebraciones: bool(x.celebraciones, d.celebraciones),
    hormiga: bool(x.hormiga, d.hormiga),
    bajaEnergia: bool(x.bajaEnergia, d.bajaEnergia),
    trato: unoDe<Trato>(x.trato, ['neutro', 'femenino', 'masculino'], d.trato),
    periodo: unoDe<Periodo>(x.periodo, ['proximo-ingreso', 'fin-de-mes'], d.periodo),
    calendarioConDetalle: bool(x.calendarioConDetalle, d.calendarioConDetalle),
    recordatorioMin: min !== null && min >= 0 && min <= 7 * 24 * 60 ? min : d.recordatorioMin,
    voz: bool(x.voz, d.voz),
    gastoVariable: importeNulo(x.gastoVariable),
    updatedAt: sello(x.updatedAt),
  };
}

function parseHuellitas(x: unknown): Huellitas {
  const d = huellitasVacias();
  if (!esObjeto(x)) return d;
  const alm = entero(x.almohadillas);
  const hoy = esObjeto(x.hoy) ? x.hoy : {};
  const total = entero(x.totalCompletas);
  const completas = entero(hoy.completas);
  return {
    almohadillas: alm !== null && alm >= 0 && alm <= 4 ? alm : 0,
    hoy: {
      fecha: fecha(hoy.fecha) ?? '',
      acciones: Array.isArray(hoy.acciones)
        ? hoy.acciones.filter((a): a is AccionHuellita => typeof a === 'string' && (ACCIONES as readonly string[]).includes(a))
        : [],
      completas: completas !== null && completas >= 0 ? completas : 0,
    },
    totalCompletas: total !== null && total >= 0 ? total : 0,
    trucos: Array.isArray(x.trucos) ? [...new Set(x.trucos.filter((t): t is string => typeof t === 'string'))] : [],
    updatedAt: sello(x.updatedAt),
  };
}

function lista<T extends { id: string }>(x: unknown, parse: (r: unknown) => T | null): T[] {
  if (!Array.isArray(x)) return [];
  const vistos = new Set<string>();
  const res: T[] = [];
  for (const r of x) {
    const v = parse(r);
    if (!v) continue;
    const id = v.id;
    if (vistos.has(id)) continue;
    vistos.add(id);
    res.push(v);
  }
  return res;
}

/** Valida datos crudos. Devuelve `null` si no parecen datos de Salchi. */
export function parseData(x: unknown): AppData | null {
  if (!esObjeto(x)) return null;
  if (!COLECCIONES.some((c) => Array.isArray(x[c])) && !esObjeto(x.preferencias)) return null;
  const borrados = esObjeto(x.deleted) ? x.deleted : {};
  const deleted = {} as Borrados;
  for (const c of COLECCIONES) deleted[c] = parseLapidas(borrados[c]);
  return {
    version: SCHEMA_VERSION,
    cuentas: lista(x.cuentas, parseCuenta),
    movimientos: lista(x.movimientos, parseMovimiento),
    compromisos: lista(x.compromisos, parseCompromiso),
    ingresos: lista(x.ingresos, parseIngreso),
    metas: lista(x.metas, parseMeta),
    aportes: lista(x.aportes, parseAporte),
    deleted,
    preferencias: parsePreferencias(x.preferencias),
    huellitas: parseHuellitas(x.huellitas),
  };
}

/** Lo que hay guardado ahora, validado, o `null`. */
export function leerLoGuardado(): AppData | null {
  try {
    const crudo = localStorage.getItem(STORAGE_KEY);
    if (crudo === null) return null;
    return parseData(JSON.parse(crudo));
  } catch {
    return null;
  }
}

export function loadData(): AppData {
  return leerLoGuardado() ?? emptyData();
}

/**
 * Guarda fusionando con lo que haya guardado otra pestaña. Devuelve lo que
 * quedó escrito, o `null` si no se pudo (almacenamiento lleno o bloqueado).
 *
 * Nunca se escribe el bloque entero a secas: pisaría lo que otra pestaña
 * acaba de guardar.
 */
export function guardarFusionando(data: AppData): AppData | null {
  try {
    const otro = leerLoGuardado();
    const final = otro ? fusionar(data, otro) : data;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(final));
    return final;
  } catch {
    return null;
  }
}

/** Borra todo: los datos y los borradores. Lo pide la persona, con confirmación. */
export function borrarTodo(): void {
  try {
    const claves: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k !== null && k.startsWith('salchi:')) claves.push(k);
    }
    for (const k of claves) localStorage.removeItem(k);
  } catch {
    /* Nada que hacer: sin acceso, tampoco hay nada guardado. */
  }
}
