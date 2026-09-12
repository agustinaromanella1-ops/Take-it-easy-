import { useMemo, useState } from 'react';
import type { Frequency, Patient, PatientKind } from '../types';
import { useStore } from '../store/StoreContext';
import { patientBalances } from '../store/selectors';
import { centsToInput, formatMoney, parseMoney } from '../lib/money';
import { formatDateShort, today } from '../lib/dates';
import { ConfirmButton, Empty, Field, Modal } from '../components/ui';
import { nextFreeColor, PATIENT_COLORS, patientColor } from '../lib/palette';
import { whatsappLink } from '../lib/contact';

interface FormState {
  name: string;
  email: string;
  phone: string;
  fee: string;
  status: Patient['status'];
  colorIndex: number;
  frequency: Frequency;
  kind: PatientKind;
  notes: string;
}

export const KIND_LABEL: Record<PatientKind, string> = {
  particular: 'Particular',
  institucion: 'Institución',
  evaluacion: 'Evaluación',
};

const FREQUENCY_LABEL: Record<Frequency, string> = {
  semanal: 'Semanal',
  quincenal: 'Quincenal',
  mensual: 'Mensual',
  puntual: 'Puntual',
};

function toForm(p: Patient): FormState {
  return {
    name: p.name,
    email: p.email,
    phone: p.phone,
    fee: centsToInput(p.defaultFee),
    status: p.status,
    colorIndex: p.colorIndex,
    frequency: p.frequency,
    kind: p.kind,
    notes: p.notes,
  };
}

