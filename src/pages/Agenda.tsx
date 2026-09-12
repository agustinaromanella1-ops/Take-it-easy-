import { useMemo, useState } from 'react';
import type { Session } from '../types';
import { useStore } from '../store/StoreContext';
import { conflictingSessionIds, pendingReview, sessionsInRange } from '../store/selectors';
import { centsToInput, formatMoney, parseMoney } from '../lib/money';
import {
  addDays,
  DAY_NAMES,
  formatDateLong,
  fromISODate,
  isValidISODate,
  isValidTime,
  formatDateShort,
  monthKey,
  startOfWeek,
  timeToMinutes,
  today,
} from '../lib/dates';
import { Card, ConfirmButton, Empty, Field, Modal, Section } from '../components/ui';
import { MonthCalendar } from '../components/MonthCalendar';
import { DayClose } from '../components/DayClose';
import { IconBell } from '../components/icons';
import { patientColor } from '../lib/palette';
import { MAX_OCCURRENCES, occurrences, REPEAT_LABEL, type Repeat } from '../lib/recurrence';
import { icsFileName, sessionToICS } from '../lib/calendar';
import { downloadText } from '../lib/download';

const STATUS_LABEL: Record<Session['status'], string> = {
  programada: 'Programada',
  realizada: 'Realizada',
  ausente: 'Ausente',
  cancelada: 'Cancelada',
};

interface FormState {
  patientId: string;
  date: string;
  time: string;
  durationMin: string;
  fee: string;
  status: Session['status'];
  chargeable: boolean;
  notes: string;
  repeat: Repeat;
  repeatCount: string;
}

