import { useState } from 'react';
import type { Compromiso, IngresoEsperado, Moneda, Recurrencia } from '../../types';
import { useStore } from '../../store/StoreContext';
import { useVentanas } from '../Ventanas';
import { Aviso, Field, Llave, Modal, Opciones } from '../ui';
import { centsToInput, parseMoney } from '../../lib/money';
import { addDays, distancia, formatDateMedium, today } from '../../lib/dates';
import { newId } from '../../lib/id';
import { esDeuda } from '../../lib/finanzas/saldos';
import type { Vencimiento } from '../../lib/finanzas/pendientes';
import { compromisoICS, descargar } from '../../lib/exportar';

const MONEDAS: { valor: Moneda; texto: string }[] = [
  { valor: 'ARS', texto: 'Pesos' },
  { valor: 'USD', texto: 'Dólares' },
];

export function CompromisoForm({ compromiso }: { compromiso?: Compromiso }) {
  const { data, dispatch } = useStore();
  const { cerrar } = useVentanas();
  const editando = compromiso !== undefined;
  const [nombre, setNombre] = useState(compromiso?.nombre ?? '');
  const [importe, setImporte] = useState(centsToInput(compromiso?.importe ?? null));
  const [aConfirmar, setAConfirmar] = useState(editando && compromiso.importe === null);
  const [moneda, setMoneda] = useState<Moneda>(compromiso?.moneda ?? 'ARS');
  const [venc, setVenc] = useState(compromiso?.vencimiento ?? addDays(today(), 7));
  const [mensual, setMensual] = useState(compromiso ? compromiso.recurrencia === 'mensual' : true);
  const [error, setError] = useState('');

  function armar(): Omit<Compromiso, 'updatedAt'> | null {
    const monto = aConfirmar ? null : parseMoney(importe);
    if (!nombre.trim()) {
      setError('Ponele un nombre, aunque sea corto: "Luz", "Alquiler".');
      return null;
    }
    if (!aConfirmar && (monto === null || monto <= 0)) {
      setError('Escribí el importe, o marcá que todavía no lo sabés.');
      return null;
    }
    return {
      id: compromiso?.id ?? newId(),
      nombre: nombre.trim(),
      importe: monto,
      moneda,
      vencimiento: venc || today(),
      recurrencia: (mensual ? 'mensual' : 'ninguna') as Recurrencia,
      pagado: compromiso?.pagado ?? false,
      pagoId: compromiso?.pagoId ?? null,
    };
  }

  return (
    <Modal titulo={editando ? 'Editar compromiso' : 'Algo que tengo que pagar'} onClose={cerrar}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const k = armar();
          if (!k) return;
          dispatch({ type: editando ? 'compromiso/editar' : 'compromiso/agregar', compromiso: k });
          cerrar();
        }}
      >
        <Field label="Qué es" error={error || undefined}>
          <input data-autofoco value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Alquiler, luz, cuota del gimnasio…" autoComplete="off" />
        </Field>
        <Field label="Cuándo vence">
          <input type="date" value={venc} onChange={(e) => setVenc(e.target.value)} />
        </Field>
        {!aConfirmar && (
          <Field label="Importe">
            <input className="input-importe" inputMode="decimal" value={importe} onChange={(e) => setImporte(e.target.value)} placeholder="0" />
          </Field>
        )}
        <Llave label="Todavía no sé cuánto es" ayuda="No lo inventamos: se avisa en Hoy que falta ese dato." checked={aConfirmar} onChange={setAConfirmar} />
        <Llave label="Se repite todos los meses" checked={mensual} onChange={setMensual} />
        <details className="plegable" open={editando && moneda === 'USD'}>
          <summary>Más opciones</summary>
          <Opciones legend="Moneda" valor={moneda} opciones={MONEDAS} onChange={setMoneda} />
        </details>
        <div className="acciones acciones-final">
          {editando && (
            <>
              <button
                type="button"
                className="btn peligro"
                onClick={() => {
                  dispatch({ type: 'compromiso/borrar', id: compromiso.id });
                  cerrar();
                }}
              >
                Borrar
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => {
                  const k = armar();
                  if (k) descargar(`vencimiento-${k.vencimiento}.ics`, compromisoICS({ ...k, updatedAt: '' }, data.preferencias, k.id), 'text/calendar');
                }}
              >
                Al calendario
              </button>
            </>
          )}
          <button type="submit" className="btn principal grande">
            Guardar
          </button>
        </div>
        {editando && (
          <p className="susurro">
            "Al calendario" baja un archivo para el calendario del teléfono, con recordatorio. Es lo que avisa aunque la app esté cerrada.
            {data.preferencias.calendarioConDetalle ? '' : ' Por privacidad dice solo "Vence un pago"; se cambia en Ajustes.'}
          </p>
        )}
      </form>
    </Modal>
  );
}

