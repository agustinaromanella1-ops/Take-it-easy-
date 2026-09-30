import { useEffect, useMemo, useRef, useState } from 'react';
import type { Cuenta, Moneda, Movimiento } from '../types';
import { useStore } from '../store/StoreContext';
import { useVentanas } from './Ventanas';
import { Aviso, Field, Modal, Opciones, Progreso } from './ui';
import { extraer, type Campo, type Destino, type MedioPago, type Propuesta } from '../lib/comprobantes/extraer';
import { leerTexto, LecturaCancelada, type Etapa } from '../lib/comprobantes/ocr';
import { prepararParaLeer, SIN_RECORTE, type Recorte } from '../lib/imagen';
import { centsToInput, formatMoney, parseMoney } from '../lib/money';
import { formatDateMedium, today } from '../lib/dates';
import { newId } from '../lib/id';
import { CATEGORIAS } from '../lib/texto/categorias';
import { posiblesDuplicados } from '../lib/finanzas/duplicados';
import { esTarjeta } from '../lib/finanzas/saldos';

/**
 * Leer un comprobante: elegir la imagen, leerla, revisar y guardar.
 *
 * La imagen se lee en el teléfono y NO se guarda: al cerrar este cuadro se
 * suelta. Lo que se guarda es el movimiento que la persona confirma, con su
 * origen anotado ("comprobante").
 *
 * Si algo no se pudo leer, se pregunta. Nunca se muestra un importe como
 * "leído" si no salió del texto.
 */

type Paso =
  | { tipo: 'elegir' }
  | { tipo: 'preparar' }
  | { tipo: 'leyendo'; etapa: Etapa; avance: number }
  | { tipo: 'revisar'; propuesta: Propuesta | null }
  | { tipo: 'ilegible' }
  | { tipo: 'error'; mensaje: string };

const DESTINOS: { valor: Destino; texto: string }[] = [
  { valor: 'gasto', texto: 'Un gasto hecho' },
  { valor: 'compromiso', texto: 'Algo a pagar' },
  { valor: 'transferencia', texto: 'Entre mis cuentas' },
  { valor: 'pago-tarjeta', texto: 'Pago de tarjeta' },
];

function cuentaPara(medio: MedioPago | null, cuentas: Cuenta[], moneda: Moneda): string {
  const tipo = { efectivo: 'efectivo', debito: 'banco', credito: 'tarjeta-credito', billetera: 'billetera', transferencia: 'banco' } as const;
  if (!medio) return '';
  return cuentas.find((c) => c.tipo === tipo[medio] && c.moneda === moneda && !c.archivada)?.id ?? '';
}

