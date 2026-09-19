import { useEffect, useMemo, useState } from 'react';
import type { Frequency, Patient, PatientKind, TaxCondition } from '../types';
import { useStore } from '../store/StoreContext';
import { patientBalances } from '../store/selectors';
import { centsToInput, formatMoney, parseMoney } from '../lib/money';
import { formatDateShort, today } from '../lib/dates';
import { ConfirmButton, Empty, Field, Modal } from '../components/ui';
import { guardarBorrador, leerBorrador, limpiarBorrador, tieneContenido } from '../lib/borrador';
import { nextFreeColor, PATIENT_COLORS, patientColor } from '../lib/palette';
import { whatsappLink } from '../lib/contact';
import { TAX_CONDITION_LABEL } from '../lib/billing';

interface FormState {
  name: string;
  email: string;
  phone: string;
  fee: string;
  status: Patient['status'];
  colorIndex: number;
  frequency: Frequency;
  kind: PatientKind;
  legalName: string;
  document: string;
  taxId: string;
  taxCondition: TaxCondition;
  memberNumber: string;
  insurer: string;
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
    legalName: p.legalName,
    document: p.document,
    taxId: p.taxId,
    taxCondition: p.taxCondition,
    memberNumber: p.memberNumber,
    insurer: p.insurer,
    notes: p.notes,
  };
}

/** Clave del borrador del alta. Ver `src/lib/borrador.ts`. */
const BORRADOR = 'paciente';

/** El formulario recién abierto. Es la referencia de "acá no hay nada escrito". */
const EN_BLANCO: FormState = {
  name: '',
  email: '',
  phone: '',
  fee: '',
  status: 'activo',
  colorIndex: 0,
  frequency: 'semanal',
  kind: 'particular',
  legalName: '',
  document: '',
  taxId: '',
  taxCondition: 'consumidor_final',
  memberNumber: '',
  insurer: '',
  notes: '',
};

