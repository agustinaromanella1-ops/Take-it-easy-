import { useMemo } from 'react';
import { useStore } from '../store/StoreContext';
import { patientAttendance, patientBalances } from '../store/selectors';
import { suggestedRate } from '../lib/pricing';
import { formatMoney } from '../lib/money';
import { Card, Empty } from './ui';
import { CHART_COLORS, ChartRow, Legend, StackedBar } from './charts';

/** Monitoreo general: cobranza, asistencia y comparación de honorarios. */
export function Monitoring() {
  const { data } = useStore();
  const currency = data.settings.currency;

  const balances = useMemo(() => patientBalances(data), [data]);
  const attendance = useMemo(() => patientAttendance(data), [data]);

  /** Quién pagó y quién debe, del que más debe al que menos. */
  const collection = useMemo(
    () =>
      [...balances.values()]
        .filter((b) => b.billed > 0)
        .sort((a, b) => b.balance - a.balance || b.billed - a.billed),
    [balances],
  );

  const attendanceRows = useMemo(
    () => [...attendance.values()].filter((a) => a.closed > 0).sort((a, b) => (a.rate ?? 0) - (b.rate ?? 0)),
    [attendance],
  );

  /** Honorarios vigentes, para comparar precios entre pacientes. */
  const fees = useMemo(
    () =>
      data.patients
        .filter((p) => p.status === 'activo' && p.defaultFee > 0)
        .sort((a, b) => b.defaultFee - a.defaultFee),
    [data.patients],
  );
  const maxFee = fees[0]?.defaultFee ?? 0;

  // La tarifa sugerida sirve de vara: muestra qué pacientes quedaron atrás.
  const suggested = useMemo(() => suggestedRate(data.settings.rateInputs), [data.settings.rateInputs]);
  const reference = suggested?.suggestedFee ?? 0;

  if (data.patients.length === 0) {
    return (
      <Card>
        <Empty>Cargá pacientes y sesiones para ver el monitoreo.</Empty>
      </Card>
    );
  }

  return (
    <>
      <Card title="Quién pagó y quién debe">
        {collection.length === 0 ? (
          <Empty>Todavía no hay sesiones facturadas.</Empty>
        ) : (
          <>
            <Legend
              items={[
                { label: 'Cobrado', color: CHART_COLORS.primary },
                { label: 'Pendiente', color: CHART_COLORS.attention },
              ]}
            />
            <div style={{ marginTop: 12 }}>
              {collection.map((b) => {
                const pending = Math.max(0, b.balance);
                // Un pago de más no agranda la barra: el tope es lo facturado.
                const paid = Math.min(b.billed, b.paid);
                return (
                  <ChartRow
                    key={b.patient.id}
                    name={b.patient.name}
                    value={
                      pending > 0 ? (
                        <span className="money debt">{formatMoney(pending, currency)}</span>
                      ) : (
                        <span className="muted">al día</span>
                      )
                    }
                  >
                    <StackedBar
                      total={b.billed}
                      title={`${b.patient.name}: cobrado ${formatMoney(paid, currency)} de ${formatMoney(b.billed, currency)}`}
                      segments={[
                        { label: 'Cobrado', value: paid, color: CHART_COLORS.primary },
                        { label: 'Pendiente', value: pending, color: CHART_COLORS.attention },
                      ]}
                    />
                  </ChartRow>
                );
              })}
            </div>
          </>
        )}
      </Card>

      <Card title="Asistencia">
        {attendanceRows.length === 0 ? (
          <Empty>Todavía no hay sesiones cerradas para medir asistencia.</Empty>
        ) : (
          <>
            <Legend
              items={[
                { label: 'Realizadas', color: CHART_COLORS.primary },
                { label: 'Ausencias', color: CHART_COLORS.attention },
                { label: 'Canceladas', color: CHART_COLORS.neutral },
              ]}
            />
            <div style={{ marginTop: 12 }}>
              {attendanceRows.map((a) => (
                <ChartRow
                  key={a.patient.id}
                  name={a.patient.name}
                  value={<span>{a.rate}%</span>}
                >
                  <StackedBar
                    total={a.closed}
                    title={`${a.patient.name}: ${a.held} realizadas, ${a.absent} ausencias, ${a.cancelled} canceladas`}
                    segments={[
                      { label: 'Realizadas', value: a.held, color: CHART_COLORS.primary, caption: String(a.held) },
                      { label: 'Ausencias', value: a.absent, color: CHART_COLORS.attention, caption: String(a.absent) },
                      { label: 'Canceladas', value: a.cancelled, color: CHART_COLORS.neutral, caption: String(a.cancelled) },
                    ]}
                  />
                </ChartRow>
              ))}
            </div>
            <p className="ref-note">
              El porcentaje cuenta solo sesiones que ya ocurrieron. Las todavía programadas no bajan la
              asistencia de nadie.
            </p>
          </>
        )}
      </Card>

      <Card title="Comparación de honorarios">
        {fees.length === 0 ? (
          <Empty>Ningún paciente activo tiene honorario cargado.</Empty>
        ) : (
          <>
            {fees.map((p) => (
              <ChartRow
                key={p.id}
                name={p.name}
                value={formatMoney(p.defaultFee, currency)}
              >
                <div
                  className={reference > 0 && reference <= maxFee ? 'bar-ref' : undefined}
                  style={{ ['--ref' as string]: `${(reference / maxFee) * 100}%` }}
                >
                  <StackedBar
                    total={maxFee}
                    title={`${p.name}: ${formatMoney(p.defaultFee, currency)} por sesión`}
                    segments={[
                      {
                        label: p.name,
                        value: p.defaultFee,
                        // Debajo de la tarifa sugerida se marca en ámbar: es la
                        // señal de que a ese paciente le quedó atrasado el valor.
                        color: reference > 0 && p.defaultFee < reference ? CHART_COLORS.attention : CHART_COLORS.primary,
                      },
                    ]}
                  />
                </div>
              </ChartRow>
            ))}
            {reference > 0 ? (
              <p className="ref-note">
                La línea gris marca los {formatMoney(reference, currency)} que sugiere la calculadora. En
                ámbar, los honorarios que quedaron por debajo.
              </p>
            ) : (
              <p className="ref-note">
                Completá la calculadora de tarifa para comparar estos valores contra lo que deberías cobrar.
              </p>
            )}
          </>
        )}
      </Card>
    </>
  );
}
