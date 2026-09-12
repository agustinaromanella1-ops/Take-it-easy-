import { useMemo, useState } from 'react';
import { useStore } from '../store/StoreContext';
import { billingLine, billingText } from '../lib/billing';
import { formatMoney } from '../lib/money';
import { addMonths, daysInMonth, formatMonthKey, monthKey, today } from '../lib/dates';
import { patientColor } from '../lib/palette';
import { Card, Empty, Field } from './ui';

/**
 * Facturación: arma el texto de la factura listo para copiar y pegar.
 *
 * No emite facturas ni se conecta a AFIP: junta los datos que ya están cargados
 * y los deja escritos, que es la parte tediosa de facturar a mano.
 */
export function Billing() {
  const { data, dispatch } = useStore();
  const currency = data.settings.currency;

  const [month, setMonth] = useState(() => monthKey(today()));
  const [patientId, setPatientId] = useState<string>('');
  const [copied, setCopied] = useState(false);

  const from = `${month}-01`;
  const to = `${month}-${String(daysInMonth(from)).padStart(2, '0')}`;

  const patients = useMemo(
    () => [...data.patients].sort((a, b) => a.name.localeCompare(b.name, 'es')),
    [data.patients],
  );

  /** Lo facturable del mes, por paciente. Los que no tienen nada no aparecen. */
  const lines = useMemo(
    () =>
      patients
        .map((p) => billingLine(p, data.sessions, from, to))
        .filter((l) => l.sessions.length > 0),
    [patients, data.sessions, from, to],
  );

  const selected = patientId === '' ? null : lines.find((l) => l.patient.id === patientId) ?? null;
  const text = selected
    ? billingText(selected, { profession: data.settings.profession, currency })
    : '';

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Sin permiso de portapapeles queda el textarea para copiar a mano.
      setCopied(false);
    }
  }

  return (
    <>
      <Card title="Período">
        <div className="actions">
          <button className="btn small ghost" onClick={() => setMonth(addMonths(month, -1))} aria-label="Mes anterior">
            ‹
          </button>
          <strong className="cap-first" style={{ minWidth: 150, textAlign: 'center' }}>
            {formatMonthKey(month)}
          </strong>
          <button className="btn small ghost" onClick={() => setMonth(addMonths(month, 1))} aria-label="Mes siguiente">
            ›
          </button>
        </div>

        {lines.length === 0 ? (
          <Empty>No hay sesiones facturables en este mes.</Empty>
        ) : (
          <div className="bill-list">
            {lines.map((l) => (
              <button
                key={l.patient.id}
                className={`bill-item${l.patient.id === patientId ? ' is-selected' : ''}`}
                onClick={() => setPatientId(l.patient.id === patientId ? '' : l.patient.id)}
                style={{ ['--pc' as string]: patientColor(l.patient.colorIndex).solid }}
              >
                <span className="bill-who">
                  <strong>{l.patient.name}</strong>
                  <span>
                    {l.sessions.length} sesión(es)
                    {l.patient.insurer ? ` · ${l.patient.insurer}` : ''}
                  </span>
                </span>
                <span className="bill-total">{formatMoney(l.total, currency)}</span>
              </button>
            ))}
          </div>
        )}
      </Card>

      {selected && (
        <Card
          title="Texto para la factura"
          action={
            <button className="btn primary small" onClick={copy}>
              {copied ? '✓ Copiado' : 'Copiar'}
            </button>
          }
        >
          {/* Editable: cada obra social pide el texto a su manera, y retocarlo
              acá antes de copiar es más rápido que hacerlo en el otro sistema. */}
          <textarea
            className="bill-text"
            value={text}
            readOnly
            rows={5}
            onFocus={(e) => e.currentTarget.select()}
            aria-label="Texto sugerido para la factura"
          />

          {(selected.patient.document === '' && selected.patient.memberNumber === '') && (
            <div className="banner warn" style={{ marginTop: 12, marginBottom: 0 }}>
              Este paciente no tiene DNI ni número de afiliado cargado, así que el texto sale sin ese
              dato. Se cargan desde la ficha del paciente.
            </div>
          )}
        </Card>
      )}

      <Card title="Tu profesión">
        <p className="small muted" style={{ marginTop: 0 }}>
          Es la palabra que aparece en “Honorarios por sesión de…”.
        </p>
        <Field label="Profesión">
          <input
            value={data.settings.profession}
            onChange={(e) => dispatch({ type: 'settings/update', payload: { profession: e.target.value } })}
            placeholder="psicología"
          />
        </Field>
      </Card>
    </>
  );
}
