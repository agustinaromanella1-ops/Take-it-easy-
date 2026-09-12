import { useMemo } from 'react';
import { useStore } from '../store/StoreContext';
import { isBillable, patientBalances } from '../store/selectors';
import { formatMoney } from '../lib/money';
import { formatDateShort, timeToMinutes } from '../lib/dates';
import { Card, Empty, Stat } from '../components/ui';

export function PatientDetailPage({ patientId, onBack }: { patientId: string; onBack: () => void }) {
  const { data } = useStore();
  const currency = data.settings.currency;

  const patient = data.patients.find((p) => p.id === patientId);
  const balance = useMemo(() => patientBalances(data).get(patientId), [data, patientId]);

  const sessions = useMemo(
    () =>
      data.sessions
        .filter((s) => s.patientId === patientId)
        .sort((a, b) => (a.date === b.date ? timeToMinutes(b.time) - timeToMinutes(a.time) : a.date < b.date ? 1 : -1)),
    [data.sessions, patientId],
  );

  const payments = useMemo(
    () =>
      data.payments
        .filter((p) => p.patientId === patientId)
        .sort((a, b) => (a.date === b.date ? 0 : a.date < b.date ? 1 : -1)),
    [data.payments, patientId],
  );

  if (!patient) {
    return (
      <Card>
        <Empty>
          Ese paciente ya no existe.
          <br />
          <button className="btn" style={{ marginTop: 12 }} onClick={onBack}>
            Volver
          </button>
        </Empty>
      </Card>
    );
  }

  const saldo = balance?.balance ?? 0;

  return (
    <>
      <div className="page-head">
        <div>
          <button className="btn small" onClick={onBack} style={{ marginBottom: 8 }}>
            ← Pacientes
          </button>
          <h1>
            {patient.name}{' '}
            {patient.status === 'inactivo' && <span className="tag inactivo">inactivo</span>}
          </h1>
          <p className="muted small" style={{ margin: '4px 0 0' }}>
            {[patient.email, patient.phone].filter(Boolean).join(' · ') || 'Sin datos de contacto'}
          </p>
        </div>
      </div>

      <div className="stat-grid">
        <Stat label="Honorario habitual" value={formatMoney(patient.defaultFee, currency)} />
        <Stat label="Sesiones facturables" value={String(balance?.sessionsHeld ?? 0)} />
        <Stat label="Total facturado" value={formatMoney(balance?.billed ?? 0, currency)} />
        <Stat
          label={saldo >= 0 ? 'Saldo pendiente' : 'Saldo a favor'}
          value={formatMoney(Math.abs(saldo), currency)}
          tone={saldo > 0 ? 'danger' : 'ok'}
        />
      </div>

      {patient.notes && (
        <Card title="Notas">
          <p style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{patient.notes}</p>
        </Card>
      )}

      <Card title="Historial de sesiones">
        {sessions.length === 0 ? (
          <Empty>Todavía no hay sesiones con este paciente.</Empty>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Hora</th>
                  <th>Estado</th>
                  <th>Notas</th>
                  <th className="num">Honorario</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((s) => (
                  <tr key={s.id}>
                    <td className="small">{formatDateShort(s.date)}</td>
                    <td className="num small">{s.time}</td>
                    <td>
                      <span className={`tag ${s.status}`}>{s.status}</span>
                      {s.status === 'ausente' && !s.chargeable && (
                        <span className="small muted"> sin cargo</span>
                      )}
                    </td>
                    <td className="small muted">{s.notes || '—'}</td>
                    <td className="num">
                      {isBillable(s) ? formatMoney(s.fee, currency) : <span className="muted">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title="Pagos recibidos">
        {payments.length === 0 ? (
          <Empty>No hay pagos registrados.</Empty>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Medio</th>
                  <th>Notas</th>
                  <th className="num">Importe</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id}>
                    <td className="small">{formatDateShort(p.date)}</td>
                    <td className="small muted cap-first">{p.method}</td>
                    <td className="small muted">{p.notes || '—'}</td>
                    <td className="num">{formatMoney(p.amount, currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