/**
 * "Ya lo pagué": para un compromiso o para el resumen de una tarjeta.
 *
 * Pagar la tarjeta es un pago de tarjeta, no un gasto: las compras ya se
 * contaron cuando se hicieron.
 */
export function PagarForm({ vencimiento, alPagar }: { vencimiento: Vencimiento; alPagar?: () => void }) {
  const { data, dispatch, huellita } = useStore();
  const { cerrar } = useVentanas();
  const cuentas = data.cuentas.filter((c) => !c.archivada && !esDeuda(c) && c.moneda === vencimiento.moneda);
  // Tarjeta o préstamo: se paga la deuda, no es un gasto nuevo.
  const tarjeta = vencimiento.tipo === 'tarjeta' || vencimiento.tipo === 'prestamo';
  const puedeConTarjeta = !tarjeta;
  const opciones = puedeConTarjeta ? data.cuentas.filter((c) => !c.archivada && c.moneda === vencimiento.moneda) : cuentas;
  const [cuentaId, setCuentaId] = useState(opciones[0]?.id ?? '');
  const [importe, setImporte] = useState(centsToInput(vencimiento.importe));
  const [error, setError] = useState('');

  function pagar(sinMovimiento: boolean) {
    const monto = parseMoney(importe);
    if (!sinMovimiento && (monto === null || monto <= 0)) {
      setError('Escribí cuánto pagaste.');
      return;
    }
    if (!sinMovimiento && !cuentaId) {
      setError('Elegí con qué cuenta pagaste.');
      return;
    }
    const hoy = today();
    if (tarjeta) {
      dispatch({
        type: 'mov/agregar',
        mov: {
          id: newId(),
          tipo: 'pago-tarjeta',
          importe: monto ?? 0,
          moneda: vencimiento.moneda,
          fecha: hoy,
          cuentaId,
          cuentaDestinoId: vencimiento.id,
          categoria: '',
          comercio: vencimiento.nombre,
          nota: '',
          cuotas: 1,
          devolucionDe: null,
          origen: 'manual',
          aRevisar: false,
        },
      });
    } else {
      dispatch({
        type: 'compromiso/pagar',
        id: vencimiento.id,
        siguienteId: newId(),
        pago: sinMovimiento
          ? null
          : {
              id: newId(),
              tipo: 'gasto',
              importe: monto ?? 0,
              moneda: vencimiento.moneda,
              fecha: hoy,
              cuentaId,
              cuentaDestinoId: null,
              categoria: '',
              comercio: vencimiento.nombre,
              nota: '',
              cuotas: 1,
              devolucionDe: null,
              origen: 'manual',
              aRevisar: false,
            },
      });
    }
    huellita('confirmar-compromiso');
    alPagar?.();
    cerrar();
  }

  return (
    <Modal titulo={`Pagar ${vencimiento.nombre}`} onClose={cerrar}>
      <p>
        Vence {distancia(today(), vencimiento.fecha)} ({formatDateMedium(vencimiento.fecha)}).
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          pagar(false);
        }}
      >
        <Field label="Cuánto pagaste" error={error || undefined}>
          <input data-autofoco className="input-importe" inputMode="decimal" value={importe} onChange={(e) => setImporte(e.target.value)} placeholder="0" />
        </Field>
        <Field label="Con qué">
          <select value={cuentaId} onChange={(e) => setCuentaId(e.target.value)}>
            <option value="">Elegí una cuenta</option>
            {opciones.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </Field>
        {tarjeta && (
          <Aviso>
            {vencimiento.tipo === 'prestamo'
              ? 'Pagar la cuota baja lo que debés; no se cuenta como gasto nuevo.'
              : 'Pagar la tarjeta no es un gasto nuevo: las compras ya se contaron cuando las anotaste.'}
          </Aviso>
        )}
        <div className="acciones acciones-final">
          {!tarjeta && (
            <button type="button" className="btn" onClick={() => pagar(true)}>
              Pagado, sin anotar el gasto
            </button>
          )}
          <button type="submit" className="btn principal grande">
            Ya lo pagué
          </button>
        </div>
        {!tarjeta && <p className="susurro">"Sin anotar el gasto" sirve si ya lo anotaste o si vas a actualizar el saldo de la cuenta.</p>}
      </form>
    </Modal>
  );
}

