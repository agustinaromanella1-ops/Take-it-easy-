import { useMemo } from 'react';
import type { Patient, Session } from '../types';
import { addMonths, formatMonthKey, monthGrid, today } from '../lib/dates';
import { patientColor } from '../lib/palette';

const WEEKDAY_INITIALS = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];

/** Cuántos puntos de color caben en una celda antes de resumir con "+N". */
const MAX_DOTS = 3;

/**
 * Calendario mensual: un vistazo al mes entero, con un punto del color de cada
 * paciente en los días que tienen sesión. Tocar un día lo selecciona para ver
 * el detalle debajo.
 */
export function MonthCalendar({
  month,
  selected,
  sessions,
  patientsById,
  onSelect,
  onMonthChange,
}: {
  /** Mes visible, como "YYYY-MM". */
  month: string;
  selected: string;
  sessions: Session[];
  patientsById: Map<string, Patient>;
  onSelect: (date: string) => void;
  onMonthChange: (month: string) => void;
}) {
  const cells = useMemo(() => monthGrid(`${month}-01`), [month]);

  // Sesiones del mes agrupadas por día, para no recorrer la lista en cada celda.
  const byDate = useMemo(() => {
    const map = new Map<string, Session[]>();
    for (const s of sessions) {
      if (!s.date.startsWith(month) || s.status === 'cancelada') continue;
      const list = map.get(s.date);
      if (list) list.push(s);
      else map.set(s.date, [s]);
    }
    return map;
  }, [sessions, month]);

  const todayISO = today();

  return (
    <div className="month-cal">
      <div className="month-nav">
        <button className="btn small ghost" onClick={() => onMonthChange(addMonths(month, -1))} aria-label="Mes anterior">
          ‹
        </button>
        <strong className="cap-first">{formatMonthKey(month)}</strong>
        <button className="btn small ghost" onClick={() => onMonthChange(addMonths(month, 1))} aria-label="Mes siguiente">
          ›
        </button>
      </div>

      <div className="month-grid" role="grid">
        {WEEKDAY_INITIALS.map((d, i) => (
          <span key={i} className="month-dow" aria-hidden="true">
            {d}
          </span>
        ))}
        {cells.map((date, i) => {
          if (date === null) return <span key={`hueco-${i}`} />;
          const daySessions = byDate.get(date) ?? [];
          const day = Number(date.slice(8));
          const classes = [
            'month-day',
            date === selected ? 'is-selected' : '',
            date === todayISO ? 'is-today' : '',
          ]
            .filter(Boolean)
            .join(' ');
          return (
            <button
              key={date}
              className={classes}
              onClick={() => onSelect(date)}
              aria-pressed={date === selected}
              aria-label={`${day}, ${daySessions.length} sesión(es)`}
            >
              <span className="month-day-num">{day}</span>
              <span className="month-dots">
                {daySessions.slice(0, MAX_DOTS).map((s) => (
                  <i
                    key={s.id}
                    className="mini-dot"
                    style={{ background: patientColor(patientsById.get(s.patientId)?.colorIndex ?? 0).solid }}
                  />
                ))}
                {daySessions.length > MAX_DOTS && (
                  <i className="mini-more">+{daySessions.length - MAX_DOTS}</i>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
