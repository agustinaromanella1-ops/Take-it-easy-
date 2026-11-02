import type { AppData, DateISO, Session } from '../types';
import { timeToMinutes } from './dates';
import { cobrosPorSesion } from './cobroDeSesion';

/**
 * El regulador de recordatorios: cuántas veces por día la app levanta la mano.
 *
 * ── Lo que sí llega al sistema y lo que no ──────────────────────────────────
 *
 * Estos avisos salen por `ServiceWorkerRegistration.showNotification()`, así
 * que aparecen en la barra de notificaciones del teléfono, quedan ahí hasta
 * que se las toca, y en Android llevan botones —vino, faltó, canceló,
 * reagendó— que al tocarlos abren la app y aplican la respuesta.
 *
 * Lo que NO hacen es sonar con la app cerrada a una hora fija. Para eso hacen
 * falta dos cosas que esta app no tiene y no va a tener:
 *
 * - Un servidor que mande push. No hay: nada de lo que se carga acá sale del
 *   dispositivo, y la política de privacidad se apoya en eso.
 * - La API de notificaciones programadas (`showTrigger` / `TimestampTrigger`),
 *   que haría justo esto sin servidor. Google la probó en un origin trial y
 *   nunca la lanzó: al día de hoy no existe en ningún navegador publicado.
 *
 * Queda `periodicSync`, que en una app instalada de Android puede despertar al
 * service worker de vez en cuando; se usa si está, pero el navegador decide
 * cuándo y puede no hacerlo nunca, así que Ajustes no lo promete.
 *
 * En la práctica: el recordatorio sale cuando la app se abre o se trae al
 * frente después de la hora prevista. Para alguien que mira el teléfono varias
 * veces por día, eso alcanza; prometer más sería mentir.
 *
 * ── Dos reglas que no se negocian ──────────────────────────────────────────
 *
 * 1. **No se avisa de nada.** Antes de cada recordatorio se mira si realmente
 *    quedó algo. Un aviso que llega cuando no hay nada que hacer es la forma
 *    más rápida de que alguien apague todo para siempre.
 *
 * 2. **No se acumulan.** Si la app estuvo cerrada todo el día y se abre a la
 *    noche, no salen cinco avisos juntos. Sale el último que correspondía y
 *    los anteriores se dan por vencidos. Una pila de notificaciones no es un
 *    recordatorio, es un reproche.
 *
 * Ninguno nombra al paciente, por lo mismo que `src/lib/aviso.ts`: una
 * notificación se ve en la pantalla bloqueada y queda en el historial del
 * teléfono. La hora sí, porque sin ella el aviso no dice de qué habla.
 */

export type NivelRecordatorio = 'nula' | 'baja' | 'media' | 'alta';

export const NIVELES: NivelRecordatorio[] = ['nula', 'baja', 'media', 'alta'];

/** Qué pregunta un recordatorio. */
export type TipoMomento =
  /** Sesiones que ya pasaron y siguen sin marcar. */
  | 'marcar'
  /** Sesiones marcadas que todavía no se cobraron. */
  | 'cobrar'
  /** El repaso del final del día: todo lo que quedó abierto, junto. */
  | 'cierre';

export interface Momento {
  /** Único dentro del día. Es lo que se anota para no repetir el mismo aviso. */
  id: string;
  /** Minutos transcurridos del día a los que corresponde. */
  minutos: number;
  tipo: TipoMomento;
}

/**
 * Las horas fijas de cada nivel.
 *
 * Fijas y no repartidas según la agenda a propósito: lo que vuelve útil un
 * recordatorio es poder contar con él. "A las cuatro me pregunta si cobré" es
 * una rutina; una hora que se mueve todos los días es una sorpresa más.
 *
 * Los números salen de lo que pidió el consultorio: la alta avisa dos veces
 * por lo que falta marcar y tres por lo que falta cobrar, más el cierre; la
 * media una de cada una más el cierre; la baja solo el cierre.
 */
const HORAS: Record<NivelRecordatorio, { marcar: number[]; cobrar: number[]; cierre: boolean }> = {
  nula: { marcar: [], cobrar: [], cierre: false },
  baja: { marcar: [], cobrar: [], cierre: true },
  media: { marcar: [18 * 60], cobrar: [16 * 60], cierre: true },
  alta: { marcar: [14 * 60, 18 * 60], cobrar: [11 * 60, 16 * 60, 20 * 60], cierre: true },
};

