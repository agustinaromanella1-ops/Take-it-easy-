import { useMemo, useState } from 'react';
import { useStore } from '../store/StoreContext';
import { patientAttendance, patientBalances } from '../store/selectors';
import { cobranzaDelMes, totalesDelMes } from '../lib/cobranza';
import { retencionPromedio } from '../lib/neto';
import { addMonths, formatMonthKey, monthKey, today } from '../lib/dates';
import { suggestedRate } from '../lib/pricing';
import { formatMoney } from '../lib/money';
import { Card, Empty } from './ui';
import { CHART_COLORS, ChartRow, Legend, StackedBar } from './charts';

/**
 * Monitoreo: cobranza, asistencia y comparación de honorarios.
 *
 * **La cobranza y la asistencia van mes por mes.** Antes sumaban todo el
 * historial en un solo gráfico, y cobrar el mes vencido —que es lo normal—
 * hacía que las sesiones de octubre aparecieran como deuda mientras se miraba
 * noviembre. Con el mes elegido arriba, cada renglón habla solo de ese mes:
 * `cobranzaDelMes` imputa cada pago a las sesiones que salda, así el pago de
 * noviembre por la sesión de octubre salda octubre y no le baja lo pendiente a
 * noviembre. El porqué largo está en `src/lib/cobranza.ts`.
 *
 * La comparación de honorarios no lleva mes: es la tarifa vigente de cada
 * paciente, que no es un dato del pasado.
 */
