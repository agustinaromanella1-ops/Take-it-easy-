import { useState } from 'react';
import type { Cuenta, Moneda, TipoCuenta } from '../../types';
import { useStore } from '../../store/StoreContext';
import { useVentanas } from '../Ventanas';
import { Aviso, Field, Llave, Modal, Opciones } from '../ui';
import { centsToInput, formatMoney, parseMoney } from '../../lib/money';
import { formatDateMedium, today } from '../../lib/dates';
import { newId } from '../../lib/id';
import { esTarjeta, saldo } from '../../lib/finanzas/saldos';

const TIPOS: { valor: TipoCuenta; texto: string }[] = [
  { valor: 'banco', texto: 'Banco' },
  { valor: 'billetera', texto: 'Billetera virtual' },
  { valor: 'efectivo', texto: 'Efectivo' },
  { valor: 'tarjeta-credito', texto: 'Tarjeta de crédito' },
];

const NOMBRES: Record<TipoCuenta, string> = {
  banco: 'Banco',
  billetera: 'Mercado Pago',
  efectivo: 'Efectivo',
  'tarjeta-credito': 'Visa',
};

/** Alias que se agregan solos, para que "con débito" o "mp" se entiendan al escribir. */
function aliasPorDefecto(tipo: TipoCuenta, nombre: string): string[] {
  const n = nombre.toLowerCase();
  if (tipo === 'banco') return ['débito'];
  if (tipo === 'billetera' && n.includes('mercado')) return ['mp'];
  if (tipo === 'tarjeta-credito') return ['crédito'];
  return [];
}