export function Comprobante() {
  const { cerrar } = useVentanas();
  const [archivo, setArchivo] = useState<Blob | null>(null);
  const [recorte, setRecorte] = useState<Recorte>(SIN_RECORTE);
  const [paso, setPaso] = useState<Paso>({ tipo: 'elegir' });
  const cancelar = useRef<AbortController | null>(null);
  const url = useMemo(() => (archivo ? URL.createObjectURL(archivo) : null), [archivo]);

  // La imagen se suelta al cerrar o al cambiarla: no queda en ningún lado.
  useEffect(() => () => {
    if (url) URL.revokeObjectURL(url);
  }, [url]);
  useEffect(() => () => cancelar.current?.abort(), []);

  async function leer() {
    if (!archivo) return;
    const control = new AbortController();
    cancelar.current = control;
    setPaso({ tipo: 'leyendo', etapa: 'cargando', avance: 0 });
    try {
      const imagen = await prepararParaLeer(archivo, recorte);
      const texto = await leerTexto(imagen, (etapa, avance) => setPaso({ tipo: 'leyendo', etapa, avance }), control.signal);
      const propuesta = extraer(texto, today());
      setPaso(propuesta.legible ? { tipo: 'revisar', propuesta } : { tipo: 'ilegible' });
    } catch (e) {
      if (e instanceof LecturaCancelada) {
        setPaso({ tipo: 'preparar' });
        return;
      }
      setPaso({ tipo: 'error', mensaje: e instanceof Error ? e.message : 'No se pudo leer.' });
    }
  }

  function elegido(f: File | undefined) {
    if (!f) return;
    if (!f.type.startsWith('image/')) {
      setPaso({ tipo: 'error', mensaje: 'Ese archivo no es una imagen. Por ahora se leen fotos y capturas.' });
      return;
    }
    setArchivo(f);
    setRecorte(SIN_RECORTE);
    setPaso({ tipo: 'preparar' });
  }

  const vista = url && (
    <div className="comprobante-imagen">
      <img
        src={url}
        alt="El comprobante elegido"
        style={{
          transform: `rotate(${recorte.giro * 90}deg)`,
          clipPath: `inset(${recorte.arriba}% ${recorte.derecha}% ${recorte.abajo}% ${recorte.izquierda}%)`,
        }}
      />
    </div>
  );

  const recortar = (
    <details className="plegable">
      <summary>Recortar o girar</summary>
      {(['arriba', 'abajo', 'izquierda', 'derecha'] as const).map((borde) => (
        <Field key={borde} label={`Recortar ${borde === 'arriba' || borde === 'abajo' ? 'de' : 'a la'} ${borde}: ${recorte[borde]}%`}>
          <input type="range" min={0} max={45} value={recorte[borde]} onChange={(e) => setRecorte((r) => ({ ...r, [borde]: Number(e.target.value) }))} />
        </Field>
      ))}
      <button type="button" className="btn chico" onClick={() => setRecorte((r) => ({ ...r, giro: ((r.giro + 1) % 4) as Recorte['giro'] }))}>
        Girar un cuarto
      </button>
    </details>
  );

  const elegir = (
    <div className="elegir-imagen">
      <label className="btn principal grande boton-archivo">
        Sacar una foto
        <input type="file" accept="image/*" capture="environment" onChange={(e) => elegido(e.target.files?.[0])} />
      </label>
      <label className="btn grande boton-archivo">
        Elegir una imagen o captura
        <input type="file" accept="image/*" onChange={(e) => elegido(e.target.files?.[0])} data-testid="elegir-imagen" />
      </label>
    </div>
  );

  return (
    <Modal titulo="Leer un comprobante" onClose={cerrar} ancho>
      {paso.tipo === 'elegir' && (
        <>
          <p>Tickets, comprobantes de pago o de transferencia, y facturas de servicios.</p>
          {elegir}
          <p className="susurro">La imagen se lee acá, en tu teléfono. No se guarda ni se manda a ningún lado.</p>
          <button type="button" className="btn-texto" onClick={() => setPaso({ tipo: 'revisar', propuesta: null })}>
            Prefiero completarlo a mano
          </button>
        </>
      )}

      {paso.tipo === 'preparar' && (
        <>
          {vista}
          {recortar}
          <div className="acciones acciones-final">
            <button type="button" className="btn" onClick={() => setPaso({ tipo: 'elegir' })}>
              Elegir otra
            </button>
            <button type="button" className="btn principal grande" onClick={leer} data-autofoco>
              Leer
            </button>
          </div>
        </>
      )}

      {paso.tipo === 'leyendo' && (
        <div aria-live="polite">
          {vista}
          <Progreso
            valor={paso.avance}
            max={1}
            texto={paso.etapa === 'cargando' ? 'Preparando el lector (la primera vez tarda un poco más)…' : `Leyendo… ${Math.round(paso.avance * 100)}%`}
          />
          <div className="acciones acciones-final">
            <button type="button" className="btn" onClick={() => cancelar.current?.abort()}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {paso.tipo === 'ilegible' && (
        <>
          {vista}
          <Aviso tono="warn">No pude leer esta imagen. No es tu culpa: pasa con fotos movidas, con poca luz o muy de lejos.</Aviso>
          {recortar}
          <div className="acciones">
            <button type="button" className="btn" onClick={leer}>
              Probar de nuevo
            </button>
            <label className="btn boton-archivo">
              Sacar otra
              <input type="file" accept="image/*" capture="environment" onChange={(e) => elegido(e.target.files?.[0])} />
            </label>
            <button type="button" className="btn principal" onClick={() => setPaso({ tipo: 'revisar', propuesta: null })}>
              Completar a mano
            </button>
          </div>
        </>
      )}

      {paso.tipo === 'error' && (
        <>
          {vista}
          <Aviso tono="error">{paso.mensaje} Podés completarlo a mano mirando la imagen.</Aviso>
          <div className="acciones">
            {archivo ? (
              <button type="button" className="btn" onClick={leer}>
                Probar de nuevo
              </button>
            ) : (
              elegir
            )}
            <button type="button" className="btn principal" onClick={() => setPaso({ tipo: 'revisar', propuesta: null })}>
              Completar a mano
            </button>
          </div>
        </>
      )}

      {paso.tipo === 'revisar' && <Revisar propuesta={paso.propuesta} vista={vista} />}
    </Modal>
  );
}

function Revisar({ propuesta, vista }: { propuesta: Propuesta | null; vista: React.ReactNode }) {
  const { data, dispatch, huellita } = useStore();
  const { cerrar } = useVentanas();
  const moneda0 = propuesta?.moneda ?? 'ARS';
  const [destino, setDestino] = useState<Destino>(propuesta?.destino ?? 'gasto');
  const [importe, setImporte] = useState(centsToInput(propuesta?.total ?? null));
  const [moneda, setMoneda] = useState<Moneda>(moneda0);
  const [fecha, setFecha] = useState(propuesta?.fecha && propuesta.fecha <= today() ? propuesta.fecha : today());
  const [venc, setVenc] = useState(propuesta?.vencimiento ?? '');
  const [comercio, setComercio] = useState(propuesta?.comercio ?? '');
  const [categoria, setCategoria] = useState(propuesta?.categoria ?? '');
  const [cuentaId, setCuentaId] = useState(cuentaPara(propuesta?.medioPago ?? null, data.cuentas, moneda0));
  const [destinoId, setDestinoId] = useState('');
  const [error, setError] = useState('');
  const [duplicados, setDuplicados] = useState<Movimiento[]>([]);
  const dudoso = (c: Campo) => propuesta !== null && propuesta.dudosos.includes(c);

  const cuentas = data.cuentas.filter((c) => !c.archivada && c.moneda === moneda);
  const tarjetas = cuentas.filter(esTarjeta);
  const noTarjetas = cuentas.filter((c) => !esTarjeta(c));

  function guardar(aunqueParezcaRepetido = false) {
    const monto = parseMoney(importe);
    if (monto === null || monto <= 0) return setError('Escribí el importe mirando la imagen.');
    if (destino === 'compromiso') {
      dispatch({
        type: 'compromiso/agregar',
        compromiso: { id: newId(), nombre: comercio.trim() || 'Factura', importe: monto, moneda, vencimiento: venc || fecha, recurrencia: 'ninguna', pagado: false, pagoId: null },
      });
      huellita('comprobante');
      cerrar();
      return;
    }
    if ((destino === 'transferencia' || destino === 'pago-tarjeta') && (!cuentaId || !destinoId || cuentaId === destinoId)) {
      return setError(destino === 'transferencia' ? 'Elegí de qué cuenta salió y a cuál fue.' : 'Elegí la tarjeta y desde qué cuenta la pagaste.');
    }
    const tipo = destino === 'gasto' ? 'gasto' : destino;
    const mov: Omit<Movimiento, 'updatedAt'> = {
      id: newId(),
      tipo,
      importe: monto,
      moneda,
      fecha,
      cuentaId: cuentaId || null,
      cuentaDestinoId: tipo === 'gasto' ? null : destinoId,
      categoria: tipo === 'gasto' ? categoria : '',
      comercio: comercio.trim(),
      nota: propuesta?.cuota ? `Cuota ${propuesta.cuota.numero} de ${propuesta.cuota.de}` : '',
      cuotas: 1,
      devolucionDe: null,
      origen: 'comprobante',
      aRevisar: false,
    };
    if (!aunqueParezcaRepetido) {
      const dups = posiblesDuplicados(mov, data.movimientos);
      if (dups.length > 0) {
        setDuplicados(dups);
        return;
      }
    }
    dispatch({ type: 'mov/agregar', mov });
    huellita('comprobante');
    cerrar();
  }

  const marca = (c: Campo) => (dudoso(c) ? <span className="dudoso-marca">Revisá esto</span> : null);

  return (
    <div className="revisar">
      {vista}
      {propuesta ? (
        <p className="susurro">Esto es lo que leí. Lo marcado con "Revisá esto" no estaba claro.</p>
      ) : (
        <p className="susurro">Completalo mirando la imagen. Nada se completa solo.</p>
      )}
      {propuesta?.avisos.map((a) => (
        <Aviso key={a} tono="warn">
          {a}
        </Aviso>
      ))}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          guardar();
        }}
      >
        <div className={dudoso('tipo') ? 'dudoso' : undefined}>
          {marca('tipo')}
          <Opciones legend="Qué es" valor={destino} opciones={DESTINOS} onChange={setDestino} />
        </div>
        <div className={dudoso('total') ? 'dudoso' : undefined}>
          {marca('total')}
          <Field label="Importe total" error={error || undefined}>
            <input data-autofoco className="input-importe" inputMode="decimal" value={importe} onChange={(e) => setImporte(e.target.value)} placeholder="0" />
          </Field>
        </div>
        <div className={dudoso('moneda') ? 'dudoso' : undefined}>
          {marca('moneda')}
          <Opciones
            legend="Moneda"
            valor={moneda}
            opciones={[
              { valor: 'ARS', texto: 'Pesos' },
              { valor: 'USD', texto: 'Dólares' },
            ]}
            onChange={(m) => {
              setMoneda(m);
              setCuentaId('');
              setDestinoId('');
            }}
          />
        </div>
        <div className={dudoso('comercio') ? 'dudoso' : undefined}>
          {marca('comercio')}
          <Field label={destino === 'compromiso' ? 'De qué es' : 'Dónde o a quién'}>
            <input value={comercio} onChange={(e) => setComercio(e.target.value)} autoComplete="off" />
          </Field>
        </div>
        {destino === 'compromiso' ? (
          <div className={dudoso('vencimiento') ? 'dudoso' : undefined}>
            {marca('vencimiento')}
            <Field label="Vence">
              <input type="date" value={venc} onChange={(e) => setVenc(e.target.value)} />
            </Field>
          </div>
        ) : (
          <div className={dudoso('fecha') ? 'dudoso' : undefined}>
            {marca('fecha')}
            <Field label="Fecha">
              <input type="date" value={fecha} max={today()} onChange={(e) => setFecha(e.target.value)} />
            </Field>
          </div>
        )}
        {destino === 'pago-tarjeta' && (
          <Field label="Qué tarjeta">
            <select value={destinoId} onChange={(e) => setDestinoId(e.target.value)}>
              <option value="">Elegí una</option>
              {tarjetas.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </Field>
        )}
        {destino !== 'compromiso' && (
          <Field label={destino === 'gasto' ? 'Con qué pagaste (opcional)' : 'Desde qué cuenta'}>
            <select value={cuentaId} onChange={(e) => setCuentaId(e.target.value)}>
              <option value="">{destino === 'gasto' ? 'Sin cuenta por ahora' : 'Elegí una'}</option>
              {(destino === 'gasto' ? cuentas : noTarjetas).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </Field>
        )}
        {destino === 'transferencia' && (
          <Field label="A qué cuenta tuya fue" ayuda='Si fue a otra persona, elegí "Un gasto hecho".'>
            <select value={destinoId} onChange={(e) => setDestinoId(e.target.value)}>
              <option value="">Elegí una</option>
              {noTarjetas
                .filter((c) => c.id !== cuentaId)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
            </select>
          </Field>
        )}
        {destino === 'gasto' && (
          <Field label="Categoría (opcional)">
            <select value={categoria} onChange={(e) => setCategoria(e.target.value)}>
              <option value="">Sin categoría</option>
              {CATEGORIAS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>
        )}

        {duplicados.length > 0 && (
          <div className="duplicado" role="alert">
            <p>
              Parece que ya lo anotaste:{' '}
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

        <div className="acciones acciones-final">
          <button type="submit" className="btn principal grande">
            Guardar
          </button>
        </div>
      </form>
    </div>
  );
}
