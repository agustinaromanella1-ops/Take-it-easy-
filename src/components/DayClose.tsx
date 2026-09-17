import { useMemo, useState } from 'react';
import type { Patient, PaymentMethod, Session } from '../types';
import { useStore } from '../store/StoreContext';
import {
  buildDayClose,
  emptyDecision,
  summarizeDayClose,
  type DayCloseDecision,
  type DayCloseResult,
} from '../lib/dayclose';
import { formatMoney } from '../lib/money';
import { formatDateLong } from '../lib/dates';
import { patientColor } from '../lib/palette';
import { Modal } from './ui';

const METHODS: PaymentMethod[] = ['efectivo', 'transferencia', 'tarjeta', 'otro'];

const ATTENDANCE: { value: Exclude<Session['status'], 'programada'>; label: string }[] = [
  { value: 'realizada', label: 'Vino' },
  { value: 'ausente', label: 'Faltó' },
  { value: 'cancelada', label: 'Canceló' },
];

/** Lo que se cuenta al final de la jornada. */
interface Despedida {
  titular: string;
  nombres: string[];
  faltaron: number;
  facturado: number;
  cobrado: number;
}

/** Nombres en castellano: "Ana, Luis y Mara". */
function listar(nombres: string[]): string {
  if (nombres.length === 1) return nombres[0]!;
  return `${nombres.slice(0, -1).join(', ')} y ${nombres[nombres.length - 1]}`;
}

/**
 * El resumen de la jornada, contando TODAS las sesiones del día y no solo las
 * que se acaban de resolver: si a la mañana ya se había cerrado una, igual
 * formó parte del día.
 */
function armarDespedida(
  sessions: Session[],
  decisions: Map<string, DayCloseDecision>,
  patientsById: Map<string, Patient>,
  result: DayCloseResult,
): Despedida {
  // Estado final de cada sesión: el que ya tenía, o el que se acaba de elegir.
  const finales = sessions.map((s) => {
    if (s.status !== 'programada') return { sesion: s, estado: s.status };
    const elegido = decisions.get(s.id)?.status;
    return { sesion: s, estado: elegido ?? 'programada' };
  });

  const atendidas = finales.filter((f) => f.estado === 'realizada');
  const caidas = finales.filter((f) => f.estado === 'ausente' || f.estado === 'cancelada');

  // Un nombre por persona aunque haya venido dos veces el mismo día.
  const nombres = [
    ...new Set(
      atendidas.map((f) => {
        const nombre = patientsById.get(f.sesion.patientId)?.name ?? 'Alguien';
        return nombre.split(' ')[0] ?? nombre;
      }),
    ),
  ];

  const facturado = finales.reduce(
    (t, f) => t + (f.estado === 'realizada' ? f.sesion.fee : 0),
    0,
  );
  const cobrado = result.payments.reduce((t, p) => t + p.amount, 0);

  const titular =
    atendidas.length === 0
      ? 'Hoy no se concretó ninguna sesión.'
      : atendidas.length === 1
        ? 'Hoy atendiste a una persona.'
        : `Hoy atendiste a ${atendidas.length} personas.`;

  return { titular, nombres, faltaron: caidas.length, facturado, cobrado };
}

/**
 * Cierre del día: repasar las sesiones de la jornada y dejarlas resueltas en
 * dos toques por paciente.
 *
 * Resuelve el agujero más común de la app: las sesiones que quedan en
 * "programada" para siempre y dejan la facturación por debajo de lo real.
 */