/** Si no hay sesiones de las que deducir el final del día. */
const CIERRE_POR_OMISION = 21 * 60;
/** Cuánto después de la última sesión se propone cerrar. */
const DESPUES_DE_LA_ULTIMA_MIN = 30;
const CIERRE_MIN = 18 * 60 + 30;
const CIERRE_MAX = 22 * 60;

/**
 * La hora del cierre, deducida de la agenda del día.
 *
 * Un consultorio que termina a las 17:00 no quiere que le pregunten por el
 * día a las 21:00, cuatro horas después de haber cerrado la puerta; y uno que
 * atiende hasta las 21:00 no quiere que le pregunten en medio de una sesión.
 * Los topes están para que la deducción no se vaya a una hora en la que nadie
 * quiere que le hablen.
 */
export function horaDelCierre(sesionesDelDia: Session[]): number {
  if (sesionesDelDia.length === 0) return CIERRE_POR_OMISION;
  const fin = Math.max(...sesionesDelDia.map((s) => timeToMinutes(s.time) + s.durationMin));
  return Math.min(CIERRE_MAX, Math.max(CIERRE_MIN, fin + DESPUES_DE_LA_ULTIMA_MIN));
}

/**
 * Los momentos del día para un nivel.
 *
 * Lo que caiga después del cierre se descarta: el cierre pregunta por todo lo
 * que quedó abierto, así que un "¿cobraste?" diez minutos más tarde sería el
 * mismo aviso dos veces.
 */
export function momentosDelDia(nivel: NivelRecordatorio, sesionesDelDia: Session[]): Momento[] {
  const h = HORAS[nivel];
  const cierre = horaDelCierre(sesionesDelDia);
  const lista: Momento[] = [];

  for (const m of h.marcar) {
    if (m < cierre) lista.push({ id: `marcar@${m}`, minutos: m, tipo: 'marcar' });
  }
  for (const m of h.cobrar) {
    if (m < cierre) lista.push({ id: `cobrar@${m}`, minutos: m, tipo: 'cobrar' });
  }
  if (h.cierre) lista.push({ id: 'cierre', minutos: cierre, tipo: 'cierre' });

  return lista.sort((a, b) => a.minutos - b.minutos || a.id.localeCompare(b.id));
}

/**
 * Hasta cuánto después de su hora sigue valiendo un recordatorio.
 *
 * Abrir la app a las 14:40 tiene que traer el aviso de las 14:00; abrirla a
 * las 23:00 no tiene que traerlo, porque ya no es un recordatorio sino un
 * reproche por algo que no se puede hacer a tiempo.
 */
const VENTANA_MIN = 90;

/**
 * Qué recordatorio corresponde ahora, y cuáles hay que dar por vencidos.
 *
 * Devuelve UNO solo —el más reciente de los que corresponden— y además la
 * lista de los que ya pasaron, para que el que llama los anote como hechos y
 * no salten más tarde todos juntos.
 */
export function momentoQueCorresponde(
  momentos: Momento[],
  minutos: number,
  yaHechos: ReadonlySet<string>,
): { ahora: Momento | null; vencidos: Momento[] } {
  const pasados = momentos.filter((m) => m.minutos <= minutos && !yaHechos.has(m.id));
  if (pasados.length === 0) return { ahora: null, vencidos: [] };
  const ultimo = pasados[pasados.length - 1]!;
  const aTiempo = minutos - ultimo.minutos < VENTANA_MIN;
  return { ahora: aTiempo ? ultimo : null, vencidos: pasados };
}

/** Lo que quedó abierto hoy, en números. */
export interface Faltante {
  /** Sesiones que ya terminaron y siguen en "programada". */
  sinMarcar: number;
  /** Sesiones ya marcadas que facturan y todavía no tienen cobro. */
  sinCobrar: number;
  /** El id de la única sesión sin marcar, cuando es una sola. */
  unicaSinMarcar: string | null;
  /** La hora de esa única sesión, para poder nombrarla sin nombrar a nadie. */
  horaUnica: string | null;
}

/**
 * Qué falta del día de hoy.
 *
 * `minutos` son los minutos transcurridos: una sesión que todavía no terminó
 * no está "sin marcar", está pasando. Preguntarle a alguien por una sesión que
 * está dando es la clase de aviso que hace que se apaguen todos.
 */