export function CuentaForm({ cuenta, alGuardar }: { cuenta?: Cuenta; alGuardar?: () => void }) {
  const { data, dispatch, huellita } = useStore();
  const { cerrar } = useVentanas();
  const editando = cuenta !== undefined;
  const [tipo, setTipo] = useState<TipoCuenta>(cuenta?.tipo ?? 'banco');
  const [nombre, setNombre] = useState(cuenta?.nombre ?? '');
  const [moneda, setMoneda] = useState<Moneda>(cuenta?.moneda ?? 'ARS');
  const [importe, setImporte] = useState(cuenta ? centsToInput(cuenta.saldoInicial) : '');
  const [aproximado, setAproximado] = useState(cuenta?.aproximado ?? false);
  const [cuenta2, setCuenta2] = useState(cuenta?.cuentaParaDisponible ?? true);
  const [cierre, setCierre] = useState(String(cuenta?.diaCierre ?? 25));
  const [venc, setVenc] = useState(String(cuenta?.diaVencimiento ?? 5));
  const [alias, setAlias] = useState((cuenta?.alias ?? []).join(', '));
  const [error, setError] = useState('');
  const tarjeta = tipo === 'tarjeta-credito';

  function guardar() {
    const saldoInicial = importe.trim() === '' ? 0 : parseMoney(importe);
    if (saldoInicial === null) {
      setError('Ese importe no se entiende. Probá solo con números, por ejemplo 150000.');
      return;
    }
    const dCierre = Number(cierre);
    const dVenc = Number(venc);
    if (tarjeta && (!(dCierre >= 1 && dCierre <= 31) || !(dVenc >= 1 && dVenc <= 31))) {
      setError('Los días de cierre y vencimiento van del 1 al 31.');
      return;
    }
    const nombreFinal = nombre.trim() || NOMBRES[tipo];
    const hoy = today();
    const c: Omit<Cuenta, 'updatedAt'> = {
      id: cuenta?.id ?? newId(),
      nombre: nombreFinal,
      tipo,
      moneda,
      saldoInicial,
      fechaSaldo: cuenta?.fechaSaldo ?? hoy,
      aproximado,
      cuentaParaDisponible: tarjeta ? false : cuenta2,
      confirmadoEn: cuenta?.confirmadoEn ?? hoy,
      alias: editando
        ? alias.split(',').map((a) => a.trim()).filter(Boolean)
        : aliasPorDefecto(tipo, nombreFinal),
      diaCierre: tarjeta ? dCierre : null,
      diaVencimiento: tarjeta ? dVenc : null,
      archivada: cuenta?.archivada ?? false,
    };
    dispatch({ type: editando ? 'cuenta/editar' : 'cuenta/agregar', cuenta: c });
    if (!editando) huellita('actualizar-saldo');
    alGuardar?.();
    cerrar();
  }

  const conHistoria = cuenta && data.movimientos.some((m) => m.cuentaId === cuenta.id || m.cuentaDestinoId === cuenta.id);

  return (
    <Modal titulo={editando ? 'Editar cuenta' : 'Nueva cuenta'} onClose={cerrar}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          guardar();
        }}
      >
        <Opciones legend="Qué es" valor={tipo} opciones={TIPOS} onChange={setTipo} />
        <Field label="Nombre" ayuda={`Si lo dejás vacío, se llama "${NOMBRES[tipo]}".`}>
          <input data-autofoco value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder={NOMBRES[tipo]} autoComplete="off" />
        </Field>
        <Opciones
          legend="Moneda"
          valor={moneda}
          opciones={[
            { valor: 'ARS', texto: 'Pesos' },
            { valor: 'USD', texto: 'Dólares' },
          ]}
          onChange={setMoneda}
        />
        <Field
          label={tarjeta ? '¿Cuánto debés hoy en esta tarjeta?' : editando ? 'Saldo cuando la cargaste' : '¿Cuánto hay hoy?'}
          ayuda={
            tarjeta
              ? 'Lo tomamos como parte del próximo resumen. Las compras nuevas se van sumando solas.'
              : editando
                ? 'Para decir cuánto hay ahora, usá "Actualizar saldo": así queda registrada la diferencia.'
                : 'Si no sabés exacto, poné un número aproximado y marcalo abajo.'
          }
          error={error || undefined}
        >
          <input className="input-importe" inputMode="decimal" value={importe} onChange={(e) => setImporte(e.target.value)} placeholder="0" />
        </Field>
        {!tarjeta && <Llave label="Es aproximado" checked={aproximado} onChange={setAproximado} />}
        {tarjeta && (
          <div className="fila">
            <Field label="Día de cierre">
              <input inputMode="numeric" value={cierre} onChange={(e) => setCierre(e.target.value.replace(/\D/g, ''))} />
            </Field>
            <Field label="Día de vencimiento">
              <input inputMode="numeric" value={venc} onChange={(e) => setVenc(e.target.value.replace(/\D/g, ''))} />
            </Field>
          </div>
        )}
        <details className="plegable" open={editando && (!cuenta2 || alias !== '')}>
          <summary>Más opciones</summary>
          {!tarjeta && (
            <Llave
              label="Cuenta para lo que puedo usar"
              ayuda="Apagalo en una cuenta de ahorro que no querés tocar: su plata no se suma al disponible."
              checked={cuenta2}
              onChange={setCuenta2}
            />
          )}
          {editando && (
            <Field label="Otros nombres" ayuda='Separados por coma. Sirven al anotar con una frase, por ejemplo "mp" o "débito".'>
              <input value={alias} onChange={(e) => setAlias(e.target.value)} autoComplete="off" />
            </Field>
          )}
        </details>
        <div className="acciones acciones-final">
          {editando &&
            (conHistoria ? (
              <button
                type="button"
                className="btn"
                onClick={() => {
                  dispatch({ type: 'cuenta/editar', cuenta: { ...cuenta, archivada: !cuenta.archivada } });
                  cerrar();
                }}
              >
                {cuenta.archivada ? 'Desarchivar' : 'Archivar'}
              </button>
            ) : (
              <button
                type="button"
                className="btn peligro"
                onClick={() => {
                  dispatch({ type: 'cuenta/borrar', id: cuenta.id });
                  cerrar();
                }}
              >
                Borrar
              </button>
            ))}
          <button type="submit" className="btn principal grande">
            Guardar
          </button>
        </div>
        {editando && conHistoria && <p className="susurro">Una cuenta con movimientos se archiva en vez de borrarse, para no cambiar números viejos.</p>}
      </form>
    </Modal>
  );
}