export function DayClose({
  date,
  sessions,
  patientsById,
  onClose,
}: {
  date: string;
  sessions: Session[];
  patientsById: Map<string, Patient>;
  onClose: () => void;
}) {
  const { data, dispatch } = useStore();
  const currency = data.settings.currency;

  const [decisions, setDecisions] = useState<Map<string, DayCloseDecision>>(new Map());
  const [method, setMethod] = useState<PaymentMethod>('efectivo');
  /** Lo que se muestra una vez guardado: el resumen de la jornada. */
  const [despedida, setDespedida] = useState<Despedida | null>(null);

  const pending = useMemo(() => sessions.filter((s) => s.status === 'programada'), [sessions]);
  const alreadyClosed = useMemo(() => sessions.filter((s) => s.status !== 'programada'), [sessions]);
  const summary = useMemo(() => summarizeDayClose(sessions, decisions), [sessions, decisions]);

  function update(id: string, patch: Partial<DayCloseDecision>) {
    setDecisions((prev) => {
      const next = new Map(prev);
      const current = next.get(id) ?? emptyDecision(data.settings.chargeNoShowByDefault);
      next.set(id, { ...current, ...patch });
      return next;
    });
  }

  /** Atajo para el caso más común: vinieron todos. */
  function markAllAttended() {
    setDecisions((prev) => {
      const next = new Map(prev);
      for (const s of pending) {
        const current = next.get(s.id) ?? emptyDecision(data.settings.chargeNoShowByDefault);
        next.set(s.id, { ...current, status: 'realizada' });
      }
      return next;
    });
  }

  function confirm() {
    const result = buildDayClose(sessions, decisions, date, method);
    dispatch({ type: 'day/close', payload: result });
    // En vez de cerrar y devolver a la pantalla de números, la jornada termina
    // con su resumen. Es el momento de soltar el trabajo, no de mirar totales.
    setDespedida(armarDespedida(sessions, decisions, patientsById, result));
  }

  if (despedida) {
    return (
      <Modal title="Listo por hoy" onClose={onClose}>
        {/* En gris a propósito: el día se terminó y la app baja la voz. Es la
            única pantalla sin color de toda la app. */}
        <div className="despedida">
          <p className="despedida-linea">{despedida.titular}</p>
          {despedida.nombres.length > 0 && (
            <p className="despedida-nombres">{listar(despedida.nombres)}</p>
          )}
          {despedida.faltaron > 0 && (
            <p className="despedida-nota">
              {despedida.faltaron === 1 ? 'Una sesión no se concretó.' : `${despedida.faltaron} sesiones no se concretaron.`}
            </p>
          )}
          <div className="despedida-cifras">
            <span>
              Facturado <strong>{formatMoney(despedida.facturado, currency)}</strong>
            </span>
            <span>
              Cobrado <strong>{formatMoney(despedida.cobrado, currency)}</strong>
            </span>
          </div>
          <p className="despedida-cierre">A descansar 🌙</p>
        </div>
        <div className="modal-foot">
          <button className="btn primary" onClick={onClose}>
            Cerrar
          </button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title="Cierre del día" onClose={onClose}>
      <p className="small muted cap-first" style={{ marginTop: 0 }}>
        {formatDateLong(date)}
      </p>

      {pending.length === 0 ? (
        <p className="empty" style={{ padding: '20px 10px' }}>
          {sessions.length === 0
            ? 'No había sesiones este día.'
            : 'Todas las sesiones de este día ya están cerradas. 🎉'}
        </p>
      ) : (
        <>
          <div className="close-head">
            <button className="btn small" onClick={markAllAttended}>
              Vinieron todos
            </button>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value as PaymentMethod)}
              aria-label="Medio de pago de los cobros del cierre"
              title="Medio de pago de los cobros de este cierre"
            >
              {METHODS.map((m) => (
                <option key={m} value={m}>
                  Cobro en {m}
                </option>
              ))}
            </select>
          </div>

          <div className="close-list">
            {pending.map((s) => {
              const patient = patientsById.get(s.patientId);
              const decision = decisions.get(s.id);
              const status = decision?.status ?? null;
              // El cobro solo tiene sentido si la sesión termina facturando.
              const billable =
                status === 'realizada' || (status === 'ausente' && (decision?.chargeable ?? true));
              return (
                <div
                  key={s.id}
                  className={`close-row${status ? ' is-decided' : ''}`}
                  style={{ ['--pc' as string]: patientColor(patient?.colorIndex ?? 0).solid }}
                >
                  <div className="close-who">
                    <strong>{patient?.name ?? '—'}</strong>
                    <span>
                      {s.time} · {formatMoney(s.fee, currency)}
                    </span>
                  </div>

                  <div className="seg" role="group" aria-label={`Asistencia de ${patient?.name ?? ''}`}>
                    {ATTENDANCE.map((a) => (
                      <button
                        key={a.value}
                        className={status === a.value ? 'is-on' : ''}
                        onClick={() => update(s.id, { status: a.value })}
                        aria-pressed={status === a.value}
                      >
                        {a.label}
                      </button>
                    ))}
                  </div>

                  {status === 'ausente' && (
                    <label className="check-inline small">
                      <input
                        type="checkbox"
                        checked={decision?.chargeable ?? true}
                        onChange={(e) => update(s.id, { chargeable: e.target.checked })}
                      />
                      Cobrar la ausencia
                    </label>
                  )}

                  {billable && s.fee > 0 && (
                    <label className="check-inline small">
                      <input
                        type="checkbox"
                        checked={decision?.collected ?? false}
                        onChange={(e) => update(s.id, { collected: e.target.checked })}
                      />
                      Ya cobré {formatMoney(s.fee, currency)}
                    </label>
                  )}
                </div>
              );
            })}
          </div>

          <div className="close-summary">
            <span>
              <strong>{summary.decided}</strong> de {summary.pending} resueltas
            </span>
            <span>
              Factura <strong>{formatMoney(summary.billed, currency)}</strong>
            </span>
            <span>
              Cobra <strong className="money credit">{formatMoney(summary.collected, currency)}</strong>
            </span>
          </div>
        </>
      )}

      {alreadyClosed.length > 0 && (
        <p className="small muted" style={{ marginBottom: 0 }}>
          {alreadyClosed.length} sesión(es) de este día ya estaban cerradas y no se tocan.
        </p>
      )}

      {/* La duda más común al cerrar el día es "¿y si me olvidé de algo?".
          Se puede arreglar todo después, así que conviene decirlo acá y no
          dejar que cerrar dé miedo. */}
      {pending.length > 0 && (
        <p className="small muted" style={{ marginBottom: 0 }}>
          Si te olvidás de alguien o te equivocás, se arregla después: la sesión se edita desde la
          Agenda y el cobro se borra desde Finanzas. Nada de esto queda cerrado con llave.
        </p>
      )}

      <div className="modal-foot">
        <button className="btn" onClick={onClose}>
          {summary.decided > 0 ? 'Cancelar' : 'Cerrar'}
        </button>
        <button className="btn primary" onClick={confirm} disabled={summary.decided === 0}>
          {summary.decided === summary.pending
            ? 'Guardar cierre'
            : `Guardar ${summary.decided} de ${summary.pending}`}
        </button>
      </div>
    </Modal>
  );
}