export function faltaDelDia(data: AppData, hoy: DateISO, minutos: number): Faltante {
  const delDia = data.sessions.filter((s) => s.date === hoy);
  const terminadas = delDia.filter((s) => timeToMinutes(s.time) + s.durationMin <= minutos);

  const sinMarcar = terminadas.filter((s) => s.status === 'programada');
  const facturables = delDia.filter(
    (s) => s.fee > 0 && (s.status === 'realizada' || (s.status === 'ausente' && s.chargeable)),
  );
  const cobros = cobrosPorSesion(facturables, data.payments);
  const sinCobrar = facturables.filter((s) => !cobros.has(s.id));

  return {
    sinMarcar: sinMarcar.length,
    sinCobrar: sinCobrar.length,
    unicaSinMarcar: sinMarcar.length === 1 ? sinMarcar[0]!.id : null,
    horaUnica: sinMarcar.length === 1 ? sinMarcar[0]!.time : null,
  };
}

/** Si un momento tiene algo real que decir. Si no, no se manda nada. */
export function hayQueAvisar(tipo: TipoMomento, falta: Faltante): boolean {
  if (tipo === 'marcar') return falta.sinMarcar > 0;
  if (tipo === 'cobrar') return falta.sinCobrar > 0;
  return falta.sinMarcar > 0 || falta.sinCobrar > 0;
}

/** Las respuestas que puede dar un botón de la notificación. */
export const ACCIONES = [
  { action: 'vino', title: 'Vino' },
  { action: 'falto', title: 'Faltó' },
  { action: 'cancelo', title: 'Canceló' },
  { action: 'reagendo', title: 'Reagendó' },
] as const;

export type AccionAviso = (typeof ACCIONES)[number]['action'];

export function esAccionAviso(valor: string): valor is AccionAviso {
  return ACCIONES.some((a) => a.action === valor);
}

/** A qué estado lleva cada respuesta. `reagendo` no tiene: necesita una fecha. */
export function estadoDeAccion(accion: AccionAviso): Session['status'] | null {
  if (accion === 'vino') return 'realizada';
  if (accion === 'falto') return 'ausente';
  if (accion === 'cancelo') return 'cancelada';
  return null;
}

export interface TextoRecordatorio {
  titulo: string;
  cuerpo: string;
  /** La sesión sobre la que preguntan los botones, si los lleva. */
  sesion: string | null;
}

/**
 * El texto de cada recordatorio.
 *
 * Los botones solo aparecen cuando hay UNA sesión sin marcar. Con dos o más,
 * "Vino" no se sabe de quién: se abre la app, que es donde están las dos filas
 * con su nombre. Y el aviso nunca dice el nombre, ni acá ni en ningún lado.
 */
export function textoRecordatorio(tipo: TipoMomento, falta: Faltante): TextoRecordatorio {
  if (tipo === 'cobrar') {
    return {
      titulo: falta.sinCobrar === 1 ? 'Una sesión de hoy sin cobrar' : `${falta.sinCobrar} sesiones de hoy sin cobrar`,
      cuerpo: 'Tocá para registrar lo que entró.',
      sesion: null,
    };
  }

  if (tipo === 'marcar') {
    if (falta.unicaSinMarcar && falta.horaUnica) {
      return {
        titulo: `La sesión de las ${falta.horaUnica}`,
        cuerpo: '¿Cómo salió?',
        sesion: falta.unicaSinMarcar,
      };
    }
    return {
      titulo: `${falta.sinMarcar} sesiones sin marcar`,
      cuerpo: 'Tocá para resolverlas en un minuto.',
      sesion: null,
    };
  }

  // El cierre junta las dos cosas: es el único momento en que conviene ver
  // todo lo que quedó abierto de una.
  const partes: string[] = [];
  if (falta.sinMarcar > 0) {
    partes.push(falta.sinMarcar === 1 ? '1 sin marcar' : `${falta.sinMarcar} sin marcar`);
  }
  if (falta.sinCobrar > 0) {
    partes.push(falta.sinCobrar === 1 ? '1 sin cobrar' : `${falta.sinCobrar} sin cobrar`);
  }
  return {
    titulo: 'Cerrá el día',
    cuerpo: `${partes.join(' y ')}. Son dos toques.`,
    sesion: falta.unicaSinMarcar,
  };
}
