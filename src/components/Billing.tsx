import { useMemo, useState } from 'react';
import { useStore } from '../store/StoreContext';
import { billingLine, billingText, invoiceFields } from '../lib/billing';
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
  /** Qué se copió último, para confirmarlo sin un cartel por cada campo. */
  const [copied, setCopied] = useState<string | null>(null);

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

  async function copy(what: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(what);
      window.setTimeout(() => setCopied((c) => (c === what ? null : c)), 1800);
    } catch {
      // Sin permiso de portapapeles quedan los campos para copiar a mano.
      setCopied(null);
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
          title="Datos del paciente"
          action={
            <button
              className="btn small"
              onClick={() =>
                copy(
                  'todos',
                  invoiceFields(selected.patient)
                    .map((f) => `${f.label}: ${f.value}`)
                    .join('\n'),
                )
              }
            >
              {copied === 'todos' ? '✓ Copiado' : 'Copiar todo'}
            </button>
          }
        >
          <p className="small muted" style={{ marginTop: 0 }}>
            Tocá un dato para copiarlo y pegarlo en el formulario de la factura.
          </p>
          <div className="fields-list">
            {invoiceFields(selected.patient).map((f) => (
              <button key={f.label} className="field-row-copy" onClick={() => copy(f.label, f.value)}>
                <span className="field-label">{f.label}</span>
                <span className="field-value">{f.value}</span>
                <span className="field-copy">{copied === f.label ? '✓' : '⧉'}</span>
              </button>
            ))}
          </div>

          <div className="fields-total">
            <span>Total del período</span>
            <strong>{formatMoney(selected.total, currency)}</strong>
          </div>
        </Card>
      )}

      {selected && (
        <Card
          title="Texto para la factura"
          action={
            <button className="btn primary small" onClick={() => copy('texto', text)}>
              {copied === 'texto' ? '✓ Copiado' : 'Copiar'}
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
