import { useMemo } from 'react';
import type { Patient, Session } from '../types';
import { useStore } from '../store/StoreContext';
import { cobrosPorSesion } from '../lib/cobroDeSesion';
import { formatMoney } from '../lib/money';
import { patientColor } from '../lib/palette';

/**
 * Las sesiones de hoy, con sus dos preguntas al lado.
 *
 * "¿Vino?" y "¿Pagó?" se contestaban entrando al día en la Agenda, o abriendo
 * el cierre del día. Las dos cosas piden acordarse de ir a mirar, y el inicio
 * es la pantalla que se abre sin pensar: si el día no está acá, no está.
 *
 * No reemplaza al cierre del día. Ese sigue siendo el repaso de la noche, que
 * marca todo junto y termina con el resumen. Esto es para el rato entre
 * paciente y paciente: una fila, dos toques, listo.
 *
 * Las dos preguntas son independientes a propósito. Cobrar por adelantado,
 * cobrarle a alguien que faltó, o atender a quien paga a fin de mes son todos
 * casos normales de consultorio; atar una cosa a la otra obligaría a pelearse
 * con la app justo cuando no se puede.
 */

/** El método de los cobros que se registran desde acá. Se cambia en Finanzas. */
const METODO_POR_DEFECTO = 'efectivo' as const;

export function SesionesDeHoy({
  sesiones,
  patientsById,
}: {
  sesiones: Session[];
  patientsById: Map<string, Patient>;
}) {
  const { data, dispatch } = useStore();
  const moneda = data.settings.currency;

  const enOrden = useMemo(() => [...sesiones].sort((a, b) => a.time.localeCompare(b.time)), [sesiones]);
  const cobros = useMemo(() => cobrosPorSesion(enOrden, data.payments), [enOrden, data.payments]);

  if (enOrden.length === 0) return null;

  function marcar(s: Session, status: Session['status']) {
    // Volver a tocar el botón que ya está puesto la devuelve a programada: es
    // la forma de corregir sin tener que ir a buscar el menú de estados.
    const nuevo = s.status === status ? 'programada' : status;
    dispatch({ type: 'session/setStatus', payload: { id: s.id, status: nuevo } });
  }

  function alternarCobro(s: Session) {
    const cobro = cobros.get(s.id);
    if (cobro) {
      dispatch({ type: 'payment/remove', payload: { id: cobro.id } });
      return;
    }
    dispatch({
      type: 'payment/add',
      payload: {
        patientId: s.patientId,
        date: s.date,
        amount: s.fee,
        method: METODO_POR_DEFECTO,
        notes: 'Cobrado desde el inicio',
        sessionId: s.id,
      },
    });
  }

  return (
    <section className="hoy" aria-label="Las sesiones de hoy">
      <div className="hoy-rotulo">Hoy</div>

      <ul className="hoy-lista">
        {enOrden.map((s) => {
          const paciente = patientsById.get(s.patientId);
          const cobro = cobros.get(s.id);
          const nombre = paciente?.name ?? 'Paciente borrado';
          return (
            <li key={s.id} className="hoy-fila">
              <span className="hoy-hora">{s.time}</span>
              <span className="hoy-nombre">
                <span
                  className="dot"
                  style={{ background: patientColor(paciente?.colorIndex ?? 0).solid }}
                />
                {nombre}
              </span>

              <span className="seg hoy-estado">
                <button
                  type="button"
                  aria-pressed={s.status === 'realizada'}
                  onClick={() => marcar(s, 'realizada')}
                  title={`${nombre} vino`}
                >
                  Vino
                </button>
                <button
                  type="button"
                  aria-pressed={s.status === 'ausente'}
                  onClick={() => marcar(s, 'ausente')}
                  title={`${nombre} faltó`}
                >
                  Faltó
                </button>
              </span>

              <button
                type="button"
                className={`hoy-cobro${cobro ? ' is-on' : ''}`}
                aria-pressed={cobro !== undefined}
                onClick={() => alternarCobro(s)}
                title={
                  cobro
                    ? `Sacar el cobro de ${formatMoney(cobro.amount, moneda)}`
                    : `Registrar ${formatMoney(s.fee, moneda)} de ${nombre}`
                }
              >
                {cobro ? '✓ Pagó' : 'Pagó'}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
