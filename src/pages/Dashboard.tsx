import { useMemo } from 'react';
import { useStore } from '../store/StoreContext';
import { dashboardStats, pendingReview, upcomingSessions } from '../store/selectors';
import { formatMoney } from '../lib/money';
import { formatDateLong, formatDateShort, formatMonthKey, monthKey, today } from '../lib/dates';
import { Card, Empty, Stat } from '../components/ui';
import { Mascot } from '../components/Mascot';
import { goalProgress } from '../lib/pricing';
import { patientColor } from '../lib/palette';

export function DashboardPage({ onGo }: { onGo: (page: 'agenda' | 'finanzas' | 'pacientes') => void }) {
  const { data, dispatch } = useStore();
  const currency = data.settings.currency;

  const stats = useMemo(() => dashboardStats(data), [data]);
  const patientsById = useMemo(() => new Map(data.patients.map((p) => [p.id, p])), [data.patients]);
  const upcoming = useMemo(() => upcomingSessions(data.sessions, 7).slice(0, 8), [data.sessions]);
  const overdue = useMemo(() => pendingReview(data.sessions).slice(0, 8), [data.sessions]);

  // Lo facturado del mes que todavía no entró. La etiqueta del encabezado
  // nombra la situación en vez de dejar a la usuaria interpretar el número.
  const porCobrarMes = Math.max(0, stats.monthBilled - stats.monthCollected);
  const goal = goalProgress(data.settings.monthlyGoal, stats.monthBilled);
  const heroLabel =
    stats.monthBilled === 0
      ? 'Todavía sin movimientos este mes'
      : porCobrarMes === 0
        ? 'Mes al día, todo cobrado'
        : stats.monthCollected === 0
          ? 'Mes facturado, sin cobros aún'
          : 'Así viene el mes';

  if (data.patients.length === 0) {
    return (
      <>
        <div className="page-head">
          <h1>Inicio</h1>
          <Mascot />
        </div>
        <Card>
          <Empty>
            <strong>Tu agenda, pipí cucú.</strong>
            <br />
            Para empezar, cargá tu primer paciente; después vas a poder agendar sesiones y registrar cobros.
            <br />
            <button className="btn primary" style={{ marginTop: 16 }} onClick={() => onGo('pacientes')}>
              Cargar primer paciente
            </button>
          </Empty>
        </Card>
      </>
    );
  }

  return (
    <>
      <div className="page-head">
        <div>
          <span className="muted small cap-first">{formatDateLong(today())}</span>
          <h1>Inicio</h1>
        </div>
        <Mascot />
      </div>

      <section className="hero">
        <div className="hero-label">{heroLabel}</div>
        <div className="hero-value">{formatMoney(stats.monthCollected, currency)}</div>
        <div className="hero-hint">
          cobrado en {formatMonthKey(monthKey(today()))}, de {formatMoney(stats.monthBilled, currency)} facturados
        </div>
        {goal && !goal.done && (
          <div className="hero-note">
            Te faltan <strong>{formatMoney(goal.remaining, currency)}</strong> para tu meta del mes.
          </div>
        )}
        {goal?.done && <div className="hero-note warm-note">¡Llegaste a tu meta del mes! 🎉</div>}
        {!goal && porCobrarMes > 0 && (
          <div className="hero-note">
            Te queda {formatMoney(porCobrarMes, currency)} por cobrar de este mes.
          </div>
        )}
      </section>

      <div className="stat-grid">
        <Stat
          label={`Facturado ${formatMonthKey(monthKey(today()))}`}
          value={formatMoney(stats.monthBilled, currency)}
        />
        <Stat
          label="Deuda pendiente"
          value={formatMoney(stats.outstanding, currency)}
          tone={stats.outstanding > 0 ? 'danger' : 'ok'}
          hint={`${stats.debtors.length} paciente(s)`}
        />
        <Stat
          label="Sesiones de la semana"
          value={String(stats.sessionsThisWeek)}
          hint={`${upcoming.length} por venir`}
        />
        <Stat label="Pacientes activos" value={String(stats.activePatients)} />
      </div>

      {overdue.length > 0 && (
        <Card title="Sesiones sin cerrar">
          <p className="small muted" style={{ marginTop: 0 }}>
            Ya pasaron pero siguen marcadas como “programada”. Hasta cerrarlas no cuentan en la facturación.
          </p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Paciente</th>
                  <th className="num">Honorario</th>
                  <th>Cerrar como</th>
                </tr>
              </thead>
              <tbody>
                {overdue.map((s) => (
                  <tr key={s.id}>
                    <td className="small">
                      {formatDateShort(s.date)} {s.time}
                    </td>
                    <td>{patientsById.get(s.patientId)?.name ?? '—'}</td>
                    <td className="num">{formatMoney(s.fee, currency)}</td>
                    <td>
                      <div className="actions">
                        <button
                          className="btn small"
                          onClick={() => dispatch({ type: 'session/setStatus', payload: { id: s.id, status: 'realizada' } })}
                        >
                          Realizada
                        </button>
                        <button
                          className="btn small"
                          onClick={() => dispatch({ type: 'session/setStatus', payload: { id: s.id, status: 'ausente' } })}
                        >
                          Ausente
                        </button>
                        <button
                          className="btn small"
                          onClick={() => dispatch({ type: 'session/setStatus', payload: { id: s.id, status: 'cancelada' } })}
                        >
                          Cancelada
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Card
        title="Próximos turnos"
        action={
          <button className="btn small" onClick={() => onGo('agenda')}>
            Ver agenda
          </button>
        }
      >
        {upcoming.length === 0 ? (
          <Empty>No hay turnos programados para los próximos 7 días.</Empty>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Día</th>
                  <th>Hora</th>
                  <th>Paciente</th>
                  <th className="num">Honorario</th>
                </tr>
              </thead>
              <tbody>
                {upcoming.map((s) => (
                  <tr key={s.id}>
                    <td className="small"><span className="cap-first">{formatDateLong(s.date)}</span></td>
                    <td className="num small">{s.time}</td>
                    <td>
                      <span
                        className="dot"
                        style={{ background: patientColor(patientsById.get(s.patientId)?.colorIndex ?? 0).solid }}
                      />
                      {patientsById.get(s.patientId)?.name ?? '—'}
                    </td>
                    <td className="num">{formatMoney(s.fee, currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {stats.debtors.length > 0 && (
        <Card
          title="Quiénes deben"
          action={
            <button className="btn small" onClick={() => onGo('finanzas')}>
              Ir a finanzas
            </button>
          }
        >
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Paciente</th>
                  <th className="num">Sesiones</th>
                  <th className="num">Debe</th>
                </tr>
              </thead>
              <tbody>
                {stats.debtors.slice(0, 6).map((b) => (
                  <tr key={b.patient.id}>
                    <td>{b.patient.name}</td>
                    <td className="num">{b.sessionsHeld}</td>
                    <td className="num">
                      <span className="money debt">{formatMoney(b.balance, currency)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </>
  );
}