export function PatientsPage({ onOpenPatient }: { onOpenPatient: (id: string) => void }) {
  const { data, dispatch } = useStore();
  const [editing, setEditing] = useState<Patient | 'new' | null>(null);
  // El estado inicial no se usa: openNew() y openEdit() siempre lo reemplazan
  // antes de que el formulario se muestre.
  const [form, setForm] = useState<FormState>(EN_BLANCO);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  /**
   * El cartel del borrador: 'no' cuando no hay nada que ofrecer, 'ofrecido'
   * mientras se pregunta, 'recuperado' una vez que se retomó.
   */
  const [borrador, setBorrador] = useState<'no' | 'ofrecido' | 'recuperado'>('no');
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
      ...EN_BLANCO,
      // Se propone un color que todavía no use nadie, para que no se repitan.
      colorIndex: nextFreeColor(data.patients.map((p) => p.colorIndex)),
    });
    setErrors({});
    // Si quedó algo a medias de la vez anterior, se ofrece; no se aplica solo,
    // que sería peor: el formulario aparecería lleno sin que nadie lo pidiera.
    const guardado = leerBorrador<FormState>(BORRADOR);
    setBorrador(guardado && tieneContenido({ ...EN_BLANCO, ...guardado }, EN_BLANCO) ? 'ofrecido' : 'no');
    setEditing('new');
  }

  function openEdit(p: Patient) {
    setForm(toForm(p));
    setErrors({});
    setBorrador('no');
    setEditing(p);
  }

  /**
   * El borrador del alta.
   *
   * Solo se guarda al cargar a alguien nuevo: editar una ficha que ya existe
   * no necesita red —lo guardado sigue estando— y ofrecer un borrador viejo
   * encima de un paciente real sería peor que no ofrecer nada.
   */
  useEffect(() => {
    if (editing !== 'new') return;
    if (!tieneContenido(form, EN_BLANCO)) return;
    guardarBorrador(BORRADOR, form);
  }, [editing, form]);

  /** Al abrir el alta, ofrecer lo que había quedado a medias. */
  function retomar() {
    const guardado = leerBorrador<Partial<FormState>>(BORRADOR);
    if (!guardado) return;
    // Se mezcla con el formulario en blanco: si el borrador viene de una
    // versión vieja y le falta un campo, el campo aparece vacío y no roto.
    setForm({ ...EN_BLANCO, ...guardado });
    setBorrador('recuperado');
  }

  function descartarBorrador() {
    limpiarBorrador(BORRADOR);
    setForm({ ...EN_BLANCO, colorIndex: nextFreeColor(data.patients.map((p) => p.colorIndex)) });
    setBorrador('no');
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
      legalName: form.legalName.trim(),
      document: form.document.trim(),
      taxId: form.taxId.trim(),
      taxCondition: form.taxCondition,
      memberNumber: form.memberNumber.trim(),
      insurer: form.insurer.trim(),
      notes: form.notes.trim(),
    };

    if (editing === 'new') {
      dispatch({ type: 'patient/add', payload: { ...fields, lastRaise: fields.defaultFee > 0 ? today() : null } });
    }
    else if (editing) dispatch({ type: 'patient/update', payload: { ...editing, ...fields } });
    limpiarBorrador(BORRADOR);
    setBorrador('no');
    setEditing(null);
  }

  /**
   * Los pacientes agrupados por tipo, en orden fijo y salteando los grupos
   * vacíos. El orden no se calcula: "particular" primero porque es el caso
   * más común, y así la lista no se reordena sola al cargar a alguien.
   */
  const ORDEN_TIPOS: PatientKind[] = ['particular', 'institucion', 'evaluacion'];
  const grupos = useMemo(
    () =>
      ORDEN_TIPOS.map((tipo) => ({ tipo, gente: rows.filter((p) => p.kind === tipo) })).filter(
        (g) => g.gente.length > 0,
      ),
    [rows],
  );

  /**
   * La ficha de un paciente. Es una función y no JSX suelto porque ahora se
   * dibuja una vez por grupo, y repetir ochenta líneas por cada tipo sería
   * garantizar que se desincronicen.
   */
  function ficha(p: Patient, conTipo: boolean) {
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
          {/* El tipo solo se repite acá si el grupo no lo dijo ya arriba: con el
              rótulo puesto, escribirlo de nuevo en cada ficha es ruido. */}
          {conTipo ? `${KIND_LABEL[p.kind]} · ` : ''}
          {FREQUENCY_LABEL[p.frequency].toLowerCase()}
          {p.status === 'inactivo' ? ' · inactivo' : ''}
        </p>

        {/* Tres números que responden lo que uno mira una ficha para
            saber: cuántas veces vino, cuánta plata entró, y si queda
            algo pendiente.

            Antes el tercero era el saldo a secas, y con el paciente
            al día mostraba "$ 0": se leía como si la app no hubiera
            contado el cobro, cuando en realidad estaba diciendo la
            mejor noticia. Ahora lo cobrado tiene su lugar propio y el
            saldo en cero se dice con palabras.

            El porcentaje de cancelación bajó a la línea de abajo y
            solo aparece si hay algo que decir: un 0% ocupaba un lugar
            de los tres para no informar nada. */}
        <div className="patient-stats">
          <span>
            <strong>{b?.sessionsHeld ?? 0}</strong>
            realizadas
          </span>
          <span>
            <strong>{formatMoney(b?.paid ?? 0, data.settings.currency)}</strong>
            cobrado
          </span>
          <span className={balance > 0 ? 'debt' : balance < 0 ? 'credit' : ''}>
            <strong>
              {balance === 0 ? 'Al día' : formatMoney(Math.abs(balance), data.settings.currency)}
            </strong>
            {balance > 0 ? 'te debe' : balance < 0 ? 'a favor' : 'sin saldo'}
          </span>
        </div>
        <p className="patient-sub" style={{ marginTop: 0 }}>
          {p.lastRaise
            ? `Último aumento: ${formatDateShort(p.lastRaise)}`
            : 'Sin aumentos registrados'}
          {b?.lastSessionDate ? ` · última sesión ${formatDateShort(b.lastSessionDate)}` : ''}
          {(cancelRate.get(p.id) ?? 0) > 0 ? ` · ${cancelRate.get(p.id)}% se cae` : ''}
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
  }

  /**
   * Si los bloques plegados arrancan abiertos.
   *
   * Al dar de alta están cerrados: el formulario corto es el punto. Al editar a
   * alguien que ya tiene esos datos cargados, se abren solos, porque esconder
   * lo que la persona vino a cambiar sería peor que mostrarlo de más.
   */
  const hayMasDatos =
    form.email.trim() !== '' ||
    form.notes.trim() !== '' ||
    form.kind !== EN_BLANCO.kind ||
    form.status !== EN_BLANCO.status;
  const hayFacturacion =
    [form.legalName, form.document, form.taxId, form.insurer, form.memberNumber].some(
      (v) => v.trim() !== '',
    ) || form.taxCondition !== EN_BLANCO.taxCondition;
  /* `<details>` recuerda solo si está abierto, así que al pasar de una ficha a
     otra hay que volver a montarlo para que la decisión se recalcule. */
  const claveFicha = editing === 'new' ? 'nuevo' : (editing?.id ?? '');

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
          grupos.map((g) => (
            <section key={g.tipo} className="grupo-pacientes">
              {/* El encabezado del grupo solo aparece si hay más de un tipo
                  cargado: con todos particulares sería un rótulo que no
                  distingue nada de nada. */}
              {grupos.length > 1 && (
                <h3 className="grupo-titulo">
                  {KIND_LABEL[g.tipo]}
                  <span className="grupo-cuenta">{g.gente.length}</span>
                </h3>
              )}
              <div className="patient-grid">{g.gente.map((p) => ficha(p, grupos.length === 1))}</div>
            </section>
          ))
        )}

      <button className="fab" onClick={openNew} aria-label="Nuevo paciente">
        +
      </button>

      {editing && (
        <Modal title={editing === 'new' ? 'Nuevo paciente' : 'Editar paciente'} onClose={() => setEditing(null)}>
          {borrador === 'ofrecido' && (
            <div className="borrador-aviso">
              <span>Quedó algo a medio cargar la última vez.</span>
              <div className="actions">
                <button className="btn small primary" onClick={retomar}>
                  Retomarlo
                </button>
                <button className="btn small ghost" onClick={descartarBorrador}>
                  Empezar de cero
                </button>
              </div>
            </div>
          )}
          {borrador === 'recuperado' && (
            <div className="borrador-aviso">
              <span>Esto es lo que habías empezado a cargar.</span>
              <button className="btn small ghost" onClick={descartarBorrador}>
                Empezar de cero
              </button>
            </div>
          )}
          {/* Lo mínimo para que un paciente exista: cómo se llama, cuánto cobra y
              cada cuánto viene. Todo lo demás está abajo, plegado. Quince campos
              de una sola vez convierten "cargar a alguien" en un trámite, y un
              trámite se posterga; con cuatro se empieza y listo. Nada de lo que
              se pliega es obligatorio, y se puede completar cuando aparezca. */}
          <Field label="Nombre y apellido *" error={errors.name}>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus />
          </Field>
          <div className="field-row">
            <Field label="Honorario por sesión" error={errors.fee}>
              <input
                inputMode="decimal"
                value={form.fee}
                onChange={(e) => setForm({ ...form, fee: e.target.value })}
                placeholder="0,00"
              />
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
          </div>
          {/* El teléfono queda arriba aunque no sea obligatorio: es lo que
              habilita escribirle por WhatsApp desde la agenda. */}
          <Field label="Teléfono">
            <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </Field>

          <details className="plegable" key={`mas-${claveFicha}`} open={hayMasDatos}>
            <summary>Más datos</summary>
            <div className="field-row">
              <Field label="Email" error={errors.email}>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
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
          </details>

          <details className="plegable" key={`factura-${claveFicha}`} open={hayFacturacion}>
            <summary>Datos para facturar</summary>
            <Field label="Nombre completo">
              <input
                value={form.legalName}
                onChange={(e) => setForm({ ...form, legalName: e.target.value })}
                placeholder={form.name.trim() === '' ? 'Como figura en el documento' : form.name}
              />
            </Field>

            <div className="field-row">
              <Field label="DNI">
                <input
                  inputMode="numeric"
                  value={form.document}
                  onChange={(e) => setForm({ ...form, document: e.target.value })}
                />
              </Field>
              <Field label="CUIT / CUIL">
                <input
                  inputMode="numeric"
                  value={form.taxId}
                  onChange={(e) => setForm({ ...form, taxId: e.target.value })}
                />
              </Field>
            </div>

            <Field label="Condición frente al IVA">
              <select
                value={form.taxCondition}
                onChange={(e) => setForm({ ...form, taxCondition: e.target.value as TaxCondition })}
              >
                {(Object.keys(TAX_CONDITION_LABEL) as TaxCondition[]).map((c) => (
                  <option key={c} value={c}>
                    {TAX_CONDITION_LABEL[c]}
                  </option>
                ))}
              </select>
            </Field>

            <div className="field-row">
              <Field label="Obra social / prepaga">
                <input value={form.insurer} onChange={(e) => setForm({ ...form, insurer: e.target.value })} />
              </Field>
              <Field label="N.º de afiliado">
                <input
                  value={form.memberNumber}
                  onChange={(e) => setForm({ ...form, memberNumber: e.target.value })}
                />
              </Field>
            </div>
          </details>
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
