import { useState } from 'react';
import type { Meta, Moneda } from '../../types';
import { useStore } from '../../store/StoreContext';
import { useVentanas } from '../Ventanas';
import { Aviso, Field, Modal, Opciones } from '../ui';
import { centsToInput, formatMoney, parseMoney } from '../../lib/money';
import { today } from '../../lib/dates';
import { newId } from '../../lib/id';
import { esTarjeta, saldo } from '../../lib/finanzas/saldos';
import { miniatura } from '../../lib/imagen';
import { mensaje } from '../../lib/companero';
import { reservado } from '../../lib/finanzas/metas';

export function MetaForm({ meta, esReserva = false }: { meta?: Meta; esReserva?: boolean }) {
  const { dispatch } = useStore();
  const { cerrar } = useVentanas();
  const editando = meta !== undefined;
  const reserva = meta?.esReserva ?? esReserva;
  const [nombre, setNombre] = useState(meta?.nombre ?? (reserva ? 'Reserva para imprevistos' : ''));
  const [objetivo, setObjetivo] = useState(centsToInput(meta?.objetivo ?? null));
  const [moneda, setMoneda] = useState<Moneda>(meta?.moneda ?? 'ARS');
  const [fecha, setFecha] = useState(meta?.fecha ?? '');
  const [paso, setPaso] = useState(meta?.pasoChico ?? '');
  const [imagen, setImagen] = useState(meta?.imagen ?? '');
  const [hitos, setHitos] = useState((meta?.hitos ?? []).map((h) => centsToInput(h)).join(' / '));
  const [esenciales, setEsenciales] = useState(centsToInput(meta?.esencialesPorMes ?? null));
  const [error, setError] = useState('');

  function guardar() {
    if (!nombre.trim()) return setError('Ponele un nombre.');
    const obj = objetivo.trim() === '' ? null : parseMoney(objetivo);
    if (objetivo.trim() !== '' && (obj === null || obj <= 0)) return setError('Ese importe no se entiende.');
    const listaHitos = hitos
      .split(/[/;]/)
      .map((h) => parseMoney(h))
      .filter((h): h is number => h !== null && h > 0)
      .sort((a, b) => a - b);
    const esenc = esenciales.trim() === '' ? null : parseMoney(esenciales);
    dispatch({
      type: editando ? 'meta/editar' : 'meta/agregar',
      meta: {
        id: meta?.id ?? newId(),
        nombre: nombre.trim(),
        imagen,
        objetivo: obj,
        moneda,
        fecha: fecha || null,
        pasoChico: paso.trim(),
        destacada: meta?.destacada ?? false,
        esReserva: reserva,
        hitos: reserva ? listaHitos : [],
        esencialesPorMes: reserva && esenc !== null && esenc > 0 ? esenc : null,
      },
    });
    cerrar();
  }

  return (
    <Modal titulo={editando ? 'Editar' : reserva ? 'Reserva para imprevistos' : 'Nueva meta'} onClose={cerrar}>
      {reserva && !editando && (
        <Aviso>Es plata para cuando algo sale distinto. Usarla es para lo que existe, no un fracaso.</Aviso>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          guardar();
        }}
      >
        <Field label="Nombre" error={error || undefined}>
          <input data-autofoco value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Vacaciones, bici, arreglar la heladera…" autoComplete="off" />
        </Field>
        <Field label={reserva ? 'Primer hito (opcional)' : 'Cuánto necesitás (opcional)'} ayuda={reserva ? 'Un número que te parezca alcanzable. Después podés agregar más.' : undefined}>
          <input className="input-importe" inputMode="decimal" value={objetivo} onChange={(e) => setObjetivo(e.target.value)} placeholder="0" />
        </Field>
        <Field label="Próximo paso chiquito (opcional)" ayuda='Algo que se pueda hacer en cinco minutos. Por ejemplo: "Averiguar precios".'>
          <input value={paso} onChange={(e) => setPaso(e.target.value)} autoComplete="off" />
        </Field>
        <details className="plegable" open={editando && Boolean(meta.fecha || meta.imagen || meta.moneda === 'USD' || meta.hitos.length)}>
          <summary>Más opciones</summary>
          {!reserva && (
            <Field label="Para cuándo, más o menos" ayuda="Es flexible: si no llega, se mueve.">
              <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
            </Field>
          )}
          <Opciones
            legend="Moneda"
            valor={moneda}
            opciones={[
              { valor: 'ARS', texto: 'Pesos' },
              { valor: 'USD', texto: 'Dólares' },
            ]}
            onChange={setMoneda}
          />
          {reserva && (
            <>
              <Field label="Otros hitos" ayuda="Separados por barra, por ejemplo: 100000 / 300000 / 600000.">
                <input value={hitos} onChange={(e) => setHitos(e.target.value)} autoComplete="off" />
              </Field>
              <Field label="Gastos esenciales de un mes (opcional)" ayuda='Con esto se puede decir "cubre N meses". Es tu estimación, y se muestra como tal.'>
                <input className="input-importe" inputMode="decimal" value={esenciales} onChange={(e) => setEsenciales(e.target.value)} placeholder="0" />
              </Field>
            </>
          )}
          <Field label="Imagen (opcional)" ayuda="Queda solo en este teléfono.">
            <input
              type="file"
              accept="image/*"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                try {
                  setImagen(await miniatura(f));
                } catch {
                  setError('No pude abrir esa imagen. Probá con otra.');
                }
              }}
            />
          </Field>
          {imagen && (
            <div className="meta-imagen-editar">
              <img src={imagen} alt="" />
              <button type="button" className="btn chico" onClick={() => setImagen('')}>
                Quitar imagen
              </button>
            </div>
          )}
        </details>
        <div className="acciones acciones-final">
          {editando && (
            <button
              type="button"
              className="btn peligro"
              onClick={() => {
                dispatch({ type: 'meta/borrar', id: meta.id });
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

/**
 * Poner plata en una meta, o sacarla.
 *
 * "Apartar acá" deja la plata en la misma cuenta y la separa solo adentro de
 * la app. "Moverla de verdad" registra una transferencia a otra cuenta: la
 * app no mueve plata, anota que la moviste vos.
 */
export function AporteForm({ metaId, usar = false }: { metaId: string; usar?: boolean }) {
  const { data, dispatch } = useStore();
  const { cerrar } = useVentanas();
  const meta = data.metas.find((m) => m.id === metaId);
  const cuentas = data.cuentas.filter((c) => !c.archivada && !esTarjeta(c) && c.moneda === meta?.moneda);
  const [importe, setImporte] = useState('');
  const [forma, setForma] = useState<'virtual' | 'real'>('virtual');
  const [cuentaId, setCuentaId] = useState(cuentas[0]?.id ?? '');
  const [destinoId, setDestinoId] = useState('');
  const [error, setError] = useState('');
  if (!meta) return null;
  const hay = reservado(meta, data.aportes);
  const cuentaDeLaMeta = (id: string) => data.aportes.filter((a) => a.metaId === meta.id && a.cuentaId === id).reduce((s, a) => s + a.importe, 0);

  function guardar() {
    if (!meta) return;
    const monto = parseMoney(importe);
    if (monto === null || monto <= 0) return setError('Escribí un importe.');
    if (usar && monto > hay) return setError(`En esta meta hay ${formatMoney(hay, meta.moneda)}.`);
    if (!cuentaId) return setError('Elegí una cuenta.');
    if (usar && cuentaDeLaMeta(cuentaId) < monto) {
      return setError(`En ${data.cuentas.find((c) => c.id === cuentaId)?.nombre} hay ${formatMoney(cuentaDeLaMeta(cuentaId), meta.moneda)} de esta meta.`);
    }
    if (!usar && forma === 'real' && (!destinoId || destinoId === cuentaId)) return setError('Elegí a qué otra cuenta la moviste.');
    const cuentaFinal = !usar && forma === 'real' ? destinoId : cuentaId;
    dispatch({
      type: 'aporte/agregar',
      aporte: { id: newId(), metaId: meta.id, importe: usar ? -monto : monto, fecha: today(), forma: usar ? 'virtual' : forma, cuentaId: cuentaFinal, nota: '' },
      transferencia:
        !usar && forma === 'real'
          ? {
              id: newId(),
              tipo: 'transferencia',
              importe: monto,
              moneda: meta.moneda,
              fecha: today(),
              cuentaId,
              cuentaDestinoId: destinoId,
              categoria: '',
              comercio: meta.nombre,
              nota: 'Aporte a una meta',
              cuotas: 1,
              devolucionDe: null,
              origen: 'manual',
              aRevisar: false,
            }
          : null,
    });
    cerrar();
  }

  const conPlata = usar ? cuentas.filter((c) => cuentaDeLaMeta(c.id) > 0) : cuentas;

  return (
    <Modal titulo={usar ? `Usar plata de ${meta.nombre}` : `Apartar para ${meta.nombre}`} onClose={cerrar}>
      {usar && meta.esReserva && <p className="susurro">{mensaje('usar-reserva', data.preferencias.trato)}</p>}
      {cuentas.length === 0 ? (
        <Aviso>Primero hace falta una cuenta en {meta.moneda === 'USD' ? 'dólares' : 'pesos'}. Se carga en Mi plata.</Aviso>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            guardar();
          }}
        >
          <Field label="Cuánto" error={error || undefined}>
            <input data-autofoco className="input-importe" inputMode="decimal" value={importe} onChange={(e) => setImporte(e.target.value)} placeholder="0" />
          </Field>
          {!usar && (
            <Opciones
              legend="Cómo"
              valor={forma}
              opciones={[
                { valor: 'virtual', texto: 'Apartarla acá (queda en la misma cuenta)' },
                { valor: 'real', texto: 'La moví a otra cuenta' },
              ]}
              onChange={setForma}
            />
          )}
          <Field label={usar ? 'De qué cuenta' : forma === 'real' ? 'Desde qué cuenta' : 'En qué cuenta está'}>
            <select value={cuentaId} onChange={(e) => setCuentaId(e.target.value)}>
              <option value="">Elegí una</option>
              {conPlata.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre} ({formatMoney(saldo(c, data.movimientos), c.moneda)})
                </option>
              ))}
            </select>
          </Field>
          {!usar && forma === 'real' && (
            <Field label="A qué cuenta" ayuda="La app no mueve plata: anota que la moviste vos.">
              <select value={destinoId} onChange={(e) => setDestinoId(e.target.value)}>
                <option value="">Elegí una</option>
                {cuentas
                  .filter((c) => c.id !== cuentaId)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre}
                    </option>
                  ))}
              </select>
            </Field>
          )}
          {!usar && forma === 'virtual' && <p className="susurro">La plata sigue en tu cuenta; deja de contarse en lo que podés usar.</p>}
          <div className="acciones acciones-final">
            <button type="submit" className="btn principal grande">
              {usar ? 'Usar' : 'Apartar'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
