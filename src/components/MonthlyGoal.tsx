import { useState } from 'react';
import type { Cents } from '../types';
import { useStore } from '../store/StoreContext';
import { goalProgress } from '../lib/pricing';
import { centsToInput, formatMoney, parseMoney } from '../lib/money';
import { Card } from './ui';

/** Meta de facturación del mes, con su barra de avance. */
export function MonthlyGoal({ billed }: { billed: Cents }) {
  const { data, dispatch } = useStore();
  const currency = data.settings.currency;
  const goal = data.settings.monthlyGoal;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(() => centsToInput(goal));

  const progress = goalProgress(goal, billed);

  function save() {
    const parsed = parseMoney(draft);
    dispatch({ type: 'settings/update', payload: { monthlyGoal: Math.max(0, parsed ?? 0) } });
    setEditing(false);
  }

  return (
    <Card
      title="Meta del mes"
      action={
        !editing && (
          <button
            className="btn small"
            onClick={() => {
              setDraft(centsToInput(goal));
              setEditing(true);
            }}
          >
            {goal > 0 ? 'Cambiar' : 'Definir meta'}
          </button>
        )
      }
    >
      {editing ? (
        <div className="actions">
          <input
            inputMode="decimal"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="0,00"
            autoFocus
            onKeyDown={(e) => e.key === 'Enter' && save()}
            style={{ maxWidth: 200 }}
          />
          <button className="btn primary" onClick={save}>
            Guardar
          </button>
          <button className="btn" onClick={() => setEditing(false)}>
            Cancelar
          </button>
        </div>
      ) : progress ? (
        <>
          <div className="goal-head">
            <span>
              <strong>{formatMoney(progress.reached, currency)}</strong> de{' '}
              {formatMoney(progress.goal, currency)}
            </span>
            <span className={progress.done ? 'money credit' : 'muted'}>{progress.percent}%</span>
          </div>
          <div className="bar-track" style={{ height: 12 }}>
            <div className={`bar-fill${progress.done ? ' collected' : ''}`} style={{ width: `${progress.percent}%` }} />
          </div>
          <p className="small muted" style={{ marginBottom: 0 }}>
            {progress.done
              ? '¡Llegaste a la meta del mes! 🎉'
              : `Te faltan ${formatMoney(progress.remaining, currency)} para tu meta del mes.`}
          </p>
        </>
      ) : (
        <p className="small muted" style={{ margin: 0 }}>
          Todavía no definiste una meta. La calculadora de abajo puede proponerte una.
        </p>
      )}
    </Card>
  );
}
