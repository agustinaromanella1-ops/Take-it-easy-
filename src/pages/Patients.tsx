import { useMemo, useState } from 'react';
import type { Patient } from '../types';
import { useStore } from '../store/StoreContext';
import { patientBalances } from '../store/selectors';
import { centsToInput, formatMoney, parseMoney } from '../lib/money';
import { formatDateShort } from '../lib/dates';
import { Card, ConfirmButton, Empty, Field, Modal } from '../components/ui';

interface FormState {
  name: string;
  email: string;
  phone: string;
  fee: string;
  status: Patient['status'];
  notes: string;
}

const emptyForm: FormState = { name: '', email: '', phone: '', fee: '', status: 'activo', notes: '' };

function toForm(p: Patient): FormState {
  return {
    name: p.name,
    email: p.email,
    phone: p.phone,
    fee: centsToInput(p.defaultFee),
    status: p.status,
    notes: p.notes,
  };
}

export function PatientsPage({ onOpenPatient }: { onOpenPatient: (id: string) => void }) {
  const { data, dispatch } = useStore();
  const [editing, setEditing] = useState<Patient | 'new' | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [query, setQuery] = useState('');
  const [showInactive, setShowInactive] = useState(true);

  const balances = useMemo(() => patientBalances(data), [data]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return data.patients
      .filter((p) => (showInactive ? true : p.status === 'activo'))
      .filter((p) => q === '' || p.name.toLowerCase().includes(q) || p.email.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name, 'es'));
  }, [data.patients, query, showInactive]);

  function openNew() {
    setForm(emptyForm);
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
      notes: form.notes.trim(),
    };

    if (editing === 'new') dispatch({ type: 'patient/add', payload: fields });
    else if (editing) dispatch({ type: 'patient/update', payload: { ...editing, ...fields } });
    setEditing(null);
  }

  return (
    <>
      <div className="page-head">
        <h1>Pacientes</h1>
        <button className="btn primary hide-mobile" onClick={openNew}>
          + Nuevo paciente
        </button>
      </div>

      <Card>
        <div className="field-row" style={{ marginBottom: 14 }}>
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="buscar">Buscar</label>
            <input
              id="buscar"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Nombre o email"
            />
          </div>
          <div className="field" style={{ marginBottom: 0, justifyContent: 'flex-end' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={showInactive}
                onChange={(e) => setShowInactive(e.target.checked)}
                style={{ width: 'auto' }}
              />
              Mostrar inactivos
            </label>
          </div>
        </div>

        {rows.length === 0 ? (
          <Empty>
            {data.patients.length === 0
              ? 'Todavía no cargaste ningún paciente.'
              : 'Ningún paciente coincide con la búsqueda.'}
          </Empty>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Paciente</th>
                  <th>Contacto</th>
                  <th className="num">Honorario</th>
                  <th className="num">Sesiones</th>
                  <th>Última</th>
                  <th className="num">Saldo</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => {
                  const b = balances.get(p.id);
                  const balance = b?.balance ?? 0;
                  return (
                    <tr key={p.id}>
                      <td>
                        <button className="link-cell" onClick={() => onOpenPatient(p.id)}>
                          {p.name}
                        </button>
                        {p.status === 'inactivo' && <span className="tag inactivo" style={{ marginLeft: 8 }}>inactivo</span>}
                      </td>
                      <td className="small muted">
                        {p.email || p.phone ? (
                          <>
                            {p.email}
                            {p.email && p.phone ? ' · ' : ''}
                            {p.phone}
                          </>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="num">{formatMoney(p.defaultFee, data.settings.currency)}</td>
                      <td className="num">{b?.sessionsHeld ?? 0}</td>
                      <td className="small">{b?.lastSessionDate ? formatDateShort(b.lastSessionDate) : '—'}</td>
                      <td className="num">
                        <span className={`money${balance > 0 ? ' debt' : balance < 0 ? ' credit' : ''}`}>
                          {formatMoney(balance, data.settings.currency)}
                        </span>
                      </td>
                      <td>
                        <div className="actions">
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
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

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
