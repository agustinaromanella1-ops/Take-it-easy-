import { useEffect, useMemo, useState } from 'react';
import type { Cuenta, Moneda, Movimiento, TipoMovimiento } from '../../types';
import { useStore } from '../../store/StoreContext';
import { useVentanas } from '../Ventanas';
import { Aviso, Field, Modal, Opciones } from '../ui';
import { AvisoBorrador } from '../AvisoBorrador';
import { centsToInput, formatMoney, parseMoney } from '../../lib/money';
import { formatDateMedium, today } from '../../lib/dates';
import { newId } from '../../lib/id';
import { analizar } from '../../lib/texto/analizar';
import { CATEGORIAS } from '../../lib/texto/categorias';
import { posiblesDuplicados } from '../../lib/finanzas/duplicados';
import { esTarjeta } from '../../lib/finanzas/saldos';
import { useBorrador } from '../../lib/useBorrador';
import { mensaje } from '../../lib/companero';

/**
 * Anotar un movimiento: la acción principal de la app.
 *
 * Lo mínimo es un número y "Guardar". Todo lo demás es opcional y está
 * plegado. Sin cuenta también se puede: queda "sin cuenta" y la pantalla de
 * Hoy explica cómo afecta al número.
 */

interface Form {
  tipo: TipoMovimiento;
  importe: string;
  cuentaId: string;
  cuentaDestinoId: string;
  moneda: Moneda;
  fecha: string;
  comercio: string;
  categoria: string;
  nota: string;
  cuotas: string;
  devolucionDe: string;
}

/**
 * Gasto e ingreso están a la vista; lo demás, detrás de "Otra cosa". Son los
 * que importan para que la cuenta no cuente dos veces, pero son los menos
 * frecuentes: tenerlos siempre a la vista alargaba el cuadro para todos.
 */
type TipoVisible = 'gasto' | 'ingreso' | 'otro';

const TIPOS: { valor: TipoMovimiento; texto: string }[] = [
  { valor: 'gasto', texto: 'Gasto' },
  { valor: 'ingreso', texto: 'Ingreso' },
  { valor: 'transferencia', texto: 'Entre mis cuentas' },
  { valor: 'pago-tarjeta', texto: 'Pago de tarjeta' },
  { valor: 'devolucion', texto: 'Devolución' },
];

const CLAVE_ULTIMA = 'salchi:ultima-cuenta';

/** La cuenta sugerida: la última usada o, si hay una sola, esa. Un toque menos. */
function ultimaCuenta(cuentas: Cuenta[]): string {
  const activas = cuentas.filter((c) => !c.archivada);
  try {
    const id = localStorage.getItem(CLAVE_ULTIMA) ?? '';
    if (activas.some((c) => c.id === id)) return id;
  } catch {
    /* Sin almacenamiento, se sigue con la regla de abajo. */
  }
  return activas.length === 1 ? activas[0]?.id ?? '' : '';
}

function formDe(m: Movimiento): Form {
  return {
    tipo: m.tipo,
    importe: centsToInput(Math.abs(m.importe)),
    cuentaId: m.cuentaId ?? '',
    cuentaDestinoId: m.cuentaDestinoId ?? '',
    moneda: m.moneda,
    fecha: m.fecha,
    comercio: m.comercio,
    categoria: m.categoria,
    nota: m.nota,
    cuotas: String(m.cuotas),
    devolucionDe: m.devolucionDe ?? '',
  };
}

