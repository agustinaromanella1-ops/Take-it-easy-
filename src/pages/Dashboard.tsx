import { useMemo, useState } from 'react';
import { useStore } from '../store/StoreContext';
import { dashboardStats, upcomingSessions } from '../store/selectors';
import { formatMoney } from '../lib/money';
import { formatDateLong, formatMonthKey, monthKey, today } from '../lib/dates';
import { Card, Empty, Stat } from '../components/ui';
import { DayClose } from '../components/DayClose';
import { Ahora } from '../components/Ahora';
import { Pendientes } from '../components/Pendientes';
import { goalProgress } from '../lib/pricing';
import { patientColor } from '../lib/palette';
import { guardarEnfoque, leerEnfoque } from '../lib/enfoque';

export function DashboardPage({
  onGo,
}: {
  onGo: (page: 'agenda' | 'finanzas' | 'pacientes', paraPaciente?: string) => void;
}) {
  const { data } = useStore();
  const currency = data.settings.currency;

  const stats = useMemo(() => dashboardStats(data), [data]);
  const patientsById = useMemo(() => new Map(data.patients.map((p) => [p.id, p])), [data.patients]);
  const upcoming = useMemo(() => upcomingSessions(data.sessions, 7).slice(0, 8), [data.sessions]);

  // El cierre del día también vive acá, no solo en la agenda: al terminar de
  // atender se entra al inicio, no se va a buscar el día de hoy en el
  // calendario. Apunta siempre a hoy.
  const hoy = today();
  const [cerrando, setCerrando] = useState(false);
  const [enfoque, setEnfoque] = useState(leerEnfoque);

  function cambiarEnfoque(activo: boolean) {
    setEnfoque(activo);
    guardarEnfoque(activo);
  }
  const sesionesHoy = useMemo(() => data.sessions.filter((s) => s.date === hoy), [data.sessions, hoy]);
  const porCerrarHoy = useMemo(
    () => sesionesHoy.filter((s) => s.status === 'programada').length,
    [sesionesHoy],
  );

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
        {/* El interruptor queda siempre visible, prendido o apagado: si
            apareciera solo en un estado habría que acordarse de que existe. */}
        <button
          className={`btn small${enfoque ? ' primary' : ''}`}
          aria-pressed={enfoque}
          onClick={() => cambiarEnfoque(!enfoque)}
        >
          {enfoque ? 'Ver todo' : 'Enfoque'}
        </button>
      </div>

      {/* Antes que cualquier número: qué está pasando y cuánto falta. */}
      <Ahora sessions={data.sessions} patientsById={patientsById} onVerAgenda={() => onGo('agenda')} />

      {/* De todo lo que quedó abierto, una cosa. Reemplaza a la vieja tarjeta
          de "sesiones sin cerrar": eso ahora es uno de los casos de la lista. */}
      <Pendientes onGo={onGo} />

      {/* El cierre está siempre a la vista, aunque no haya nada que cerrar.
          Escondiéndolo nadie se entera de que existe, y además "¿me quedó algo
          abierto de hoy?" es una pregunta que se responde mirando, no
          buscando. Cambia de tono según el día, no de lugar. */}
      {porCerrarHoy > 0 ? (
        <button className="close-day-btn" onClick={() => setCerrando(true)}>
          🌙 Cierre del día
          <span className="badge">{porCerrarHoy}</span>
        </button>
      ) : sesionesHoy.length > 0 ? (
        <button className="close-day-btn is-quiet" onClick={() => setCerrando(true)}>
          🌙 Día cerrado
          <span className="close-day-hint">
            {sesionesHoy.length === 1 ? '1 sesión resuelta' : `${sesionesHoy.length} sesiones resueltas`}
          </span>
        </button>
      ) : (
        <p className="close-day-btn is-quiet is-static">🌙 Hoy no tenés sesiones agendadas</p>
      )}

      {cerrando && (
        <DayClose
          date={hoy}
          sessions={sesionesHoy}
          patientsById={patientsById}
          onClose={() => setCerrando(false)}
        />
      )}

      {enfoque && (
        <p className="enfoque-nota">
          Modo enfoque: guardados los números del mes. Están enteros cuando los quieras.
        </p>
      )}

      {!enfoque && (
        <>
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
            {/* "Por cobrar" y no "deuda pendiente", y en tono cálido y no en rojo:
                que la plata del mes todavía no haya entrado es el estado normal de
                un consultorio, no un error. El rojo queda para lo que sí está mal,
                si no deja de significar algo. */}
            <Stat
              label="Por cobrar"
              value={formatMoney(stats.outstanding, currency)}
              tone={stats.outstanding > 0 ? 'warn' : 'ok'}
              hint={stats.debtors.length === 1 ? '1 paciente' : `${stats.debtors.length} pacientes`}
            />
            <Stat
              label="Sesiones de la semana"
              value={String(stats.sessionsThisWeek)}
              hint={`${upcoming.length} por venir`}
            />
            <Stat label="Pacientes activos" value={String(stats.activePatients)} />
          </div>

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
              title="Por cobrar"
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
      )}
    </>
  );
}
