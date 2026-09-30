import { useMemo, useRef, useState } from 'react';
import type { Movimiento } from '../types';
import { useStore } from '../store/StoreContext';
import { useVentanas } from './Ventanas';
import { Aviso, Field, Modal, Progreso } from './ui';
import { conciliar, consumoComoCompra, leerResumen, type ResumenLeido } from '../lib/comprobantes/resumen';
import { leerTexto, LecturaCancelada } from '../lib/comprobantes/ocr';
import { prepararParaLeer, SIN_RECORTE } from '../lib/imagen';
import { centsToInput, formatMoney, parseMoney } from '../lib/money';
import { formatDateMedium } from '../lib/dates';
import { newId } from '../lib/id';

/**
 * Revisar la tarjeta con su resumen.
 *
 * Se compara lo que el banco dice que debías al cierre con lo que dice la app.
 * Si no coincide, se muestra de dónde sale la diferencia: consumos que no se
 * anotaron, intereses e impuestos. La persona elige qué agregar; lo que quede
 * se puede registrar como diferencia sin conciliar. Nada se agrega solo.
 */
export function LeerResumen({ tarjetaId }: { tarjetaId: string }) {
  const { data, dispatch, huellita } = useStore();
  const { cerrar } = useVentanas();
  const tarjeta = data.cuentas.find((c) => c.id === tarjetaId);
  const [texto, setTexto] = useState('');
  const [leido, setLeido] = useState<ResumenLeido | null>(null);
  const [leyendo, setLeyendo] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [cierreManual, setCierreManual] = useState('');
  const [totalManual, setTotalManual] = useState('');
  const [sinFaltantes, setSinFaltantes] = useState<Set<number>>(new Set());
  const [conCargos, setConCargos] = useState(true);
  const [conAjuste, setConAjuste] = useState(true);
  const cancelar = useRef<AbortController | null>(null);

  const efectivo: ResumenLeido | null = useMemo(() => {
    if (!leido) return null;
    const total = totalManual.trim() ? parseMoney(totalManual) : leido.total;
    return { ...leido, cierre: cierreManual || leido.cierre, total };
  }, [leido, cierreManual, totalManual]);

  const c = useMemo(() => (tarjeta && efectivo ? conciliar(tarjeta, data.movimientos, efectivo) : null), [tarjeta, efectivo, data.movimientos]);
  if (!tarjeta) return null;

  async function desdeImagen(f: File | undefined) {
    if (!f) return;
    const control = new AbortController();
    cancelar.current = control;
    setLeyendo(0);
    setError('');
    try {
      const img = await prepararParaLeer(f, SIN_RECORTE, 2400);
      const t = await leerTexto(img, (_e, avance) => setLeyendo(avance), control.signal);
      setLeido(leerResumen(t));
    } catch (e) {
      if (!(e instanceof LecturaCancelada)) setError('No se pudo leer la imagen. Probá pegando el texto del PDF.');
    } finally {
      setLeyendo(null);
    }
  }

  const cargosTotal = c ? c.cargos.reduce((s, l) => s + l.importe, 0) : 0;
  const faltantesElegidos = c ? c.faltantes.filter((_, i) => !sinFaltantes.has(i)) : [];
  const queda = c ? c.diferencia - faltantesElegidos.reduce((s, l) => s + l.importe, 0) - (conCargos ? cargosTotal : 0) : 0;

  function guardar() {
    if (!tarjeta || !c) return;
    const base = {
      moneda: tarjeta.moneda,
      cuentaId: tarjeta.id,
      cuentaDestinoId: null,
      devolucionDe: null,
      origen: 'resumen' as const,
      aRevisar: false,
    };
    const movs: Omit<Movimiento, 'updatedAt'>[] = faltantesElegidos.map((l) => {
      const x = consumoComoCompra(l, c.cierre, tarjeta.fechaSaldo);
      return { ...base, id: newId(), tipo: 'gasto', importe: x.importe, fecha: x.fecha, cuotas: x.cuotas, comercio: l.descripcion, categoria: '', nota: x.nota };
    });
    if (conCargos && cargosTotal > 0) {
      movs.push({ ...base, id: newId(), tipo: 'gasto', importe: cargosTotal, fecha: c.cierre, cuotas: 1, comercio: `Intereses y cargos de ${tarjeta.nombre}`, categoria: 'Intereses y cargos', nota: 'Tomado del resumen' });
    }
    if (conAjuste && queda !== 0) {
      movs.push({ ...base, id: newId(), tipo: 'ajuste', importe: queda, fecha: c.cierre, cuotas: 1, comercio: '', categoria: '', nota: 'Diferencia sin conciliar con el resumen' });
    }
    if (movs.length) dispatch({ type: 'mov/agregarVarios', movs, origen: 'resumen' });
    huellita('revisar-movimientos');
    cerrar();
  }

  return (
    <Modal titulo={`Resumen de ${tarjeta.nombre}`} onClose={cerrar} ancho>
      {!leido && leyendo === null && (
        <>
          <p>La forma más precisa es copiar el texto del PDF del banco y pegarlo. También sirve una foto o captura.</p>
          <Field label="Texto del resumen">
            <textarea data-autofoco rows={6} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Pegá acá el texto del PDF" />
          </Field>
          <div className="acciones">
            <button type="button" className="btn principal" disabled={!texto.trim()} onClick={() => setLeido(leerResumen(texto))}>
              Leer el texto
            </button>
            <label className="btn boton-archivo">
              Usar una foto
              <input type="file" accept="image/*" onChange={(e) => void desdeImagen(e.target.files?.[0])} />
            </label>
          </div>
          {error && <Aviso tono="error">{error}</Aviso>}
          <p className="susurro">Todo se lee en tu teléfono. El texto y la imagen no se guardan.</p>
        </>
      )}

      {leyendo !== null && (
        <div aria-live="polite">
          <Progreso valor={leyendo} max={1} texto={`Leyendo… ${Math.round(leyendo * 100)}%`} />
          <button type="button" className="btn" onClick={() => cancelar.current?.abort()}>
            Cancelar
          </button>
        </div>
      )}

      {leido && (
        <>
          {(!leido.cierre || leido.total === null) && (
            <Aviso tono="warn">No encontré {!leido.cierre ? 'la fecha de cierre' : 'el saldo actual'}. Completalo mirando el resumen.</Aviso>
          )}
          <div className="fila">
            <Field label="Cierre">
              <input type="date" value={cierreManual || leido.cierre || ''} onChange={(e) => setCierreManual(e.target.value)} />
            </Field>
            <Field label="Saldo actual del resumen">
              <input inputMode="decimal" value={totalManual || centsToInput(leido.total)} onChange={(e) => setTotalManual(e.target.value)} />
            </Field>
          </div>
          {leido.vencimiento && <p className="susurro">Vence el {formatDateMedium(leido.vencimiento)}{leido.minimo !== null ? `; el pago mínimo es ${formatMoney(leido.minimo, tarjeta.moneda)}` : ''}.</p>}
          {leido.hayDolares && <Aviso>El resumen tiene consumos en dólares: esos no se miran acá, se revisan aparte.</Aviso>}

          {c?.anteriorALaTarjeta && (
            <Aviso>Este resumen cerró antes de que cargaras la tarjeta: lo que debías ahí ya está en el saldo con que la cargaste.</Aviso>
          )}

          {c && !c.anteriorALaTarjeta && (
            <>
              <table className="cuenta-tabla">
                <tbody>
                  <tr>
                    <td>Según el resumen</td>
                    <td className="num">{formatMoney(efectivo?.total ?? 0, tarjeta.moneda)}</td>
                  </tr>
                  <tr>
                    <td>Según lo anotado, al {formatDateMedium(c.cierre)}</td>
                    <td className="num">{formatMoney(c.segunApp, tarjeta.moneda)}</td>
                  </tr>
                  <tr className="total">
                    <td>Diferencia</td>
                    <td className="num" data-testid="diferencia">
                      {formatMoney(c.diferencia, tarjeta.moneda)}
                    </td>
                  </tr>
                </tbody>
              </table>

              {c.diferencia === 0 ? (
                <Aviso tono="ok">Coincide con lo que anotaste.</Aviso>
              ) : (
                <>
                  {c.faltantes.length > 0 && (
                    <>
                      <h3>Consumos que no están anotados</h3>
                      <ul className="lista importar-lista">
                        {c.faltantes.map((l, i) => (
                          <li key={i}>
                            <label className="importar-fila">
                              <input
                                type="checkbox"
                                checked={!sinFaltantes.has(i)}
                                onChange={(e) =>
                                  setSinFaltantes((s) => {
                                    const n = new Set(s);
                                    if (e.target.checked) n.delete(i);
                                    else n.add(i);
                                    return n;
                                  })
                                }
                              />
                              <span className="mov-texto">
                                <span className="lista-nombre">{l.descripcion || 'Consumo'}</span>
                                <span className="susurro">
                                  {l.fecha ? formatDateMedium(l.fecha) : 'Sin fecha'}
                                  {l.cuota ? ` · cuota ${l.cuota.numero} de ${l.cuota.de}: se agregan las ${l.cuota.de - l.cuota.numero + 1} que quedan` : ''}
                                </span>
                              </span>
                              <span className="mov-importe">{formatMoney(l.importe, tarjeta.moneda)}</span>
                            </label>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                  {cargosTotal > 0 && (
                    <label className="importar-fila">
                      <input type="checkbox" checked={conCargos} onChange={(e) => setConCargos(e.target.checked)} />
                      <span className="mov-texto">
                        <span className="lista-nombre">Intereses, impuestos y cargos</span>
                        <span className="susurro">{c.cargos.map((l) => l.descripcion).join(', ')}</span>
                      </span>
                      <span className="mov-importe">{formatMoney(cargosTotal, tarjeta.moneda)}</span>
                    </label>
                  )}
                  {queda !== 0 && (
                    <label className="importar-fila">
                      <input type="checkbox" checked={conAjuste} onChange={(e) => setConAjuste(e.target.checked)} />
                      <span className="mov-texto">
                        <span className="lista-nombre">Registrar lo que queda como diferencia sin conciliar</span>
                        <span className="susurro">Así lo que debés coincide con el banco, sin inventar de dónde salió.</span>
                      </span>
                      <span className="mov-importe" data-testid="queda">
                        {formatMoney(queda, tarjeta.moneda)}
                      </span>
                    </label>
                  )}
                </>
              )}
            </>
          )}

          <div className="acciones acciones-final">
            <button type="button" className="btn" onClick={() => setLeido(null)}>
              Volver
            </button>
            <button type="button" className="btn principal grande" onClick={guardar} disabled={!c || c.anteriorALaTarjeta}>
              {c && c.diferencia === 0 ? 'Listo' : 'Guardar'}
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}
