import { useMemo, useState } from 'react';
import { useStore } from '../store/StoreContext';
import { cuentasPorPaciente } from '../lib/cobranza';
import { formatMonthKey } from '../lib/dates';
import { formatMoney } from '../lib/money';
import { patientColor } from '../lib/palette';
import { plural } from '../lib/plural';
import { Card, Empty } from './ui';

/**
 * La cuenta de cada paciente, mes por mes.
 *
 * Contesta la pregunta que ninguna otra pantalla contestaba: cuando entra un
 * depósito, de qué mes era. El monitoreo dice cómo viene un mes y la ficha del
 * paciente dice cuánto debe en total, pero para saber si lo que pagó era de
 * octubre o de noviembre había que cruzar las dos a ojo.
 *
 * Cada paciente viene plegado y con su saldo en el título: lo que se busca
 * casi siempre es una sola persona —la que acaba de depositar—, y veinte
 * tablas abiertas de una son el mismo problema que la pantalla no tener nada.
 * Los que deben vienen primero, porque es una lista para reclamar.
 *
 * El reparto de los pagos entre meses lo hace `src/lib/cobranza.ts`, que tiene
 * el porqué largo: un pago cuenta en el mes de la sesión que salda, no en el
 * mes en que entró.
 */
export function Cuentas({ onCobrar }: { onCobrar?: (patientId: string) => void }) {
  const { data } = useStore();
  const moneda = data.settings.currency;
  const cuentas = useMemo(() => cuentasPorPaciente(data), [data]);
  /** Solo los que deben, para cuando la lista se hace larga. */
  const [soloDeudores, setSoloDeudores] = useState(false);

  const visibles = soloDeudores ? cuentas.filter((c) => c.debe > 0) : cuentas;
  const conDeuda = cuentas.filter((c) => c.debe > 0).length;

  if (cuentas.length === 0) {
    return (
      <Card>
        <Empty>Cargá sesiones y cobros para ver la cuenta de cada paciente.</Empty>
      </Card>
    );
  }

  return (
    <Card title="La cuenta de cada paciente">
      <p className="small muted" style={{ marginTop: 0 }}>
        Mes por mes, lo que facturó y lo que ya pagó. Un pago cuenta en el mes de la sesión que
        salda, así se ve si lo que depositó era de este mes o de uno anterior.
      </p>

      {conDeuda > 0 && (
        <div className="actions" style={{ marginBottom: 14 }}>
          <button
            className={`btn small${soloDeudores ? ' is-on' : ''}`}
            aria-pressed={soloDeudores}
            onClick={() => setSoloDeudores(!soloDeudores)}
          >
            Solo los que deben ({conDeuda})
          </button>
        </div>
      )}

      {visibles.length === 0 ? (
        <Empty>No te debe nadie. 🎉</Empty>
      ) : (
        visibles.map((c) => (
          <details key={c.patient.id} className="plegable cuenta">
            <summary>
              <span className="dot" style={{ background: patientColor(c.patient.colorIndex).solid }} />
              <span className="cuenta-nombre">{c.patient.name}</span>
              {/* El saldo va en el título plegado: es el dato que se viene a
                  buscar, y abrir veinte para encontrarlo sería absurdo. */}
              <span className="cuenta-saldo">
                {c.debe > 0 ? (
                  <span className="money debt">{formatMoney(c.debe, moneda)}</span>
                ) : c.aFavor > 0 ? (
                  <span className="money credit">{formatMoney(c.aFavor, moneda)} a favor</span>
                ) : (
                  <span className="muted">al día</span>
                )}
              </span>
            </summary>

            <div className="plegable-cuerpo">
              {c.meses.length === 0 ? (
                <p className="small muted" style={{ margin: 0 }}>
                  Todavía no tiene sesiones facturadas.
                </p>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Mes</th>
                        <th className="num">Facturado</th>
                        <th className="num">Pagó</th>
                        <th className="num">Debe</th>
                      </tr>
                    </thead>
                    <tbody>
                      {c.meses.map((m) => (
                        <tr key={m.mes}>
                          <td className="cap-first">
                            {formatMonthKey(m.mes)}
                            <span className="cuenta-sesiones">
                              {plural(m.sesiones, 'sesión', 'sesiones')}
                            </span>
                          </td>
                          <td className="num">{formatMoney(m.facturado, moneda)}</td>
                          <td className="num">{formatMoney(m.cobrado, moneda)}</td>
                          <td className="num">
                            {m.pendiente > 0 ? (
                              <span className="money debt">{formatMoney(m.pendiente, moneda)}</span>
                            ) : (
                              <span className="muted">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td>
                          <strong>Total</strong>
                        </td>
                        <td className="num">
                          <strong>{formatMoney(c.facturado, moneda)}</strong>
                        </td>
                        <td className="num">
                          <strong>{formatMoney(c.cobrado, moneda)}</strong>
                        </td>
                        <td className="num">
                          <strong>
                            {c.debe > 0 ? (
                              <span className="money debt">{formatMoney(c.debe, moneda)}</span>
                            ) : (
                              <span className="muted">—</span>
                            )}
                          </strong>
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}

              {/* La plata que entró y todavía no tiene sesión que saldar. Si no
                  se dijera, un pago adelantado parecería no haberse registrado. */}
              {c.aFavor > 0 && (
                <p className="small muted" style={{ marginBottom: 0 }}>
                  Pagó {formatMoney(c.aFavor, moneda)} de más: queda a favor para las próximas
                  sesiones.
                </p>
              )}

              {onCobrar && (
                <div className="actions" style={{ marginTop: 12 }}>
                  <button className="btn small" onClick={() => onCobrar(c.patient.id)}>
                    Registrar un cobro
                  </button>
                </div>
              )}
            </div>
          </details>
        ))
      )}
    </Card>
  );
}
