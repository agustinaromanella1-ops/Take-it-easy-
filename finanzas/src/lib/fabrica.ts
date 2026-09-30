import type { AppData, Compromiso, Cuenta, IngresoEsperado, Meta, Movimiento, Aporte } from '../types';
import { emptyData } from './storage';

/**
 * Registros completos con valores razonables, para pruebas y para los datos
 * de ejemplo. Cada uno recibe solo lo que le importa al caso.
 */
const SELLO = '2026-01-01T00:00:00.000Z';
let contador = 0;
const id = (p: string) => `${p}-${++contador}`;

export function cuenta(p: Partial<Cuenta> = {}): Cuenta {
  const tipo = p.tipo ?? 'banco';
  return {
    id: id('cta'),
    updatedAt: SELLO,
    nombre: 'Banco',
    tipo,
    moneda: 'ARS',
    saldoInicial: 0,
    fechaSaldo: '2026-09-01',
    aproximado: false,
    cuentaParaDisponible: tipo !== 'tarjeta-credito',
    confirmadoEn: p.fechaSaldo ?? '2026-09-01',
    alias: [],
    diaCierre: tipo === 'tarjeta-credito' ? 25 : null,
    diaVencimiento: tipo === 'tarjeta-credito' ? 5 : null,
    archivada: false,
    ...p,
  };
}

export function movimiento(p: Partial<Movimiento> = {}): Movimiento {
  return {
    id: id('mov'),
    updatedAt: SELLO,
    tipo: 'gasto',
    importe: 100_00,
    moneda: 'ARS',
    fecha: '2026-09-10',
    cuentaId: null,
    cuentaDestinoId: null,
    categoria: '',
    comercio: '',
    nota: '',
    cuotas: 1,
    devolucionDe: null,
    origen: 'manual',
    aRevisar: false,
    ...p,
  };
}

export function compromiso(p: Partial<Compromiso> = {}): Compromiso {
  return {
    id: id('com'),
    updatedAt: SELLO,
    nombre: 'Luz',
    importe: 10_000_00,
    moneda: 'ARS',
    vencimiento: '2026-09-20',
    recurrencia: 'ninguna',
    pagado: false,
    pagoId: null,
    ...p,
  };
}

export function ingreso(p: Partial<IngresoEsperado> = {}): IngresoEsperado {
  return {
    id: id('ing'),
    updatedAt: SELLO,
    nombre: 'Sueldo',
    importe: 500_000_00,
    moneda: 'ARS',
    fecha: '2026-10-01',
    variable: false,
    recurrencia: 'mensual',
    cobrado: false,
    ...p,
  };
}

export function meta(p: Partial<Meta> = {}): Meta {
  return {
    id: id('meta'),
    updatedAt: SELLO,
    nombre: 'Vacaciones',
    imagen: '',
    objetivo: 300_000_00,
    moneda: 'ARS',
    fecha: null,
    pasoChico: '',
    destacada: true,
    esReserva: false,
    hitos: [],
    esencialesPorMes: null,
    ...p,
  };
}

export function aporte(p: Partial<Aporte> & Pick<Aporte, 'metaId' | 'cuentaId'>): Aporte {
  return { id: id('apo'), updatedAt: SELLO, importe: 10_000_00, fecha: '2026-09-10', forma: 'virtual', nota: '', ...p };
}

export function datos(p: Partial<AppData> = {}): AppData {
  const d = emptyData();
  return { ...d, preferencias: { ...d.preferencias, onboardingHecho: true }, ...p };
}
