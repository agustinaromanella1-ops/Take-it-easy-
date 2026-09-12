import { useMemo, useState } from 'react';
import type { Payment } from '../types';
import { useStore } from '../store/StoreContext';
import { emptyMonthSummary, monthlySummaries, patientBalances } from '../store/selectors';
import { formatMoney, parseMoney } from '../lib/money';
import { addMonths, formatDateShort, formatMonthKey, isValidISODate, monthKey, today } from '../lib/dates';
import { Card, ConfirmButton, Empty, Field, Modal, Stat } from '../components/ui';
import { MonthlyGoal } from '../components/MonthlyGoal';
import { RateCalculator } from '../components/RateCalculator';

const METHODS: Payment['method'][] = ['efectivo', 'transferencia', 'tarjeta', 'otro'];

export function FinancePage() {
  const { data, dispatch } = useStore();
  const [month, setMonth] = useState(() => monthKey(today()));
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ patientId: '', date: today(), amount: '', method: 'efectivo' as Payment['method'], notes: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const currency = data.settings.currency;
  const patientsById = useMemo(() => new Map(data.patients.map((p) => [p.id, p])), [data.patients]);
  const balances = useMemo(() => patientBalances(data), [data]);
  const months = useMemo(() => monthlySummaries(data), [data]);
  const summary = months.get(month) ?? emptyMonthSummary(month);

  const monthPayments = useMemo(
    () =>
      data.payments
        .filter((p) => monthKey(p.date) === month)
        .sort((a, b) => (a.date === b.date ? 0 : a.date < b.date ? 1 : -1)),
    [data.payments, month],
  );

  /** Últimos 6 meses con actividad o no, para el gráfico comparativo. */
  const recentMonths = useMemo(() => {
    const keys: string[] = [];
    for (let i = 5; i >= 0; i--) keys.push(addMonths(month, -i));
    return keys.map((k) => months.get(k) ?? emptyMonthSummary(k));
  }, [months, month]);

  const maxBar = useMemo(
    () => Math.max(1, ...recentMonths.flatMap((m) => [m.billed, m.collected])),
    [recentMonths],
  );

  const debtors = useMemo(
    () => [...balances.values()].filter((b) => b.balance > 0).sort((a, b) => b.balance - a.balance),
    [balances],
  );
  const totalDebt = useMemo(() => debtors.reduce((n, b) => n + b.balance, 0), [debtors]);

  function openAdd(patientId = '') {
    setForm({ patientId, date: today(), amount: '', method: 'efectivo', notes: '' });
    setErrors({});
    setAdding(true);
  }

  function submit() {
    const next: Record<string, string> = {};
    if (!form.patientId || !patientsById.has(form.patientId)) next.patientId = 'Elegí un paciente.';
    if (!isValidISODate(form.date)) next.date = 'Fecha inválida.';
    const amount = parseMoney(form.amount);
    if (amount === null) next.amount = 'Importe inválido.';
    else if (amount <= 0) next.amount = 'El importe tiene que ser mayor a cero.';

    setErrors(next);
    if (Object.keys(next).length > 0) return;

    dispatch({
      type: 'payment/add',
      payload: {
        patientId: form.patientId,
        date: form.date,
        amount: amount ?? 0,
        method: form.method,
        notes: form.notes.trim(),
      },
    });
    setAdding(false);
  }

  const pendingThisMonth = summary.billed - summary.collected;

  return (
    <>
      <div className="page-head">
        <h1>Finanzas</h1>
        <div className="actions">
          <button className="btn small" onClick={() => setMonth(addMonths(month, -1))} aria-label="Mes anterior">
            ←
          </button>
          <strong className="cap-first" style={{ minWidth: 150, textAlign: 'center' }}>
            {formatMonthKey(month)}
          </strong>
          <button className="btn small" onClick={() => setMonth(addMonths(month, 1))} aria-label="Mes siguiente">
            →
          </button>
          <button
            className="btn primary hide-mobile"
            onClick={() => openAdd()}
            disabled={data.patients.length === 0}
          >
            + Registrar pago
          </button>
        </div>
      </div>

      <div className="stat-grid">
        <Stat label="Facturado del mes" value={formatMoney(summary.billed, currency)} hint={`${summary.sessionsHeld} sesión(es) realizada(s)`} />
        <Stat label="Cobrado del mes" value={formatMoney(summary.collected, currency)} tone="ok" hint={`${monthPayments.length} pago(s)`} />
        <Stat
          label="Diferencia del mes"
          value={formatMoney(pendingThisMonth, currency)}
          tone={pendingThisMonth > 0 ? 'warn' : undefined}
          hint={pendingThisMonth > 0 ? 'Facturado sin cobrar' : 'Al día'}
        />
        <Stat
          label="Deuda acumulada"
          value={formatMoney(totalDebt, currency)}
          tone={totalDebt > 0 ? 'danger' : 'ok'}
          hint={`${debtors.length} paciente(s) con saldo`}
        />
      </div>

      <MonthlyGoal billed={summary.billed} />

      <Card title="Últimos 6 meses">
        {recentMonths.map((m) => (
          <div key={m.key}>
            <div className="bar-row">
              <span className="muted small cap-first">{formatMonthKey(m.key)}</span>
              <div className="bar-track">
                <div className="bar-fill" style={{ width: `${(m.billed / maxBar) * 100}%` }} />
              </div>
              <span className="small" style={{ minWidth: 110, textAlign: 'right' }}>
                {formatMoney(m.billed, currency)}
              </span>
            </div>
            <div className="bar-row">
              <span />
              <div className="bar-track">
                <div className="bar-fill collected" style={{ width: `${(m.collected / maxBar) * 100}%` }} />
              </div>
              <span className="small muted" style={{ minWidth: 110, textAlign: 'right' }}>
                {formatMoney(m.collected, currency)}
              </span>
            </div>
          </div>
        ))}
        <p className="small muted" style={{ marginBottom: 0 }}>
          Barra azul: facturado. Barra verde: efectivamente cobrado.
        </p>
      </Card>

      <Card title="Saldos pendientes">
        {debtors.length === 0 ? (
          <Empty>No hay deudas pendientes. 🎉</Empty>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Paciente</th>
                  <th className="num">Facturado</th>
                  <th className="num">Pagado</th>
                  <th className="num">Debe</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {debtors.map((b) => (
                  <tr key={b.patient.id}>
                    <td>{b.patient.name}</td>
                    <td className="num">{formatMoney(b.billed, currency)}</td>
                    <td className="num">{formatMoney(b.paid, currency)}</td>
                    <td className="num">
                      <span className="money debt">{formatMoney(b.balance, currency)}</span>
                    </td>
                    <td>
                      <button className="btn small" onClick={() => openAdd(b.patient.id)}>
                        Registrar pago
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <RateCalculator />

      <Card title={`Pagos de ${formatMonthKey(month)}`}>
        {monthPayments.length === 0 ? (
          <Empty>No hay pagos registrados en este mes.</Empty>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Paciente</th>
                  <th>Medio</th>
                  <th>Notas</th>
                  <th className="num">Importe</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {monthPayments.map((p) => (
                  <tr key={p.id}>
                    <td className="small">{formatDateShort(p.date)}</td>
                    <td>{patientsById.get(p.patientId)?.name ?? '—'}</td>
                    <td className="small muted cap-first">{p.method}</td>
                    <td className="small muted">{p.notes || '—'}</td>
                    <td className="num">{formatMoney(p.amount, currency)}</td>
                    <td>
                      <ConfirmButton
                        label="Borrar"
                        confirmLabel="¿Borrar este pago?"
                        onConfirm={() => dispatch({ type: 'payment/remove', payload: { id: p.id } })}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <button
        className="fab"
        onClick={() => openAdd()}
        disabled={data.patients.length === 0}
        aria-label="Registrar pago"
      >
        +
      </button>

      {adding && (
        <Modal title="Registrar pago" onClose={() => setAdding(false)}>
          <Field label="Paciente *" error={errors.patientId}>
            <select value={form.patientId} onChange={(e) => setForm({ ...form, patientId: e.target.value })}>
              <option value="">— Elegir —</option>
              {[...data.patients]
                .sort((a, b) => a.name.localeCompare(b.name, 'es'))
                .map((p) => {
                  const debt = balances.get(p.id)?.balance ?? 0;
                  return (
                    <option key={p.id} value={p.id}>
                      {p.name}
                      {debt > 0 ? ` — debe ${formatMoney(debt, currency)}` : ''}
                    </option>
                  );
                })}
            </select>
          </Field>
          <div className="field-row">
            <Field label="Fecha *" error={errors.date}>
              <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </Field>
            <Field label="Importe *" error={errors.amount}>
              <input
                inputMode="decimal"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                placeholder="0,00"
              />
            </Field>
          </div>
          {form.patientId && (balances.get(form.patientId)?.balance ?? 0) > 0 && (
            <button
              className="btn small"
              style={{ marginBottom: 12 }}
              onClick={() => {
                const debt = balances.get(form.patientId)?.balance ?? 0;
                setForm({ ...form, amount: `${Math.floor(debt / 100)}.${(debt % 100).toString().padStart(2, '0')}` });
              }}
            >
              Usar saldo total ({formatMoney(balances.get(form.patientId)?.balance ?? 0, currency)})
            </button>
          )}
          <div className="field-row">
            <Field label="Medio de pago">
              <select
                value={form.method}
                onChange={(e) => setForm({ ...form, method: e.target.value as Payment['method'] })}
              >
                {METHODS.map((m) => (
                  <option key={m} value={m} style={{ textTransform: 'capitalize' }}>
                    {m}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Notas">
              <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </Field>
          </div>
          <div className="modal-foot">
            <button className="btn" onClick={() => setAdding(false)}>
              Cancelar
            </button>
            <button className="btn primary" onClick={submit}>
              Guardar pago
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