export function IngresoForm({ ingreso }: { ingreso?: IngresoEsperado }) {
  const { dispatch } = useStore();
  const { cerrar } = useVentanas();
  const editando = ingreso !== undefined;
  const [nombre, setNombre] = useState(ingreso?.nombre ?? '');
  const [importe, setImporte] = useState(centsToInput(ingreso?.importe ?? null));
  const [fecha, setFecha] = useState(ingreso?.fecha ?? addDays(today(), 7));
  const [variable, setVariable] = useState(ingreso?.variable ?? false);
  const [mensual, setMensual] = useState(ingreso ? ingreso.recurrencia === 'mensual' : true);
  const [moneda, setMoneda] = useState<Moneda>(ingreso?.moneda ?? 'ARS');
  const [error, setError] = useState('');

  return (
    <Modal titulo={editando ? 'Editar ingreso esperado' : 'Plata que espero cobrar'} onClose={cerrar}>
      <Aviso>No se suma a lo que podés usar hasta que la cobrás. Sirve para saber hasta cuándo tiene que durar lo que hay.</Aviso>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const monto = importe.trim() === '' ? null : parseMoney(importe);
          if (!nombre.trim()) {
            setError('Ponele un nombre: "Sueldo", "Cliente X".');
            return;
          }
          if (importe.trim() !== '' && (monto === null || monto <= 0)) {
            setError('Ese importe no se entiende.');
            return;
          }
          dispatch({
            type: editando ? 'ingreso/editar' : 'ingreso/agregar',
            ingreso: {
              id: ingreso?.id ?? newId(),
              nombre: nombre.trim(),
              importe: monto,
              moneda,
              fecha: fecha || today(),
              variable,
              recurrencia: mensual ? 'mensual' : 'ninguna',
              cobrado: ingreso?.cobrado ?? false,
            },
          });
          cerrar();
        }}
      >
        <Field label="Qué es" error={error || undefined}>
          <input data-autofoco value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Sueldo, un trabajo, una seña…" autoComplete="off" />
        </Field>
        <Field label="Cuándo creés que entra">
          <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </Field>
        <Field label="Cuánto, más o menos (opcional)">
          <input className="input-importe" inputMode="decimal" value={importe} onChange={(e) => setImporte(e.target.value)} placeholder="0" />
        </Field>
        <Llave label="Varía de un mes a otro" checked={variable} onChange={setVariable} />
        <Llave label="Se repite todos los meses" checked={mensual} onChange={setMensual} />
        <details className="plegable" open={editando && moneda === 'USD'}>
          <summary>Más opciones</summary>
          <Opciones legend="Moneda" valor={moneda} opciones={MONEDAS} onChange={setMoneda} />
        </details>
        <div className="acciones acciones-final">
          {editando && (
            <button
              type="button"
              className="btn peligro"
              onClick={() => {
                dispatch({ type: 'ingreso/borrar', id: ingreso.id });
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
      </form>
    </Modal>
  );
}

export function CobrarForm({ ingresoId }: { ingresoId: string }) {
  const { data, dispatch } = useStore();
  const { cerrar } = useVentanas();
  const i = data.ingresos.find((x) => x.id === ingresoId);
  const cuentas = data.cuentas.filter((c) => !c.archivada && !esDeuda(c) && c.moneda === i?.moneda);
  const [cuentaId, setCuentaId] = useState(cuentas[0]?.id ?? '');
  const [importe, setImporte] = useState(centsToInput(i?.importe ?? null));
  const [error, setError] = useState('');
  if (!i) return null;
  return (
    <Modal titulo={`Cobré ${i.nombre}`} onClose={cerrar}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const monto = parseMoney(importe);
          if (monto === null || monto <= 0) return setError('Escribí cuánto entró.');
          if (!cuentaId) return setError('Elegí a qué cuenta entró.');
          dispatch({
            type: 'ingreso/cobrar',
            id: i.id,
            siguienteId: newId(),
            cobro: {
              id: newId(),
              tipo: 'ingreso',
              importe: monto,
              moneda: i.moneda,
              fecha: today(),
              cuentaId,
              cuentaDestinoId: null,
              categoria: 'Ingresos',
              comercio: i.nombre,
              nota: '',
              cuotas: 1,
              devolucionDe: null,
              origen: 'manual',
              aRevisar: false,
            },
          });
          cerrar();
        }}
      >
        <Field label="Cuánto entró" error={error || undefined}>
          <input data-autofoco className="input-importe" inputMode="decimal" value={importe} onChange={(e) => setImporte(e.target.value)} />
        </Field>
        <Field label="A qué cuenta">
          <select value={cuentaId} onChange={(e) => setCuentaId(e.target.value)}>
            <option value="">Elegí una</option>
            {cuentas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </Field>
        {i.recurrencia === 'mensual' && <p className="susurro">Queda agendado el del mes que viene.</p>}
        <div className="acciones acciones-final">
          <button type="submit" className="btn principal grande">
            Guardar
          </button>
        </div>
      </form>
    </Modal>
  );
}