export function Monitoring({ onCobrar }: { onCobrar?: (patientId: string) => void }) {
  const { data } = useStore();
  const currency = data.settings.currency;
  const [mes, setMes] = useState(() => monthKey(today()));

  const balances = useMemo(() => patientBalances(data), [data]);
  const attendance = useMemo(() => patientAttendance(data, mes), [data, mes]);

  /** Quién pagó y quién debe de ESE mes, del que más debe al que menos. */
  const collection = useMemo(() => cobranzaDelMes(data, mes), [data, mes]);
  const totales = useMemo(() => totalesDelMes(collection), [collection]);

  /**
   * La deuda acumulada de todos los meses.
   *
   * Va aparte y no adentro del gráfico: el gráfico contesta "cómo viene este
   * mes" y el total contesta "cuánto me deben en total", que son dos preguntas
   * y mezclarlas es lo que estaba mal. Sin este número, dividir por mes
   * escondería una deuda vieja en un mes que nadie va a volver a mirar.
   */
  const deudaTotal = useMemo(
    () => [...balances.values()].reduce((n, b) => n + Math.max(0, b.balance), 0),
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
  // Con la misma retención que usa la calculadora: si no, la línea de
  // referencia del gráfico marcaría un número distinto del que propone la
  // calculadora dos pantallas más abajo.
  const retencion = useMemo(() => retencionPromedio(data, `${addMonths(monthKey(today()), -2)}-01`), [data]);
  const suggested = useMemo(
    () => suggestedRate(data.settings.rateInputs, retencion),
    [data.settings.rateInputs, retencion],
  );
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
      {/* El mes que se está mirando. Va una sola vez arriba y manda sobre la
          cobranza y la asistencia: dos navegadores separados dejarían las dos
          tarjetas hablando de meses distintos sin que se note. */}
      <div className="mes-nav" role="group" aria-label="Mes del monitoreo">
        <button className="btn small" onClick={() => setMes(addMonths(mes, -1))} aria-label="Mes anterior">
          ←
        </button>
        <strong className="cap-first">{formatMonthKey(mes)}</strong>
        <button className="btn small" onClick={() => setMes(addMonths(mes, 1))} aria-label="Mes siguiente">
          →
        </button>
      </div>

      <Card title="Quién pagó y quién debe">
        {collection.length === 0 ? (
          <Empty>No hubo sesiones facturadas en {formatMonthKey(mes).toLowerCase()}.</Empty>
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
                const pending = b.pendiente;
                // Un pago de más no agranda la barra: el tope es lo facturado.
                const paid = Math.min(b.facturado, b.cobrado);
                /*
                 * Tocar la fila abre el cobro con esa persona puesta.
                 *
                 * Esta pantalla es donde se ve quién debe, y hasta ahora era el
                 * único lugar donde verlo no servía para nada: había que
                 * acordarse del nombre, ir a Resumen, abrir "Registrar pago" y
                 * buscarlo en una lista de treinta. Tres pasos para no perder
                 * un dato que ya estaba en pantalla.
                 *
                 * El importe NO se completa solo: se toca justamente porque
                 * alguien pagó "algún monto", que casi nunca es el saldo
                 * entero. Para ese caso el formulario ya tiene su botón de
                 * "usar saldo total", que es un toque y no hay que borrar nada.
                 */
                const cobrar = onCobrar
                  ? {
                      onClick: () => onCobrar(b.patient.id),
                      accion:
                        pending > 0
                          ? `Registrar un cobro de ${b.patient.name}, que debe ${formatMoney(pending, currency)}`
                          : `Registrar un cobro de ${b.patient.name}, que está al día`,
                    }
                  : {};
                return (
                  <ChartRow
                    key={b.patient.id}
                    name={b.patient.name}
                    {...cobrar}
                    value={
                      pending > 0 ? (
                        <span className="money debt">{formatMoney(pending, currency)}</span>
                      ) : (
                        <span className="muted">al día</span>
                      )
                    }
                  >
                    <StackedBar
                      total={b.facturado}
                      title={`${b.patient.name}: cobrado ${formatMoney(paid, currency)} de ${formatMoney(b.facturado, currency)} de ${formatMonthKey(mes).toLowerCase()}`}
                      segments={[
                        { label: 'Cobrado', value: paid, color: CHART_COLORS.primary },
                        { label: 'Pendiente', value: pending, color: CHART_COLORS.attention },
                      ]}
                    />
                  </ChartRow>
                );
              })}
            </div>
            <p className="ref-note">
              De {formatMonthKey(mes).toLowerCase()} facturaste{' '}
              <strong>{formatMoney(totales.facturado, currency)}</strong> y ya cobraste{' '}
              <strong>{formatMoney(totales.cobrado, currency)}</strong>. Un pago cuenta en el mes de la
              sesión que salda, no en el mes en que entró.
            </p>
            {deudaTotal > totales.pendiente && (
              <p className="ref-note">
                Sumando todos los meses, te deben{' '}
                <strong className="money debt">{formatMoney(deudaTotal, currency)}</strong>.
              </p>
            )}
            {onCobrar && (
              <p className="ref-note">Tocá a alguien para registrarle un cobro.</p>
            )}
          </>
        )}
      </Card>

      <Card title="Asistencia">
        {attendanceRows.length === 0 ? (
          <Empty>No hay sesiones cerradas en {formatMonthKey(mes).toLowerCase()}.</Empty>
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
              De {formatMonthKey(mes).toLowerCase()}. El porcentaje cuenta solo sesiones que ya
              ocurrieron: las todavía programadas no bajan la asistencia de nadie, y un turno movido de
              día tampoco.
            </p>
          </>
        )}
      </Card>

      {/* Sin mes a propósito: es la tarifa que cobra hoy cada paciente, no lo
          que cobró en un mes. El texto de abajo lo dice para que no se lea
          como si fuera del mes elegido arriba. */}
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
                Es el honorario vigente de cada paciente, no el del mes elegido arriba. La línea gris
                marca los {formatMoney(reference, currency)} que sugiere la calculadora; en ámbar, los
                que quedaron por debajo.
              </p>
            ) : (
              <p className="ref-note">
                Es el honorario vigente de cada paciente, no el del mes elegido arriba. Completá la
                calculadora de tarifa para compararlos con lo que deberías cobrar.
              </p>
            )}
          </>
        )}
      </Card>
    </>
  );
}
