import type { Payment, Session } from '../types';

/**
 * El cobro que salda una sesión, si existe.
 *
 * Hay dos formas de encontrarlo y el orden importa:
 *
 * 1. **Por el vínculo.** Los cobros que se registran marcando la sesión —en el
 *    inicio o en el cierre del día— guardan su `sessionId`. Es exacto: permite
 *    decir que esa sesión está paga, y desmarcarla saca ese cobro y no otro.
 *
 * 2. **Por coincidencia, solo para los viejos.** Los cobros cargados antes de
 *    que el vínculo existiera no lo tienen. Para que una sesión ya cobrada no
 *    aparezca de golpe como impaga, se acepta un cobro sin vínculo del mismo
 *    paciente, del mismo día y por el mismo importe. No es infalible —dos
 *    sesiones iguales el mismo día con un solo cobro cargado se confunden—,
 *    pero equivocarse ahí es mucho más raro que mostrar mal todo lo viejo.
 *
 * Un cobro ya tomado por otra sesión no se vuelve a ofrecer: `tomados` es lo
 * que ya se asignó al recorrer el día.
 */
export function cobroDeSesion(
  sesion: Session,
  pagos: Payment[],
  tomados: ReadonlySet<string> = new Set(),
): Payment | null {
  const atado = pagos.find((p) => p.sessionId === sesion.id);
  if (atado) return atado;

  const suelto = pagos.find(
    (p) =>
      p.sessionId === undefined &&
      !tomados.has(p.id) &&
      p.patientId === sesion.patientId &&
      p.date === sesion.date &&
      p.amount === sesion.fee,
  );
  return suelto ?? null;
}

/**
 * El cobro de cada sesión del día, resuelto de una pasada.
 *
 * De a una no alcanza: dos sesiones del mismo paciente, el mismo día y por el
 * mismo importe se quedarían las dos con el mismo cobro viejo. Recorriendo
 * juntas, cada cobro se asigna una sola vez.
 */
export function cobrosPorSesion(sesiones: Session[], pagos: Payment[]): Map<string, Payment> {
  const resultado = new Map<string, Payment>();
  const tomados = new Set<string>();

  // Primero los atados, que son exactos y no dependen del orden.
  for (const s of sesiones) {
    const atado = pagos.find((p) => p.sessionId === s.id);
    if (atado) {
      resultado.set(s.id, atado);
      tomados.add(atado.id);
    }
  }

  for (const s of sesiones) {
    if (resultado.has(s.id)) continue;
    const suelto = cobroDeSesion(s, pagos, tomados);
    if (suelto) {
      resultado.set(s.id, suelto);
      tomados.add(suelto.id);
    }
  }
  return resultado;
}
