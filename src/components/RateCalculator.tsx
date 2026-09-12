import { useMemo, useState } from 'react';
import type { RateInputs } from '../types';
import { useStore } from '../store/StoreContext';
import { suggestedRate, WEEKS_PER_MONTH } from '../lib/pricing';
import { centsToInput, formatMoney, parseMoney } from '../lib/money';
import { Card, Field } from './ui';

/**
 * Calculadora de tarifa. Va al revés de lo intuitivo: no parte del honorario
 * sino de lo que la persona necesita llevarse, y llega a cuánto debería cobrar
 * la sesión para que eso ocurra.
 */
export function RateCalculator() {
  const { data, dispatch } = useStore();
  const currency = data.settings.currency;
  const saved = data.settings.rateInputs;

  const [target, setTarget] = useState(() => centsToInput(saved.targetIncome));
  const [costs, setCosts] = useState(() => centsToInput(saved.fixedCosts));
  const [perWeek, setPerWeek] = useState(() => String(saved.sessionsPerWeek));
  const [tax, setTax] = useState(() => String(saved.taxPercent));
  const [noShow, setNoShow] = useState(() => String(saved.noShowPercent));

  const inputs: RateInputs = useMemo(
    () => ({
      targetIncome: parseMoney(target) ?? 0,
      fixedCosts: parseMoney(costs) ?? 0,
      sessionsPerWeek: Number(perWeek) || 0,
      taxPercent: Number(tax) || 0,
      noShowPercent: Number(noShow) || 0,
    }),
    [target, costs, perWeek, tax, noShow],
  );

  const result = useMemo(() => suggestedRate(inputs), [inputs]);

  return (
    <Card title="¿Cuánto deberías cobrar?">
      <p className="small muted" style={{ marginTop: 0 }}>
        Poné lo que querés llevarte por mes y la calculadora te dice qué tarifa lo sostiene, contando
        gastos, impuestos y las sesiones que se caen.
      </p>

      <div className="field-row">
        <Field label="Quiero llevarme por mes">
          <input inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="0,00" />
        </Field>
        <Field label="Gastos fijos del mes">
          <input inputMode="decimal" value={costs} onChange={(e) => setCosts(e.target.value)} placeholder="0,00" />
        </Field>
      </div>

      <div className="field-row">
        <Field label="Sesiones por semana">
          <input type="number" min={1} max={100} value={perWeek} onChange={(e) => setPerWeek(e.target.value)} />
        </Field>
        <Field label="Impuestos y aportes (%)">
          <input type="number" min={0} max={99} value={tax} onChange={(e) => setTax(e.target.value)} />
        </Field>
        <Field label="Ausencias esperadas (%)">
          <input type="number" min={0} max={99} value={noShow} onChange={(e) => setNoShow(e.target.value)} />
        </Field>
      </div>

      {result ? (
        <>
          <div className="result-box">
            <div className="result-label">Deberías cobrar por sesión</div>
            <div className="result-value">{formatMoney(result.suggestedFee, currency)}</div>
          </div>
          <ul className="small muted breakdown">
            <li>
              Necesitás facturar <strong>{formatMoney(result.monthlyBilling, currency)}</strong> por mes.
            </li>
            <li>
              Con {inputs.sessionsPerWeek} sesiones por semana son{' '}
              <strong>{result.scheduledSessions}</strong> agendadas al mes (
              {WEEKS_PER_MONTH.toFixed(2)} semanas promedio), de las que esperás cobrar{' '}
              <strong>{result.paidSessions}</strong>.
            </li>
          </ul>
          <div className="actions">
            <button
              className="btn"
              onClick={() => dispatch({ type: 'settings/update', payload: { rateInputs: inputs } })}
            >
              Guardar estos datos
            </button>
            <button
              className="btn primary"
              onClick={() =>
                dispatch({
                  type: 'settings/update',
                  payload: { rateInputs: inputs, monthlyGoal: result.monthlyBilling },
                })
              }
            >
              Usar como meta del mes
            </button>
          </div>
        </>
      ) : (
        <p className="small muted" style={{ marginBottom: 0 }}>
          Completá cuánto querés llevarte y cuántas sesiones das por semana para ver la tarifa.
        </p>
      )}
    </Card>
  );
}