/**
 * Actualizar un saldo: "esto es lo que hay". Si no coincide con lo calculado,
 * la diferencia queda registrada como diferencia sin conciliar.
 */
export function SaldoForm({ cuentaId, alGuardar }: { cuentaId: string; alGuardar?: () => void }) {
  const { data, dispatch, huellita } = useStore();
  const { cerrar } = useVentanas();
  const c = data.cuentas.find((x) => x.id === cuentaId);
  const [importe, setImporte] = useState('');
  const [error, setError] = useState('');
  if (!c) return null;
  const calculado = saldo(c, data.movimientos);
  const tarjeta = esTarjeta(c);

  function guardar(igual: boolean) {
    if (!c) return;
    const real = igual ? calculado : parseMoney(importe);
    if (real === null) {
      setError('Escribí el número que ves en tu banco o billetera.');
      return;
    }
    dispatch({ type: 'cuenta/confirmarSaldo', cuentaId: c.id, saldoReal: real, fecha: today(), ajusteId: newId() });
    huellita('actualizar-saldo');
    alGuardar?.();
    cerrar();
  }

  const real = parseMoney(importe);
  const diferencia = real === null ? null : real - calculado;

  return (
    <Modal titulo={`Actualizar ${c.nombre}`} onClose={cerrar}>
      <p>
        Según lo anotado, {tarjeta ? 'debés' : 'hay'} <strong>{formatMoney(calculado, c.moneda)}</strong>. Última confirmación:{' '}
        {formatDateMedium(c.confirmadoEn)}.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          guardar(false);
        }}
      >
        <Field label={tarjeta ? '¿Cuánto debés hoy?' : '¿Cuánto hay hoy?'} error={error || undefined}>
          <input data-autofoco className="input-importe" inputMode="decimal" value={importe} onChange={(e) => setImporte(e.target.value)} placeholder="0" />
        </Field>
        {diferencia !== null && diferencia !== 0 && (
          <Aviso>
            Hay una diferencia de {formatMoney(diferencia, c.moneda)}. Se registra como diferencia sin conciliar, sin categoría. No hace falta
            reconstruir de dónde salió.
          </Aviso>
        )}
        <div className="acciones acciones-final">
          <button type="button" className="btn" onClick={() => guardar(true)}>
            Está bien así
          </button>
          <button type="submit" className="btn principal grande" disabled={importe.trim() === ''}>
            Guardar
          </button>
        </div>
      </form>
    </Modal>
  );
}

/** Asignarle una cuenta a un gasto que se anotó sin cuenta. */
export function AsignarForm({ movimientoId }: { movimientoId: string }) {
  const { data, dispatch } = useStore();
  const { cerrar } = useVentanas();
  const m = data.movimientos.find((x) => x.id === movimientoId);
  const [cuentaId, setCuentaId] = useState('');
  if (!m) return null;
  const opciones = data.cuentas.filter((c) => !c.archivada && c.moneda === m.moneda);
  return (
    <Modal titulo="¿De qué cuenta salió?" onClose={cerrar}>
      <p>
        {m.comercio || 'Un gasto'} de <strong>{formatMoney(m.importe, m.moneda)}</strong>, el {formatDateMedium(m.fecha)}.
      </p>
      <Field label="Cuenta">
        <select data-autofoco value={cuentaId} onChange={(e) => setCuentaId(e.target.value)}>
          <option value="">Elegí una</option>
          {opciones.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </select>
      </Field>
      <div className="acciones acciones-final">
        <button type="button" className="btn" onClick={cerrar}>
          Ahora no
        </button>
        <button
          type="button"
          className="btn principal grande"
          disabled={!cuentaId}
          onClick={() => {
            const { updatedAt: _u, ...resto } = m;
            dispatch({ type: 'mov/editar', mov: { ...resto, cuentaId } });
            cerrar();
          }}
        >
          Guardar
        </button>
      </div>
    </Modal>
  );
}
