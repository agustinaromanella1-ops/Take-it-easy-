/**
 * El modelo de datos de Salchi.
 *
 * Toda la plata es un entero de centavos (`Cents`), nunca un float: `0.1 + 0.2`
 * no da `0.3`, y una app de plata que se equivoca por un centavo pierde la
 * confianza entera. Las fechas locales son texto `YYYY-MM-DD`.
 */

export type Cents = number;
/** "YYYY-MM-DD", en hora local. */
export type DateISO = string;
/** Instante ISO completo, para sellos. */
export type Instante = string;

export type Moneda = 'ARS' | 'USD';
export const MONEDAS: readonly Moneda[] = ['ARS', 'USD'];

/** Lo que tienen en común todos los registros: un id y cuándo se tocó por última vez. */
export interface Sellado {
  id: string;
  /** Lo pone el reducer, nunca quien despacha. Ver `SINCRONIZACION.md` de Pipí Cucú. */
  updatedAt: Instante;
}

/** Un borrado: id y fecha, nunca contenido. */
export interface Lapida {
  id: string;
  deletedAt: Instante;
}

export type TipoCuenta = 'efectivo' | 'banco' | 'billetera' | 'tarjeta-credito';

export interface Cuenta extends Sellado {
  nombre: string;
  tipo: TipoCuenta;
  moneda: Moneda;
  /**
   * Saldo en `fechaSaldo`. En una tarjeta de crédito es lo que se debe
   * (positivo = deuda), no plata disponible.
   */
  saldoInicial: Cents;
  fechaSaldo: DateISO;
  /** Si el saldo inicial fue "más o menos", queda dicho. */
  aproximado: boolean;
  /**
   * Si entra en la cuenta de "cuánto puedo usar". Falso por defecto en
   * tarjetas de crédito, y la persona lo puede apagar en una cuenta de ahorro
   * que no quiere tocar.
   */
  cuentaParaDisponible: boolean;
  /** Última vez que la persona dijo "esto es lo que hay". */
  confirmadoEn: DateISO;
  /** Otros nombres con que se la menciona al escribir ("mp", "débito", "galicia"). */
  alias: string[];
  /** Solo tarjetas: día del mes en que cierra el resumen. */
  diaCierre: number | null;
  /** Solo tarjetas: día del mes en que vence el resumen. */
  diaVencimiento: number | null;
  archivada: boolean;
}

export type TipoMovimiento =
  | 'gasto'
  | 'ingreso'
  | 'transferencia'
  | 'devolucion'
  | 'pago-tarjeta'
  | 'ajuste';

export type OrigenMovimiento = 'manual' | 'texto' | 'comprobante' | 'ajuste';

export interface Movimiento extends Sellado {
  tipo: TipoMovimiento;
  /**
   * Siempre positivo, salvo en `ajuste`: ahí el signo dice si apareció plata
   * (+) o faltaba (−) respecto de lo calculado.
   */
  importe: Cents;
  moneda: Moneda;
  fecha: DateISO;
  /** `null` = gasto pendiente de asignar a una cuenta. */
  cuentaId: string | null;
  /** Transferencias y pagos de tarjeta: a dónde va. */
  cuentaDestinoId: string | null;
  categoria: string;
  comercio: string;
  nota: string;
  /** Compras con tarjeta de crédito: en cuántas cuotas. 1 = un pago. */
  cuotas: number;
  /** Devoluciones: el gasto al que corresponden. */
  devolucionDe: string | null;
  origen: OrigenMovimiento;
  aRevisar: boolean;
}

export type Recurrencia = 'ninguna' | 'mensual';

export interface Compromiso extends Sellado {
  nombre: string;
  /** `null` = "importe a confirmar": no se inventa. */
  importe: Cents | null;
  moneda: Moneda;
  vencimiento: DateISO;
  recurrencia: Recurrencia;
  pagado: boolean;
  /** El movimiento con que se pagó, si se registró. */
  pagoId: string | null;
}

export interface IngresoEsperado extends Sellado {
  nombre: string;
  importe: Cents | null;
  moneda: Moneda;
  fecha: DateISO;
  /** Si varía de un mes a otro: se muestra como estimado. */
  variable: boolean;
  recurrencia: Recurrencia;
  cobrado: boolean;
}

export interface Meta extends Sellado {
  nombre: string;
  /** Imagen chica (data URL) que queda en el dispositivo, o vacía. */
  imagen: string;
  objetivo: Cents | null;
  moneda: Moneda;
  fecha: DateISO | null;
  pasoChico: string;
  destacada: boolean;
  /** La reserva para imprevistos es una meta con reglas propias. */
  esReserva: boolean;
  /** Reserva: hitos elegidos por la persona, de menor a mayor. */
  hitos: Cents[];
  /** Reserva: gastos esenciales de un mes, para decir "cubre N meses". */
  esencialesPorMes: Cents | null;
}

/**
 * Plata puesta en una meta (importe positivo) o sacada de ella (negativo).
 *
 * `virtual`: sigue en la misma cuenta, apartada solo adentro de la app.
 * `real`: se movió de verdad a otra cuenta; va acompañada de una transferencia.
 */
export interface Aporte extends Sellado {
  metaId: string;
  importe: Cents;
  fecha: DateISO;
  forma: 'virtual' | 'real';
  /** Dónde está esa plata. */
  cuentaId: string;
  nota: string;
}

export type Companero = 'visible' | 'ocasional' | 'no';
export type Trato = 'neutro' | 'femenino' | 'masculino';
export type Periodo = 'proximo-ingreso' | 'fin-de-mes';

export interface Preferencias {
  onboardingHecho: boolean;
  companero: Companero;
  celebraciones: boolean;
  hormiga: boolean;
  bajaEnergia: boolean;
  trato: Trato;
  periodo: Periodo;
  /** Si el `.ics` de un vencimiento lleva el nombre y el importe o un texto genérico. */
  calendarioConDetalle: boolean;
  /** Minutos antes del vencimiento (a las 9) en que suena el recordatorio del calendario. */
  recordatorioMin: number;
  /** Se toca de a uno y casi nunca: gana quien guarda. */
  updatedAt: Instante;
}

export type AccionHuellita =
  | 'revisar-movimientos'
  | 'confirmar-compromiso'
  | 'actualizar-saldo'
  | 'anotar'
  | 'retomar'
  | 'comprobante'
  | 'revision-breve';

export interface Huellitas {
  /** Almohadillas llenas de la huella actual (0 a 4). */
  almohadillas: number;
  /** Qué acción llenó una almohadilla, y qué día. Solo lo de hoy importa. */
  hoy: { fecha: DateISO; acciones: AccionHuellita[]; completas: number };
  totalCompletas: number;
  /** Trucos desbloqueados, en orden. Nunca se pierden. */
  trucos: string[];
  updatedAt: Instante;
}

export interface Borrados {
  cuentas: Lapida[];
  movimientos: Lapida[];
  compromisos: Lapida[];
  ingresos: Lapida[];
  metas: Lapida[];
  aportes: Lapida[];
}

export interface AppData {
  version: number;
  cuentas: Cuenta[];
  movimientos: Movimiento[];
  compromisos: Compromiso[];
  ingresos: IngresoEsperado[];
  metas: Meta[];
  aportes: Aporte[];
  deleted: Borrados;
  preferencias: Preferencias;
  huellitas: Huellitas;
}

/** Las colecciones de registros, para recorrerlas sin repetir sus nombres. */
export const COLECCIONES = ['cuentas', 'movimientos', 'compromisos', 'ingresos', 'metas', 'aportes'] as const;
export type Coleccion = (typeof COLECCIONES)[number];
