import { createContext, useContext } from 'react';
import type { Compromiso, Cuenta, IngresoEsperado, Meta, Moneda, Movimiento } from '../types';
import type { Vencimiento } from '../lib/finanzas/pendientes';

/**
 * Qué cuadro está abierto. Uno por vez: dos cuadros apilados son dos
 * decisiones a la vez.
 */
export type Ventana =
  | { tipo: 'anotar'; mov?: Movimiento; modo?: 'numero' | 'frase'; fecha?: string; frase?: string }
  | { tipo: 'comprobante' }
  | { tipo: 'cuenta'; cuenta?: Cuenta; tipoCuenta?: Cuenta['tipo'] }
  | { tipo: 'saldo'; cuentaId: string }
  | { tipo: 'compromiso'; compromiso?: Compromiso }
  | { tipo: 'pagar'; vencimiento: Vencimiento }
  | { tipo: 'ingreso'; ingreso?: IngresoEsperado }
  | { tipo: 'cobrar'; ingresoId: string }
  | { tipo: 'meta'; meta?: Meta; esReserva?: boolean }
  | { tipo: 'aporte'; metaId: string; usar?: boolean }
  | { tipo: 'explicacion'; moneda: Moneda }
  | { tipo: 'asignar'; movimientoId: string }
  | { tipo: 'resumen'; tarjetaId: string }
  | { tipo: 'importar' }
  | { tipo: 'escenarios'; cuentaId: string }
  | { tipo: 'inversion' }
  | { tipo: 'compartir' };

export type Pestana = 'hoy' | 'plata' | 'planes' | 'ajustes';

interface VentanasValue {
  abrir: (v: Ventana) => void;
  cerrar: () => void;
  irA: (p: Pestana) => void;
}

export const VentanasContext = createContext<VentanasValue | null>(null);

export function useVentanas(): VentanasValue {
  const ctx = useContext(VentanasContext);
  if (!ctx) throw new Error('useVentanas fuera de <App>');
  return ctx;
}