export function AgendaPage() {
  const { data, dispatch } = useStore();
  const [view, setView] = useState<'dia' | 'semana' | 'mes'>('dia');
  const [weekStart, setWeekStart] = useState(() => startOfWeek(today()));
  const [selectedDay, setSelectedDay] = useState(() => today());
  const [month, setMonth] = useState(() => monthKey(today()));
  const [closingDay, setClosingDay] = useState(false);
  const [editing, setEditing] = useState<Session | 'new' | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});

  const patientsById = useMemo(
    () => new Map(data.patients.map((p) => [p.id, p])),
    [data.patients],
  );
  const activePatients = useMemo(
    () => [...data.patients].sort((a, b) => a.name.localeCompare(b.name, 'es')),
    [data.patients],
  );

  const weekEnd = addDays(weekStart, 6);
  const weekSessions = useMemo(
    () => sessionsInRange(data.sessions, weekStart, weekEnd),
    [data.sessions, weekStart, weekEnd],
  );
  const conflicts = useMemo(() => conflictingSessionIds(weekSessions), [weekSessions]);
  const overdue = useMemo(() => pendingReview(data.sessions), [data.sessions]);

  // Sesiones del día elegido, ordenadas por hora: es la vista que se usa a
  // diario para saber a quién se atiende y en qué orden.
  const daySessions = useMemo(
    () => sessionsInRange(data.sessions, selectedDay, selectedDay),
    [data.sessions, selectedDay],
  );

  // Pacientes con sesión en el mes visible: la referencia de colores del
  // calendario solo nombra a quienes efectivamente aparecen ahí.
  const monthPatients = useMemo(() => {
    const ids = new Set<string>();
    for (const s of data.sessions) {
      if (s.date.startsWith(month) && s.status !== 'cancelada') ids.add(s.patientId);
    }
    return [...ids]
      .map((id) => patientsById.get(id))
      .filter((p): p is NonNullable<typeof p> => p !== undefined)
      .sort((a, b) => a.name.localeCompare(b.name, 'es'));
  }, [data.sessions, month, patientsById]);

  const byDay = useMemo(() => {
    const map = new Map<string, Session[]>();
    for (let i = 0; i < 7; i++) map.set(addDays(weekStart, i), []);
    for (const s of weekSessions) map.get(s.date)?.push(s);
    return map;
  }, [weekSessions, weekStart]);

  function openNew(date: string) {
    const first = activePatients.find((p) => p.status === 'activo') ?? activePatients[0];
    setForm({
      patientId: first?.id ?? '',
      date,
      time: '09:00',
      durationMin: String(data.settings.defaultDurationMin),
      fee: centsToInput(first?.defaultFee ?? 0),
      status: 'programada',
      chargeable: data.settings.chargeNoShowByDefault,
      notes: '',
      // La frecuencia del paciente propone la repetición, que igual se puede cambiar.
      repeat: first && first.frequency !== 'puntual' ? (first.frequency as Repeat) : 'ninguna',
      repeatCount: '4',
    });
    setErrors({});
    setEditing('new');
  }

  function openEdit(s: Session) {
    setForm({
      patientId: s.patientId,
      date: s.date,
      time: s.time,
      durationMin: String(s.durationMin),
      fee: centsToInput(s.fee),
      status: s.status,
      chargeable: s.chargeable,
      notes: s.notes,
      // Editar toca una sola sesión: cambiar toda la serie a la vez sería una
      // sorpresa desagradable si solo se quería mover un turno.
      repeat: 'ninguna',
      repeatCount: '1',
    });
    setErrors({});
    setEditing(s);
  }

  /**
   * Descarga el turno como archivo .ics. Abrirlo en el teléfono lo agrega al
   * calendario con alarma, así el aviso llega aunque la app esté cerrada.
   */
  function sendToCalendar(session: Session) {
    const name = patientsById.get(session.patientId)?.name ?? 'Paciente';
    downloadText(
      icsFileName(name, session.date),
      sessionToICS(session, { patientName: name, reminderMinutes: data.settings.reminderMinutes }),
      'text/calendar;charset=utf-8',
    );
  }

  function submit() {
    if (!form) return;
    const next: Partial<Record<keyof FormState, string>> = {};

    if (!form.patientId || !patientsById.has(form.patientId)) next.patientId = 'Elegí un paciente.';
    if (!isValidISODate(form.date)) next.date = 'Fecha inválida.';
    if (!isValidTime(form.time)) next.time = 'Hora inválida (HH:mm).';

    const duration = Number(form.durationMin);
    if (!Number.isFinite(duration) || duration < 5 || duration > 480) {
      next.durationMin = 'Entre 5 y 480 minutos.';
    }

    if (form.repeat !== 'ninguna') {
      const n = Number(form.repeatCount);
      if (!Number.isFinite(n) || n < 1 || n > MAX_OCCURRENCES) {
        next.repeatCount = `Entre 1 y ${MAX_OCCURRENCES} sesiones.`;
      }
    }

    const fee = form.fee.trim() === '' ? 0 : parseMoney(form.fee);
    if (fee === null) next.fee = 'Importe inválido.';
    else if (fee < 0) next.fee = 'El honorario no puede ser negativo.';

    setErrors(next);
    if (Object.keys(next).length > 0) return;

    const fields = {
      patientId: form.patientId,
      date: form.date,
      time: form.time,
      durationMin: Math.round(duration),
      status: form.status,
      fee: fee ?? 0,
      chargeable: form.chargeable,
      notes: form.notes.trim(),
    };

    if (editing === 'new') {
      const dates = occurrences(fields.date, form.repeat, Number(form.repeatCount) || 1);
      if (dates.length === 1) dispatch({ type: 'session/add', payload: fields });
      else dispatch({ type: 'session/addMany', payload: dates.map((date) => ({ ...fields, date })) });
    } else if (editing) {
      dispatch({ type: 'session/update', payload: { ...editing, ...fields } });
    }
    setEditing(null);
    setForm(null);
  }

  /** Al cambiar de paciente en una sesión NUEVA, se precarga su honorario.
   *  En una sesión existente no se toca: el honorario ya acordado manda. */
  function onPatientChange(patientId: string) {
    if (!form) return;
    const patient = patientsById.get(patientId);
    setForm({
      ...form,
      patientId,
      fee: editing === 'new' && patient ? centsToInput(patient.defaultFee) : form.fee,
    });
  }

  const todayISO = today();

  /** Vuelve al día de hoy en las tres vistas de una sola vez. */
  function goToday() {
    const hoy = today();
    setSelectedDay(hoy);
    setWeekStart(startOfWeek(hoy));
    setMonth(monthKey(hoy));
  }

  // Sesiones del día elegido que siguen sin resolverse. Es lo que el cierre
  // viene a resolver, y el número que se muestra en el botón.
  const pendingToClose = useMemo(
    () => daySessions.filter((s) => s.status === 'programada').length,
    [daySessions],
  );

  // Vista previa de la serie que se va a crear, para que el número de sesiones
  // y la fecha final se vean antes de confirmar.
  const series = useMemo(() => {
    if (!form || editing !== 'new' || form.repeat === 'ninguna') return [];
    if (!isValidISODate(form.date)) return [];
    return occurrences(form.date, form.repeat, Number(form.repeatCount) || 1);
  }, [form, editing]);

  return (
    <>
      <div className="page-head">
        <h1>Agenda</h1>
        <div className="actions">
          {/* Secundario: no debe competir con la acción principal de la
              pantalla, que es agregar o cerrar el día. */}
          <button className="btn ghost" onClick={() => goToday()}>
            Hoy
          </button>
          <button
            className="btn primary hide-mobile"
            onClick={() => openNew(selectedDay)}
            disabled={data.patients.length === 0}
          >
            + Sesión
          </button>
        </div>
      </div>

      {data.patients.length === 0 && (
        <div className="banner warn">Cargá un paciente antes de agendar turnos.</div>
      )}

      {overdue.length > 0 && (
        <div className="banner warn">
          Tenés <strong>{overdue.length}</strong> sesión(es) ya pasadas que siguen como “programadas”.
          Marcalas como realizadas o ausentes para que la facturación quede correcta.
        </div>
      )}

      <div className="tabs" role="tablist" aria-label="Vista de la agenda">
        {(['dia', 'semana', 'mes'] as const).map((v) => (
          <button key={v} role="tab" aria-selected={view === v} onClick={() => setView(v)}>
            {v === 'dia' ? 'Día' : v === 'semana' ? 'Semana' : 'Mes'}
          </button>
        ))}
      </div>

      {view === 'mes' && (
        <Section title="Calendario">
          <Card>
            <MonthCalendar
              month={month}
              selected={selectedDay}
              sessions={data.sessions}
              patientsById={patientsById}
              onSelect={(d) => {
                setSelectedDay(d);
                setMonth(monthKey(d));
              }}
              onMonthChange={setMonth}
            />
            {monthPatients.length > 0 && (
              <div className="legend">
                {monthPatients.map((p) => (
                  <span key={p.id}>
                    <i className="mini-dot" style={{ background: patientColor(p.colorIndex).solid }} />
                    {p.name}
                  </span>
                ))}
              </div>
            )}
          </Card>
        </Section>
      )}

      {view === 'semana' && (
        <Section
          title="Semana"
          action={
            <div className="actions">
              <button className="btn small ghost" onClick={() => setWeekStart(addDays(weekStart, -7))} aria-label="Semana anterior">
                ‹
              </button>
              <span className="small muted">
                {formatDateShort(weekStart)} — {formatDateShort(weekEnd)}
              </span>
              <button className="btn small ghost" onClick={() => setWeekStart(addDays(weekStart, 7))} aria-label="Semana siguiente">
                ›
              </button>
            </div>
          }
        >
          <Card>
            <div className="week-grid">
              {[...byDay.entries()].map(([date, sessions]) => (
                <div key={date} className={`day-col${date === todayISO ? ' is-today' : ''}`}>
                  <div className="day-head">
                    <span>
                      {DAY_NAMES[fromISODate(date).getDay()]?.slice(0, 3)}{' '}
                      <span className="dnum">{fromISODate(date).getDate()}</span>
                    </span>
                    <button
                      className="slot-add"
                      onClick={() => openNew(date)}
                      disabled={data.patients.length === 0}
                      aria-label={`Agregar turno el ${formatDateLong(date)}`}
                      title="Agregar turno"
                    >
                      +
                    </button>
                  </div>
                  {sessions.map((s) => (
                    <button
                      key={s.id}
                      className={`slot ${s.status}${conflicts.has(s.id) ? ' conflict' : ''}`}
                      onClick={() => openEdit(s)}
                      title={conflicts.has(s.id) ? 'Se superpone con otro turno' : STATUS_LABEL[s.status]}
                      style={{ borderLeftColor: patientColor(patientsById.get(s.patientId)?.colorIndex ?? 0).solid }}
                    >
                      <span className="slot-time">{s.time}</span>
                      <span className="slot-name">{patientsById.get(s.patientId)?.name ?? '—'}</span>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </Card>
        </Section>
      )}

      {pendingToClose > 0 && (
        <button className="close-day-btn" onClick={() => setClosingDay(true)}>
          🌙 Cierre del día
          <span className="badge">{pendingToClose}</span>
        </button>
      )}

      <Section
        title={view === 'dia' ? 'Sesiones del día' : `Sesiones del ${formatDateShort(selectedDay)}`}
        action={
          view === 'dia' && (
            <div className="actions">
              <button className="btn small ghost" onClick={() => setSelectedDay(addDays(selectedDay, -1))} aria-label="Día anterior">
                ‹
              </button>
              <span className="small muted cap-first">{formatDateLong(selectedDay)}</span>
              <button className="btn small ghost" onClick={() => setSelectedDay(addDays(selectedDay, 1))} aria-label="Día siguiente">
                ›
              </button>
            </div>
          )
        }
      >
        <Card>
          {daySessions.length === 0 ? (
            <Empty>No hay sesiones este día. Tocá “+ Sesión” para agregar una.</Empty>
          ) : (
            <div className="day-list">
              {daySessions.map((s) => {
                const patient = patientsById.get(s.patientId);
                return (
                  <div
                    key={s.id}
                    className={`day-item ${s.status}`}
                    style={{ ['--pc' as string]: patientColor(patient?.colorIndex ?? 0).solid }}
                  >
                    <span className="day-time">{s.time}</span>
                    <span className="day-who">
                      <strong>{patient?.name ?? '—'}</strong>
                      <span>
                        {formatMoney(s.fee, data.settings.currency)} · {s.durationMin} min
                        {conflicts.has(s.id) ? ' · se pisa con otro turno' : ''}
                      </span>
                    </span>
                    <div className="day-controls">
                      <select
                        value={s.status}
                        onChange={(e) =>
                          dispatch({
                            type: 'session/setStatus',
                            payload: { id: s.id, status: e.target.value as Session['status'] },
                          })
                        }
                        aria-label={`Estado de la sesión de ${patient?.name ?? ''}`}
                      >
                        {(Object.keys(STATUS_LABEL) as Session['status'][]).map((st) => (
                          <option key={st} value={st}>
                            {STATUS_LABEL[st]}
                          </option>
                        ))}
                      </select>
                      {s.status === 'programada' && (
                        <button
                          className="btn small"
                          onClick={() => sendToCalendar(s)}
                          title="Mandar al calendario del teléfono con alarma"
                          aria-label="Mandar al calendario con alarma"
                        >
                          <IconBell />
                        </button>
                      )}
                      <button className="btn small" onClick={() => openEdit(s)}>
                        Editar
                      </button>
                      <ConfirmButton
                        label="Borrar"
                        confirmLabel="¿Borrar esta sesión?"
                        onConfirm={() => dispatch({ type: 'session/remove', payload: { id: s.id } })}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </Section>

      <button
        className="fab"
        onClick={() => openNew(selectedDay)}
        disabled={data.patients.length === 0}
        aria-label="Nueva sesión"
      >
        +
      </button>

      {closingDay && (
        <DayClose
          date={selectedDay}
          sessions={daySessions}
          patientsById={patientsById}
          onClose={() => setClosingDay(false)}
        />
      )}

      {editing && form && (
        <Modal
          title={editing === 'new' ? 'Nuevo turno' : 'Editar turno'}
          onClose={() => {
            setEditing(null);
            setForm(null);
          }}
        >
          <Field label="Paciente *" error={errors.patientId}>
            <select value={form.patientId} onChange={(e) => onPatientChange(e.target.value)}>
              <option value="">— Elegir —</option>
              {activePatients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.status === 'inactivo' ? ' (inactivo)' : ''}
                </option>
              ))}
            </select>
          </Field>
          <div className="field-row">
            <Field label="Fecha *" error={errors.date}>
              <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </Field>
            <Field label="Hora *" error={errors.time}>
              <input type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} />
            </Field>
            <Field label="Duración (min)" error={errors.durationMin}>
              <input
                type="number"
                min={5}
                max={480}
                step={5}
                value={form.durationMin}
                onChange={(e) => setForm({ ...form, durationMin: e.target.value })}
              />
            </Field>
          </div>
          <div className="field-row">
            <Field label="Honorario" error={errors.fee}>
              <input
                inputMode="decimal"
                value={form.fee}
                onChange={(e) => setForm({ ...form, fee: e.target.value })}
                placeholder="0,00"
              />
            </Field>
            <Field label="Estado">
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as Session['status'] })}
              >
                {(Object.keys(STATUS_LABEL) as Session['status'][]).map((st) => (
                  <option key={st} value={st}>
                    {STATUS_LABEL[st]}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          {editing === 'new' && (
            <div className="field-row">
              <Field label="Repetir">
                <select
                  value={form.repeat}
                  onChange={(e) => setForm({ ...form, repeat: e.target.value as Repeat })}
                >
                  {(Object.keys(REPEAT_LABEL) as Repeat[]).map((r) => (
                    <option key={r} value={r}>
                      {REPEAT_LABEL[r]}
                    </option>
                  ))}
                </select>
              </Field>
              {form.repeat !== 'ninguna' && (
                <Field label="¿Cuántas sesiones?" error={errors.repeatCount}>
                  <input
                    type="number"
                    min={1}
                    max={MAX_OCCURRENCES}
                    value={form.repeatCount}
                    onChange={(e) => setForm({ ...form, repeatCount: e.target.value })}
                  />
                </Field>
              )}
            </div>
          )}

          {editing === 'new' && form.repeat !== 'ninguna' && series.length > 1 && (
            <div className="banner info">
              Se van a crear <strong>{series.length} sesiones</strong>, de{' '}
              {formatDateLong(series[0]!)} a {formatDateLong(series[series.length - 1]!)}.
            </div>
          )}

          {form.status === 'ausente' && (
            <div className="field">
              <label style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={form.chargeable}
                  onChange={(e) => setForm({ ...form, chargeable: e.target.checked })}
                  style={{ width: 'auto' }}
                />
                Cobrar esta ausencia
              </label>
            </div>
          )}

          <Field label="Notas">
            <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </Field>

          <SlotWarning
            sessions={data.sessions}
            currentId={editing === 'new' ? null : editing.id}
            date={form.date}
            time={form.time}
            durationMin={Number(form.durationMin)}
          />

          <div className="modal-foot">
            <button
              className="btn"
              onClick={() => {
                setEditing(null);
                setForm(null);
              }}
            >
              Cancelar
            </button>
            <button className="btn primary" onClick={submit}>
              Guardar
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}

/** Avisa (sin bloquear) si el turno que se está cargando se pisa con otro. */
function SlotWarning({
  sessions,
  currentId,
  date,
  time,
  durationMin,
}: {
  sessions: Session[];
  currentId: string | null;
  date: string;
  time: string;
  durationMin: number;
}) {
  const clash = useMemo(() => {
    if (!isValidISODate(date) || !isValidTime(time) || !Number.isFinite(durationMin)) return null;
    const start = timeToMinutes(time);
    return sessions.find(
      (s) =>
        s.id !== currentId &&
        s.date === date &&
        s.status !== 'cancelada' &&
        start < timeToMinutes(s.time) + s.durationMin &&
        timeToMinutes(s.time) < start + durationMin,
    );
  }, [sessions, currentId, date, time, durationMin]);

  if (!clash) return null;
  return <div className="banner warn">Ojo: se superpone con el turno de las {clash.time}.</div>;
}
