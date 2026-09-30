import type { AppData } from '../types';
import { addDays, conDia, today } from './dates';
import { emptyData } from './storage';

/**
 * Datos de ejemplo. Se arman en memoria cada vez, con fechas relativas a hoy,
 * y nunca se guardan: viven solo mientras está abierta la franja de "datos de
 * ejemplo". No hay forma de que se mezclen con los reales.
 */
export function datosDeEjemplo(): AppData {
  const hoy = today();
  const hace = (n: number) => addDays(hoy, -n);
  const en = (n: number) => addDays(hoy, n);
  const sello = new Date().toISOString();
  const base = emptyData();
  const cuenta = (id: string, nombre: string, tipo: AppData['cuentas'][number]['tipo'], saldoInicial: number, extra: Partial<AppData['cuentas'][number]> = {}) => ({
    id,
    updatedAt: sello,
    nombre,
    tipo,
    moneda: 'ARS' as const,
    saldoInicial,
    fechaSaldo: hace(20),
    aproximado: false,
    cuentaParaDisponible: tipo !== 'tarjeta-credito',
    confirmadoEn: hace(2),
    alias: tipo === 'banco' ? ['débito'] : tipo === 'billetera' ? ['mp'] : tipo === 'tarjeta-credito' ? ['crédito'] : [],
    diaCierre: tipo === 'tarjeta-credito' ? 25 : null,
    diaVencimiento: tipo === 'tarjeta-credito' ? 5 : null,
    cuotaMensual: null as number | null,
    cuotasRestantes: null as number | null,
    tasaAnual: null as number | null,
    archivada: false,
    ...extra,
  });
  const mov = (id: string, p: Partial<AppData['movimientos'][number]>) => ({
    id,
    updatedAt: sello,
    tipo: 'gasto' as const,
    importe: 0,
    moneda: 'ARS' as const,
    fecha: hoy,
    cuentaId: null,
    cuentaDestinoId: null,
    categoria: '',
    comercio: '',
    nota: '',
    cuotas: 1,
    devolucionDe: null,
    origen: 'manual' as const,
    aRevisar: false,
    ...p,
  });
  return {
    ...base,
    cuentas: [
      cuenta('ej-banco', 'Banco', 'banco', 420_000_00),
      cuenta('ej-mp', 'Mercado Pago', 'billetera', 35_000_00),
      cuenta('ej-efectivo', 'Efectivo', 'efectivo', 12_000_00, { aproximado: true }),
      cuenta('ej-visa', 'Visa', 'tarjeta-credito', 0),
      cuenta('ej-usd', 'Dólares', 'efectivo', 300_00, { moneda: 'USD', alias: ['dolares'] }),
      cuenta('ej-prestamo', 'Préstamo personal', 'prestamo', 600_000_00, {
        cuentaParaDisponible: false,
        alias: ['prestamo'],
        diaVencimiento: 12,
        cuotaMensual: 55_000_00,
        cuotasRestantes: 14,
        tasaAnual: 6900,
      }),
    ],
    movimientos: [
      mov('ej-m1', { importe: 8_500_00, fecha: hace(1), cuentaId: 'ej-banco', comercio: 'Supermercado', categoria: 'Comida' }),
      mov('ej-m2', { importe: 2_000_00, fecha: hace(1), cuentaId: 'ej-efectivo', comercio: 'Café', categoria: 'Comida afuera', origen: 'texto' }),
      mov('ej-m3', { importe: 90_000_00, cuotas: 3, fecha: hace(12), cuentaId: 'ej-visa', comercio: 'Zapatillas', categoria: 'Ropa' }),
      mov('ej-m4', { importe: 4_500_00, fecha: hace(3), cuentaId: null, comercio: 'Uber', categoria: 'Transporte' }),
      mov('ej-m5', { tipo: 'transferencia', importe: 20_000_00, fecha: hace(5), cuentaId: 'ej-banco', cuentaDestinoId: 'ej-mp' }),
      mov('ej-m6', { tipo: 'ingreso', importe: 380_000_00, fecha: hace(15), cuentaId: 'ej-banco', comercio: 'Sueldo', categoria: 'Ingresos' }),
    ],
    compromisos: [
      { id: 'ej-c1', updatedAt: sello, nombre: 'Alquiler', importe: 250_000_00, moneda: 'ARS', vencimiento: conDia(en(20), 10), recurrencia: 'mensual', pagado: false, pagoId: null },
      { id: 'ej-c2', updatedAt: sello, nombre: 'Luz', importe: null, moneda: 'ARS', vencimiento: en(4), recurrencia: 'mensual', pagado: false, pagoId: null },
      { id: 'ej-c3', updatedAt: sello, nombre: 'Internet', importe: 22_000_00, moneda: 'ARS', vencimiento: en(2), recurrencia: 'mensual', pagado: false, pagoId: null },
    ],
    ingresos: [{ id: 'ej-i1', updatedAt: sello, nombre: 'Sueldo', importe: 380_000_00, moneda: 'ARS', fecha: en(15), variable: false, recurrencia: 'mensual', cobrado: false }],
    metas: [
      { id: 'ej-meta', updatedAt: sello, nombre: 'Vacaciones en la costa', imagen: '', objetivo: 300_000_00, moneda: 'ARS', fecha: null, pasoChico: 'Averiguar precios de pasajes', destacada: true, esReserva: false, hitos: [], esencialesPorMes: null },
      { id: 'ej-reserva', updatedAt: sello, nombre: 'Reserva para imprevistos', imagen: '', objetivo: 100_000_00, moneda: 'ARS', fecha: null, pasoChico: '', destacada: false, esReserva: true, hitos: [300_000_00], esencialesPorMes: 450_000_00 },
    ],
    aportes: [
      { id: 'ej-a1', updatedAt: sello, metaId: 'ej-meta', importe: 45_000_00, fecha: hace(10), forma: 'virtual', cuentaId: 'ej-banco', nota: '' },
      { id: 'ej-a2', updatedAt: sello, metaId: 'ej-reserva', importe: 60_000_00, fecha: hace(10), forma: 'virtual', cuentaId: 'ej-banco', nota: '' },
    ],
    preferencias: { ...base.preferencias, onboardingHecho: true },
    huellitas: { ...base.huellitas, almohadillas: 3, trucos: ['patita'], totalCompletas: 1 },
  };
}