export function Anotar({ mov, modo: modoInicial = 'numero', fechaInicial }: { mov?: Movimiento; modo?: 'numero' | 'frase'; fechaInicial?: string }) {
  const { data, dispatch, huellita } = useStore();
  const { cerrar, abrir } = useVentanas();
  const cuentas = data.cuentas.filter((c) => !c.archivada || c.id === mov?.cuentaId);
  const editando = mov !== undefined;

  const vacio = useMemo<Form>(
    () => ({
      tipo: 'gasto',
      importe: '',
      cuentaId: ultimaCuenta(data.cuentas),
      cuentaDestinoId: '',
      moneda: 'ARS',
      fecha: fechaInicial ?? today(),
      comercio: '',
      categoria: '',
      nota: '',
      cuotas: '1',
      devolucionDe: '',
    }),
    // Estable entre dibujos: si cambiara, el borrador se escribiría solo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const [form, setForm] = useState<Form>(() => (mov ? formDe(mov) : vacio));
  const [modo, setModo] = useState(modoInicial);
  const [frase, setFrase] = useState('');
  const [entendido, setEntendido] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [duplicados, setDuplicados] = useState<Movimiento[]>([]);
  const [detalles, setDetalles] = useState(editando && Boolean(mov.comercio || mov.categoria || mov.nota || mov.fecha !== today()));

  const borrador = useBorrador('anotar', vacio, form, !editando);
  useEffect(() => {
    if (!editando) borrador.ofrecerSiHay();
    // Solo al abrir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setDuplicados([]);
    setError(null);
  };

  const cuenta = cuentas.find((c) => c.id === form.cuentaId);
  const moneda: Moneda = cuenta?.moneda ?? form.moneda;
  const tarjetas = cuentas.filter(esTarjeta);
  const noTarjetas = cuentas.filter((c) => !esTarjeta(c));
  const origenes = form.tipo === 'pago-tarjeta' || form.tipo === 'transferencia' ? noTarjetas : cuentas;
  const gastosRecientes = data.movimientos
    .filter((m) => m.tipo === 'gasto')
    .sort((a, b) => (a.fecha > b.fecha ? -1 : 1))
    .slice(0, 30);

  function entender() {
    const a = analizar(frase, data.cuentas, today());
    const partes: string[] = [];
    const cambios: Partial<Form> = {};
    if (a.tipo) {
      cambios.tipo = a.tipo;
      partes.push(TIPOS.find((t) => t.valor === a.tipo)?.texto ?? a.tipo);
    }
    if (a.importe !== null) {
      cambios.importe = centsToInput(a.importe);
      partes.push(formatMoney(a.importe, a.moneda));
    }
    cambios.moneda = a.moneda;
    if (a.cuentaId) {
      cambios.cuentaId = a.cuentaId;
      partes.push(data.cuentas.find((c) => c.id === a.cuentaId)?.nombre ?? '');
    }
    if (a.cuentaDestinoId) {
      cambios.cuentaDestinoId = a.cuentaDestinoId;
      partes.push(`a ${data.cuentas.find((c) => c.id === a.cuentaDestinoId)?.nombre ?? ''}`);
    }
    if (a.comercio) {
      cambios.comercio = a.comercio;
      partes.push(a.comercio);
    }
    if (a.categoria) {
      cambios.categoria = a.categoria;
      partes.push(a.categoria);
    }
    if (a.fecha) {
      cambios.fecha = a.fecha;
      partes.push(formatDateMedium(a.fecha));
    }
    if (a.cuotas > 1) {
      cambios.cuotas = String(a.cuotas);
      partes.push(`${a.cuotas} cuotas`);
    }
    setForm((f) => ({ ...f, ...cambios }));
    setEntendido(partes.filter(Boolean));
    if (a.comercio || a.categoria || a.fecha || a.cuotas > 1) setDetalles(true);
  }

  function armar(): Omit<Movimiento, 'updatedAt'> | null {
    const importe = parseMoney(form.importe);
    if (importe === null || importe <= 0) {
      setError('Escribí un importe mayor a cero.');
      return null;
    }
    if (form.tipo === 'transferencia' && (!form.cuentaId || !form.cuentaDestinoId || form.cuentaId === form.cuentaDestinoId)) {
      setError('Elegí de qué cuenta sale y a cuál va (tienen que ser distintas).');
      return null;
    }
    if (form.tipo === 'pago-tarjeta' && (!form.cuentaDestinoId || !form.cuentaId)) {
      setError('Elegí qué tarjeta pagaste y desde qué cuenta.');
      return null;
    }
    const destino = cuentas.find((c) => c.id === form.cuentaDestinoId);
    if (destino && cuenta && destino.moneda !== cuenta.moneda) {
      setError('Las dos cuentas tienen que estar en la misma moneda. Pesos y dólares no se mezclan.');
      return null;
    }
    const cuotas = Math.max(1, Math.min(72, Number(form.cuotas) || 1));
    return {
      id: mov?.id ?? newId(),
      tipo: form.tipo,
      importe,
      moneda,
      fecha: form.fecha || today(),
      cuentaId: form.cuentaId || null,
      cuentaDestinoId: form.tipo === 'transferencia' || form.tipo === 'pago-tarjeta' ? form.cuentaDestinoId || null : null,
      categoria: form.tipo === 'gasto' || form.tipo === 'devolucion' || form.tipo === 'ingreso' ? form.categoria : '',
      comercio: form.comercio.trim(),
      nota: form.nota.trim(),
      cuotas: form.tipo === 'gasto' && cuenta && esTarjeta(cuenta) ? cuotas : 1,
      devolucionDe: form.tipo === 'devolucion' ? form.devolucionDe || null : null,
      origen: mov?.origen ?? (modo === 'frase' ? 'texto' : 'manual'),
      aRevisar: false,
    };
  }

  function guardar(aunqueParezcaRepetido = false) {
    const m = armar();
    if (!m) return;
    if (!editando && !aunqueParezcaRepetido) {
      const dups = posiblesDuplicados(m, data.movimientos);
      if (dups.length > 0) {
        setDuplicados(dups);
        return;
      }
    }
    if (editando) {
      dispatch({ type: 'mov/editar', mov: m });
    } else {
      dispatch({ type: 'mov/agregar', mov: m });
      huellita('anotar');
      if (m.cuentaId) {
        try {
          localStorage.setItem(CLAVE_ULTIMA, m.cuentaId);
        } catch {
          /* Sin almacenamiento, la próxima vez no hay cuenta sugerida. */
        }
      }
    }
    borrador.listo();
    cerrar();
  }

  const titulo = editando ? 'Editar movimiento' : 'Anotar';

  // Un ajuste no se edita a mano: es la diferencia que dio actualizar un
  // saldo. Si está mal, se borra y se vuelve a actualizar el saldo.
  if (mov?.tipo === 'ajuste') {
    return (
      <Modal titulo="Diferencia sin conciliar" onClose={cerrar}>
        <p>
          {formatMoney(mov.importe, mov.moneda)} en {cuenta?.nombre ?? 'una cuenta'}, el {formatDateMedium(mov.fecha)}.
        </p>
        <Aviso>La registró la app al actualizar un saldo: es la diferencia entre lo calculado y lo que había. No tiene categoría a propósito.</Aviso>
        <div className="acciones acciones-final">
          <button
            type="button"
            className="btn peligro"
            onClick={() => {
              dispatch({ type: 'mov/borrar', id: mov.id });
              cerrar();
            }}
          >
            Borrar
          </button>
          <button type="button" className="btn principal" onClick={cerrar}>
            Listo
          </button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal titulo={titulo} onClose={cerrar}>
      <AvisoBorrador
        estado={borrador.estado}
        onRetomar={() => {
          const r = borrador.retomar();
          if (r) setForm(r);
        }}
        onDescartar={() => {
          borrador.descartar();
          setForm(vacio);
        }}
      />

      {!editando && (
        <div className="modos" role="group" aria-label="Otras formas de anotar">
          <button type="button" className={`chip chip-chico${modo === 'frase' ? ' chip-activo' : ''}`} aria-pressed={modo === 'frase'} onClick={() => setModo(modo === 'frase' ? 'numero' : 'frase')}>
            Con una frase
          </button>
          <button type="button" className="chip chip-chico" onClick={() => abrir({ tipo: 'comprobante' })}>
            Con una foto
          </button>
        </div>
      )}

      {modo === 'frase' && !editando && (
        <div className="frase">
          <Field label="Escribilo como te salga" ayuda='Por ejemplo: "gasté 8.500 en súper con débito" o "2 lucas café efectivo".'>
            <input
              data-autofoco
              value={frase}
              onChange={(e) => setFrase(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  entender();
                }
              }}
              autoComplete="off"
            />
          </Field>
          <button type="button" className="btn" onClick={entender} disabled={!frase.trim()}>
            Entender
          </button>
          {entendido && (
            <p className="entendido" aria-live="polite">
              {entendido.length ? (
                <>
                  Entendí: <strong>{entendido.join(' · ')}</strong>. Revisalo abajo antes de guardar.
                </>
              ) : (
                'No entendí nada de eso. Completalo abajo, sin apuro.'
              )}
            </p>
          )}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          guardar();
        }}
      >
        <Field label={`Importe${form.cuotas !== '1' && form.tipo === 'gasto' ? ' total' : ''}`} error={error ?? undefined}>
          <input
            className="input-importe"
            inputMode="decimal"
            autoComplete="off"
            placeholder="0"
            value={form.importe}
            onChange={(e) => set('importe', e.target.value)}
            {...(modo === 'numero' ? { 'data-autofoco': true } : {})}
          />
        </Field>

        <Opciones<TipoVisible>
          legend="Qué fue"
          valor={form.tipo === 'gasto' || form.tipo === 'ingreso' ? form.tipo : 'otro'}
          opciones={[
            { valor: 'gasto', texto: 'Gasto' },
            { valor: 'ingreso', texto: 'Ingreso' },
            { valor: 'otro', texto: 'Otra cosa' },
          ]}
          onChange={(v) => set('tipo', v === 'otro' ? 'transferencia' : v)}
        />
        {form.tipo !== 'gasto' && form.tipo !== 'ingreso' && (
          <Opciones legend="Cuál" valor={form.tipo} opciones={TIPOS.slice(2)} onChange={(v) => set('tipo', v)} />
        )}

        {form.tipo === 'pago-tarjeta' && (
          <Field label="Qué tarjeta pagaste">
            <select value={form.cuentaDestinoId} onChange={(e) => set('cuentaDestinoId', e.target.value)}>
              <option value="">Elegí una tarjeta</option>
              {tarjetas.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </Field>
        )}

        <Field
          label={form.tipo === 'ingreso' || form.tipo === 'devolucion' ? 'A qué cuenta entró' : form.tipo === 'gasto' ? 'Con qué pagaste' : 'Desde qué cuenta'}
          ayuda={form.cuentaId === '' && form.tipo === 'gasto' ? 'Sin cuenta también sirve: se resta igual de lo que podés usar, y después le asignás una.' : undefined}
        >
          <select value={form.cuentaId} onChange={(e) => set('cuentaId', e.target.value)}>
            <option value="">{form.tipo === 'gasto' ? 'Sin cuenta por ahora' : 'Elegí una cuenta'}</option>
            {origenes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre} ({c.moneda === 'USD' ? 'US$' : '$'})
              </option>
            ))}
          </select>
        </Field>

        {form.tipo === 'transferencia' && (
          <Field label="A qué cuenta fue">
            <select value={form.cuentaDestinoId} onChange={(e) => set('cuentaDestinoId', e.target.value)}>
              <option value="">Elegí una cuenta</option>
              {noTarjetas
                .filter((c) => c.id !== form.cuentaId)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
            </select>
          </Field>
        )}

        {form.tipo === 'gasto' && cuenta && esTarjeta(cuenta) && (
          <Field label="Cuotas" ayuda="El importe es el total. Cada cuota se cuenta en su resumen, no todo junto.">
            <input inputMode="numeric" value={form.cuotas} onChange={(e) => set('cuotas', e.target.value.replace(/\D/g, ''))} />
          </Field>
        )}

        <details className="plegable" open={detalles} onToggle={(e) => setDetalles((e.target as HTMLDetailsElement).open)}>
          <summary>Más detalles (opcional)</summary>
          {!cuenta && (
            <Opciones
              legend="Moneda"
              valor={form.moneda}
              opciones={[
                { valor: 'ARS', texto: 'Pesos' },
                { valor: 'USD', texto: 'Dólares' },
              ]}
              onChange={(v) => set('moneda', v)}
            />
          )}
          <Field label="Fecha">
            <input type="date" value={form.fecha} max={today()} onChange={(e) => set('fecha', e.target.value)} />
          </Field>
          <Field label={form.tipo === 'ingreso' ? 'De quién' : 'Dónde o a quién'}>
            <input value={form.comercio} onChange={(e) => set('comercio', e.target.value)} autoComplete="off" />
          </Field>
          {(form.tipo === 'gasto' || form.tipo === 'devolucion') && (
            <Field label="Categoría">
              <select value={form.categoria} onChange={(e) => set('categoria', e.target.value)}>
                <option value="">Sin categoría</option>
                {CATEGORIAS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </Field>
          )}
          {form.tipo === 'devolucion' && (
            <Field label="De qué compra" ayuda="Si la elegís, quedan vinculadas.">
              <select value={form.devolucionDe} onChange={(e) => set('devolucionDe', e.target.value)}>
                <option value="">No sé o no importa</option>
                {gastosRecientes.map((g) => (
                  <option key={g.id} value={g.id}>
                    {formatDateMedium(g.fecha)} · {g.comercio || 'Sin nombre'} · {formatMoney(g.importe, g.moneda)}
                  </option>
                ))}
              </select>
            </Field>
          )}
          <Field label="Nota">
            <textarea rows={2} value={form.nota} onChange={(e) => set('nota', e.target.value)} />
          </Field>
        </details>

        {duplicados.length > 0 && (
          <div className="duplicado" role="alert">
            <p>
              Se parece a uno que ya anotaste:{' '}
              {duplicados.slice(0, 2).map((d) => (
                <strong key={d.id}>
                  {d.comercio || 'sin nombre'}, {formatMoney(d.importe, d.moneda)}, {formatDateMedium(d.fecha)}.{' '}
                </strong>
              ))}
              ¿Es otro distinto?
            </p>
            <div className="acciones">
              <button type="button" className="btn principal" onClick={() => guardar(true)}>
                Sí, guardarlo igual
              </button>
              <button type="button" className="btn" onClick={cerrar}>
                No, es el mismo
              </button>
            </div>
          </div>
        )}

        {!editando && form.tipo === 'gasto' && <p className="susurro">{mensaje('anotar', data.preferencias.trato)}</p>}

        <div className="acciones acciones-final">
          {editando && (
            <button
              type="button"
              className="btn peligro"
              onClick={() => {
                dispatch({ type: 'mov/borrar', id: mov.id });
                cerrar();
              }}
            >
              Borrar
            </button>
          )}
          <button type="submit" className="btn principal grande">
            Guardar
          </button>
        </div>
        {editando && mov.aRevisar && (
          <button
            type="button"
            className="btn"
            onClick={() => {
              dispatch({ type: 'mov/revisado', ids: [mov.id] });
              huellita('revisar-movimientos');
              cerrar();
            }}
          >
            Está bien así, marcar revisado
          </button>
        )}
      </form>
    </Modal>
  );
}
