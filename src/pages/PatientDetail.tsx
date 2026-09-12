import { useMemo } from 'react';
import { useStore } from '../store/StoreContext';
import { isBillable, patientBalances } from '../store/selectors';
import { formatMoney } from '../lib/money';
import { formatDateShort, timeToMinutes } from '../lib/dates';
import { Card, Empty, Stat } from '../components/ui';
import { patientColor } from '../lib/palette';
import { whatsappLink } from '../lib/contact';

/** Logo de WhatsApp, simplificado a una sola silueta. */
function WhatsAppIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2a10 10 0 0 0-8.6 15l-1.3 4.7 4.8-1.3A10 10 0 1 0 12 2Zm5.5 14.1c-.2.6-1.2 1.2-1.7 1.2-.5.1-1 .1-1.6-.1a13 13 0 0 1-5-4.4c-.6-.9-1-1.9-1-2.9 0-1 .5-1.5.7-1.8.2-.2.5-.3.7-.3h.5c.2 0 .4 0 .6.4l.8 2c.1.2 0 .4-.1.5l-.4.5c-.1.2-.3.3-.1.6.4.6.8 1.2 1.4 1.7.6.5 1.1.7 1.4.9.2.1.4.1.5-.1l.7-.8c.2-.2.3-.2.5-.1l2 1c.2 0 .3.2.4.3 0 .2 0 .8-.3 1.4Z" />
    </svg>
  );
}

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

  // El primer nombre alcanza para un saludo y evita sonar a formulario.
  const wapp = whatsappLink(patient.phone, `Hola ${patient.name.split(' ')[0] ?? ''}, ¿cómo estás?`);

  return (
    <>
      <div className="page-head">
        <div>
          <button className="btn small" onClick={onBack} style={{ marginBottom: 8 }}>
            ← Pacientes
          </button>
          <h1>
            <span className="dot" style={{ background: patientColor(patient.colorIndex).solid }} />
            {patient.name}{' '}
            {patient.status === 'inactivo' && <span className="tag inactivo">inactivo</span>}
          </h1>
          <p className="muted small" style={{ margin: '4px 0 0' }}>
            {[patient.email, patient.phone].filter(Boolean).join(' · ') || 'Sin datos de contacto'}
          </p>
        </div>
        {wapp && (
          <a className="btn wapp" href={wapp} target="_blank" rel="noopener noreferrer">
            <WhatsAppIcon /> Mandar mensaje
          </a>
        )}
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
