import { useMemo, useState } from 'react';
import type { Patient, Session } from '../types';
import { useStore } from '../store/StoreContext';
import { cobrosPorSesion } from '../lib/cobroDeSesion';
import { addDays, formatDateLong, isValidISODate, isValidTime } from '../lib/dates';
import { formatMoney } from '../lib/money';
import { patientColor } from '../lib/palette';
import { Field, Modal } from './ui';

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

/**
 * A cuántos días se propone el turno movido.
 *
 * Una semana, a la misma hora: en un consultorio que trabaja semanal es lo
 * que se elige casi siempre, así que la propuesta suele ser la respuesta. Se
 * puede cambiar; lo que no se puede es dejarlo sin fecha.
 */
const DIAS_QUE_SE_PROPONEN = 7;

export function SesionesDeHoy({
  sesiones,
  patientsById,
}: {
  sesiones: Session[];
  patientsById: Map<string, Patient>;
}) {
  const { data, dispatch } = useStore();
  const moneda = data.settings.currency;
  /** La sesión que se está moviendo de día, con la fecha y hora propuestas. */
  const [moviendo, setMoviendo] = useState<{ sesion: Session; date: string; time: string } | null>(null);
  const [error, setError] = useState('');

  const enOrden = useMemo(() => [...sesiones].sort((a, b) => a.time.localeCompare(b.time)), [sesiones]);
  /** Para poder decir adónde se movió un turno, no solo que se movió. */
  const porId = useMemo(() => new Map(data.sessions.map((s) => [s.id, s])), [data.sessions]);
  const cobros = useMemo(() => cobrosPorSesion(enOrden, data.payments), [enOrden, data.payments]);

  if (enOrden.length === 0) return null;

  function marcar(s: Session, status: Session['status']) {
    // Volver a tocar el botón que ya está puesto la devuelve a programada: es
    // la forma de corregir sin tener que ir a buscar el menú de estados.
    const nuevo = s.status === status ? 'programada' : status;
    dispatch({ type: 'session/setStatus', payload: { id: s.id, status: nuevo } });
  }

  function abrirMudanza(s: Session) {
    setError('');
    setMoviendo({ sesion: s, date: addDays(s.date, DIAS_QUE_SE_PROPONEN), time: s.time });
  }

  function confirmarMudanza() {
    if (!moviendo) return;
    if (!isValidISODate(moviendo.date)) {
      setError('Esa fecha no existe.');
      return;
    }
    if (!isValidTime(moviendo.time)) {
      setError('Esa hora no existe.');
      return;
    }
    dispatch({
      type: 'session/reschedule',
      payload: { id: moviendo.sesion.id, date: moviendo.date, time: moviendo.time },
    });
    setMoviendo(null);
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
          const movidaA = s.rescheduledTo ? porId.get(s.rescheduledTo) : undefined;

          /*
           * Un turno ya movido no vuelve a ofrecer los tres botones: no hay
           * nada que contestar sobre él, y dejarlos puestos invita a marcar
           * "vino" en una sesión que no se dio. Queda la fila, apagada,
           * diciendo adónde fue: esconderla haría parecer que se perdió.
           */
          if (movidaA) {
            return (
              <li key={s.id} className="hoy-fila is-movida">
                <span className="hoy-hora">{s.time}</span>
                <span className="hoy-nombre">
                  <span
                    className="dot"
                    style={{ background: patientColor(paciente?.colorIndex ?? 0).solid }}
                  />
                  {nombre}
                </span>
                {/* En minúscula: va en medio de una frase, y la regla de la
                    app es mayúscula solo en la primera letra. */}
                <span className="hoy-movida">
                  Movida al {formatDateLong(movidaA.date).toLowerCase()}, {movidaA.time}
                </span>
              </li>
            );
          }

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
                {/* No es un estado más: abre el cuadro para elegir cuándo. Un
                    turno movido sin fecha nueva es un turno perdido. */}
                <button
                  type="button"
                  onClick={() => abrirMudanza(s)}
                  title={`Mover el turno de ${nombre} a otro día`}
                >
                  Reagendó
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

      {moviendo && (
        <Modal
          title={`Mover el turno de ${patientsById.get(moviendo.sesion.patientId)?.name ?? 'el paciente'}`}
          onClose={() => setMoviendo(null)}
        >
          <p className="small muted" style={{ marginTop: 0 }}>
            Estaba el {formatDateLong(moviendo.sesion.date).toLowerCase()} a las {moviendo.sesion.time}.
          </p>

          <div className="field-row">
            <Field label="Nueva fecha">
              <input
                type="date"
                value={moviendo.date}
                onChange={(e) => setMoviendo({ ...moviendo, date: e.target.value })}
              />
            </Field>
            <Field label="Nueva hora">
              <input
                type="time"
                value={moviendo.time}
                onChange={(e) => setMoviendo({ ...moviendo, time: e.target.value })}
              />
            </Field>
          </div>

          {error && <p className="error-text">{error}</p>}

          <p className="small muted">
            El turno de hoy queda cancelado y se agenda uno nuevo, con el mismo honorario y la misma
            duración. No cuenta como sesión caída.
          </p>

          <div className="modal-foot">
            <button className="btn" onClick={() => setMoviendo(null)}>
              Cancelar
            </button>
            <button className="btn primary" onClick={confirmarMudanza}>
              Mover el turno
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}
