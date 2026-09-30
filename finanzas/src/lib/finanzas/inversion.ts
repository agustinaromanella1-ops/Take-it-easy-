import type { Cents } from '../../types';

/**
 * Simulador educativo de inversión.
 *
 * No sabe nada de productos, tasas del mercado ni cotizaciones, y no
 * recomienda nada: hace cuentas con los números que pone la persona, y los
 * de ejemplo están marcados como ejemplo.
 *
 * Muestra siempre dos cosas que una simulación optimista suele esconder:
 * - el valor en pesos de hoy (descontando la inflación supuesta);
 * - el peor momento del camino: cuánto menos de lo puesto hubo en algún mes.
 *
 * Tasas en centésimos de punto por mes (250 = 2,5 % mensual). Pueden ser
 * negativas: perder plata es un resultado posible y se simula como tal.
 */

export interface Parametros {
  inicial: Cents;
  aporteMensual: Cents;
  meses: number;
  tasaMensual: number;
  inflacionMensual: number;
  /** Una caída puntual: en el mes `mes`, el valor cae `porcentaje` (en centésimos de punto). */
  caida: { mes: number; porcentaje: number } | null;
}

export interface Resultado {
  aportado: Cents;
  final: Cents;
  /** El final en pesos de hoy. */
  finalReal: Cents;
  /** La mayor diferencia negativa entre lo que había y lo puesto hasta ese mes (0 si nunca hubo menos). */
  peorDiferencia: Cents;
  peorMes: number | null;
}

export function simularInversion(p: Parametros): Resultado {
  const r = p.tasaMensual / 10000;
  const inf = p.inflacionMensual / 10000;
  let valor = p.inicial;
  let aportado = p.inicial;
  let peorDiferencia = 0;
  let peorMes: number | null = null;
  let indice = 1;
  for (let mes = 1; mes <= p.meses; mes++) {
    valor = Math.round(valor * (1 + r));
    if (p.caida && p.caida.mes === mes) valor = Math.round(valor * (1 - p.caida.porcentaje / 10000));
    valor += p.aporteMensual;
    aportado += p.aporteMensual;
    indice *= 1 + inf;
    const diferencia = valor - aportado;
    if (diferencia < peorDiferencia) {
      peorDiferencia = diferencia;
      peorMes = mes;
    }
  }
  return { aportado, final: valor, finalReal: Math.round(valor / indice), peorDiferencia, peorMes };
}

/** Números de ejemplo para arrancar. NO son pronósticos ni tasas de ningún producto. */
export const EJEMPLO = {
  inflacionMensual: 200,
  escenarios: [
    { nombre: 'Si va mal', tasaMensual: -150 },
    { nombre: 'Intermedio', tasaMensual: 200 },
    { nombre: 'Si va bien', tasaMensual: 350 },
  ],
} as const;

/** "2,5" → 250; "-1,5" → -150. `null` si no se entiende o es absurdo. */
export function parsePorcentaje(texto: string): number | null {
  const t = texto.replace('%', '').replace(',', '.').trim();
  if (t === '' || t === '-') return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n <= -100 || n > 100) return null;
  return Math.round(n * 100);
}