export function PatientsPage({ onOpenPatient }: { onOpenPatient: (id: string) => void }) {
  const { data, dispatch } = useStore();
  const [editing, setEditing] = useState<Patient | 'new' | null>(null);
  // El estado inicial no se usa: openNew() y openEdit() siempre lo reemplazan
  // antes de que el formulario se muestre.
  const [form, setForm] = useState<FormState>(() => ({
    name: '',
    email: '',
    phone: '',
    fee: '',
    status: 'activo',
    colorIndex: 0,
    frequency: 'semanal',
    kind: 'particular',
    notes: '',
  }));
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [query, setQuery] = useState('');
  const [showInactive, setShowInactive] = useState(false);

  const balances = useMemo(() => patientBalances(data), [data]);

  // Porcentaje de sesiones que se caen por paciente: de las que ya pasaron,
  // cuántas terminaron canceladas o en ausencia. Sirve para ver de un vistazo
  // con quién conviene hablar de la política de cancelaciones.
  const cancelRate = useMemo(() => {
    const counts = new Map<string, { total: number; caidas: number }>();
    for (const s of data.sessions) {
      if (s.status === 'programada') continue;
      const c = counts.get(s.patientId) ?? { total: 0, caidas: 0 };
      c.total += 1;
      if (s.status === 'cancelada' || s.status === 'ausente') c.caidas += 1;
      counts.set(s.patientId, c);
    }
    const rates = new Map<string, number>();
    for (const [id, c] of counts) rates.set(id, Math.round((c.caidas / c.total) * 100));
    return rates;
  }, [data.sessions]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return data.patients
      .filter((p) => (showInactive ? true : p.status === 'activo'))
      .filter((p) => q === '' || p.name.toLowerCase().includes(q) || p.email.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name, 'es'));
  }, [data.patients, query, showInactive]);

  function openNew() {
    setForm({
      name: '',
      email: '',
      phone: '',
      fee: '',
      status: 'activo',
      // Se propone un color que todavía no use nadie, para que no se repitan.
      colorIndex: nextFreeColor(data.patients.map((p) => p.colorIndex)),
      frequency: 'semanal',
      kind: 'particular',
      notes: '',
    });
    setErrors({});
    setEditing('new');
  }

  function openEdit(p: Patient) {
    setForm(toForm(p));
    setErrors({});
    setEditing(p);
  }

  function submit() {
    const next: Partial<Record<keyof FormState, string>> = {};
    const name = form.name.trim();
    if (name === '') next.name = 'El nombre es obligatorio.';
    if (form.email.trim() !== '' && !form.email.includes('@')) next.email = 'Email inválido.';

    const fee = form.fee.trim() === '' ? 0 : parseMoney(form.fee);
    if (fee === null) next.fee = 'Importe inválido.';
    else if (fee < 0) next.fee = 'El honorario no puede ser negativo.';

    setErrors(next);
    if (Object.keys(next).length > 0) return;

    const fields = {
      name,
      email: form.email.trim(),
      phone: form.phone.trim(),
      defaultFee: fee ?? 0,
      status: form.status,
      colorIndex: form.colorIndex,
      frequency: form.frequency,
      kind: form.kind,
      notes: form.notes.trim(),
    };

    if (editing === 'new') {
      dispatch({ type: 'patient/add', payload: { ...fields, lastRaise: fields.defaultFee > 0 ? today() : null } });
    }
    else if (editing) dispatch({ type: 'patient/update', payload: { ...editing, ...fields } });
    setEditing(null);
  }

  return (
    <>
      <div className="page-head">
        <h1>Pacientes</h1>
      </div>

      <div className="filters">
        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor="buscar">Buscar</label>
          <input
            id="buscar"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Nombre o email"
          />
        </div>
        <label className="check-inline">
          <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
          Mostrar inactivos
        </label>
      </div>

        <div className="section-head">
          <h2>{showInactive ? 'Todos los pacientes' : 'Pacientes activos'}</h2>
          <button className="btn primary small hide-mobile" onClick={openNew}>
            + Nuevo
          </button>
        </div>
        {rows.length === 0 ? (
          <Empty>
            {data.patients.length === 0
              ? 'Todavía no cargaste ningún paciente.'
              : 'Ningún paciente coincide con la búsqueda.'}
          </Empty>
        ) : (
          <div className="patient-grid">
            {rows.map((p) => {
              const b = balances.get(p.id);
              const balance = b?.balance ?? 0;
              const color = patientColor(p.colorIndex);
              const wapp = whatsappLink(p.phone, `Hola ${p.name.split(' ')[0] ?? ''}, ¿cómo estás?`);
              return (
                <article
                  key={p.id}
                  className={`patient-card${p.status === 'inactivo' ? ' is-inactive' : ''}`}
                  style={{ ['--pc' as string]: color.solid }}
                >
                  <div className="patient-top">
                    <button className="patient-name" onClick={() => onOpenPatient(p.id)}>
                      {p.name}
                    </button>
                    <span className="patient-fee">{formatMoney(p.defaultFee, data.settings.currency)}</span>
                  </div>
                  <p className="patient-sub">
                    {KIND_LABEL[p.kind]} · {FREQUENCY_LABEL[p.frequency].toLowerCase()}
                    {p.status === 'inactivo' ? ' · inactivo' : ''}
                  </p>

                  <div className="patient-stats">
                    <span>
                      <strong>{b?.sessionsHeld ?? 0}</strong>
                      realizadas
                    </span>
                    <span>
                      <strong>{cancelRate.get(p.id) ?? 0}%</strong>
                      cancelación
                    </span>
                    <span className={balance > 0 ? 'debt' : balance < 0 ? 'credit' : ''}>
                      <strong>{formatMoney(balance, data.settings.currency)}</strong>
                      {balance > 0 ? 'debe' : balance < 0 ? 'a favor' : 'al día'}
                    </span>
                  </div>
                  <p className="patient-sub" style={{ marginTop: 0 }}>
                    {p.lastRaise
                      ? `Último aumento: ${formatDateShort(p.lastRaise)}`
                      : 'Sin aumentos registrados'}
                    {b?.lastSessionDate ? ` · última sesión ${formatDateShort(b.lastSessionDate)}` : ''}
                  </p>

                  <div className="patient-actions">
                    {wapp && (
                      <a
                        className="btn small wapp"
                        href={wapp}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Escribir por WhatsApp"
                      >
                        Mensaje
                      </a>
                    )}
                    <button className="btn small" onClick={() => openEdit(p)}>
                      Editar
                    </button>
                    <ConfirmButton
                      label="Borrar"
                      confirmLabel={`¿Borrar a ${p.name}? Se eliminan también sus ${
                        data.sessions.filter((s) => s.patientId === p.id).length
                      } sesión(es) y sus pagos. Esta acción no se puede deshacer.`}
                      onConfirm={() => dispatch({ type: 'patient/remove', payload: { id: p.id } })}
                    />
                  </div>
                </article>
              );
            })}
          </div>
        )}

      <button className="fab" onClick={openNew} aria-label="Nuevo paciente">
        +
      </button>

      {editing && (
        <Modal title={editing === 'new' ? 'Nuevo paciente' : 'Editar paciente'} onClose={() => setEditing(null)}>
          <Field label="Nombre y apellido *" error={errors.name}>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus />
          </Field>
          <div className="field-row">
            <Field label="Email" error={errors.email}>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </Field>
            <Field label="Teléfono">
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </Field>
          </div>
          <div className="field-row">
            <Field label="Honorario por sesión" error={errors.fee}>
              <input
                inputMode="decimal"
                value={form.fee}
                onChange={(e) => setForm({ ...form, fee: e.target.value })}
                placeholder="0,00"
              />
            </Field>
            <Field label="Tipo">
              <select
                value={form.kind}
                onChange={(e) => setForm({ ...form, kind: e.target.value as PatientKind })}
              >
                {(Object.keys(KIND_LABEL) as PatientKind[]).map((k) => (
                  <option key={k} value={k}>
                    {KIND_LABEL[k]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Frecuencia">
              <select
                value={form.frequency}
                onChange={(e) => setForm({ ...form, frequency: e.target.value as Frequency })}
              >
                {(Object.keys(FREQUENCY_LABEL) as Frequency[]).map((f) => (
                  <option key={f} value={f}>
                    {FREQUENCY_LABEL[f]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Estado">
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as Patient['status'] })}
              >
                <option value="activo">Activo</option>
                <option value="inactivo">Inactivo</option>
              </select>
            </Field>
          </div>

          <div className="field">
            <label id="color-label">Color</label>
            <div className="swatches" role="radiogroup" aria-labelledby="color-label">
              {PATIENT_COLORS.map((c, i) => (
                <button
                  key={c.name}
                  type="button"
                  role="radio"
                  aria-checked={form.colorIndex === i}
                  aria-label={c.name}
                  title={c.name}
                  className={`swatch${form.colorIndex === i ? ' is-selected' : ''}`}
                  style={{ background: c.solid }}
                  onClick={() => setForm({ ...form, colorIndex: i })}
                />
              ))}
            </div>
          </div>
          <Field label="Notas">
            <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </Field>
          <div className="modal-foot">
            <button className="btn" onClick={() => setEditing(null)}>
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
