import { useMemo, useState } from 'react';
import type { Patient, PaymentMethod, Session } from '../types';
import { useStore } from '../store/StoreContext';
import {
  buildDayClose,
  emptyDecision,
  summarizeDayClose,
  type DayCloseDecision,
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
    onClose();
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
