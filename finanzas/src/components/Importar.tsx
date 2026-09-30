import { useMemo, useState } from 'react';
import type { Movimiento } from '../types';
import { useStore } from '../store/StoreContext';
import { useVentanas } from './Ventanas';
import { Aviso, Field, Modal } from './ui';
import { adivinarColumnas, convertir, decodificar, leerCSV, type Columnas } from '../lib/importar/csv';
import { formatMoney } from '../lib/money';
import { formatDateMedium } from '../lib/dates';
import { newId } from '../lib/id';
import { esPrestamo } from '../lib/finanzas/saldos';

/**
 * Importar un CSV del banco o la billetera, en tres pasos: el archivo y la
 * cuenta, las columnas, y la revisión. Nada entra sin mirarlo: lo repetido
 * viene destildado y todo queda marcado "para revisar".
 */
export function Importar() {
  const { data, dispatch } = useStore();
  const { cerrar } = useVentanas();
  // Un extracto es de un banco, una billetera o una tarjeta; nunca de un préstamo.
  const cuentas = data.cuentas.filter((c) => !c.archivada && !esPrestamo(c));
  const [texto, setTexto] = useState('');
  const [nombreArchivo, setNombreArchivo] = useState('');
  const [cuentaId, setCuentaId] = useState(cuentas.length === 1 ? cuentas[0]?.id ?? '' : '');
  const [paso, setPaso] = useState<'archivo' | 'columnas' | 'revisar'>('archivo');
  const [col, setCol] = useState<Columnas | null>(null);
  const [elegidas, setElegidas] = useState<Set<number>>(new Set());
  const [error, setError] = useState('');

  const filas = useMemo(() => (texto ? leerCSV(texto) : []), [texto]);
  const cuenta = cuentas.find((c) => c.id === cuentaId);
  const resultado = useMemo(
    () => (col && cuenta ? convertir(filas, col, data.movimientos, cuenta.moneda) : null),
    [col, cuenta, filas, data.movimientos],
  );

  function seguirAColumnas() {
    if (!cuentaId) return setError('Elegí a qué cuenta corresponden los movimientos.');
    if (filas.length === 0) return setError('No encontré filas en ese archivo.');
    setError('');
    setCol(adivinarColumnas(filas));
    setPaso('columnas');
  }

  function seguirARevisar() {
    if (!resultado) return;
    if (resultado.filas.length === 0) return setError('Con esas columnas no sale ningún movimiento. Revisá cuál es la fecha y cuál el importe.');
    setError('');
    setElegidas(new Set(resultado.filas.filter((f) => f.duplicados.length === 0).map((f) => f.indice)));
    setPaso('revisar');
  }

  function importar() {
    if (!resultado || !cuenta) return;
    const movs: Omit<Movimiento, 'updatedAt'>[] = resultado.filas
      .filter((f) => elegidas.has(f.indice))
      .map((f) => ({
        id: newId(),
        tipo: f.importe < 0 ? 'gasto' : 'ingreso',
        importe: Math.abs(f.importe),
        moneda: cuenta.moneda,
        fecha: f.fecha,
        cuentaId: cuenta.id,
        cuentaDestinoId: null,
        categoria: f.categoria,
        comercio: f.descripcion,
        nota: nombreArchivo ? `Importado de ${nombreArchivo}` : 'Importado',
        cuotas: 1,
        devolucionDe: null,
        origen: 'importado',
        aRevisar: true,
      }));
    if (movs.length) dispatch({ type: 'mov/agregarVarios', movs, origen: 'importar' });
    cerrar();
  }

  const titulos = col?.conTitulos ? filas[0] ?? [] : (filas[0] ?? []).map((_, i) => `Columna ${i + 1}`);
  const selector = (label: string, clave: keyof Omit<Columnas, 'conTitulos'>, opcional = false) =>
    col && (
      <Field label={label}>
        <select value={col[clave]} onChange={(e) => setCol({ ...col, [clave]: Number(e.target.value) })}>
          <option value={-1}>{opcional ? 'No hay' : 'Elegí una columna'}</option>
          {titulos.map((t, i) => (
            <option key={i} value={i}>
              {t || `Columna ${i + 1}`}
            </option>
          ))}
        </select>
      </Field>
    );

  return (
    <Modal titulo="Importar movimientos" onClose={cerrar} ancho>
      {paso === 'archivo' && (
        <>
          <p>Un archivo CSV que baja el home banking o la billetera. Se lee acá, en tu teléfono.</p>
          <Field label="Archivo" ayuda={nombreArchivo ? `Elegiste ${nombreArchivo}.` : 'CSV o texto separado por punto y coma.'}>
            <input
              type="file"
              accept=".csv,text/csv,text/plain,.txt"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                setNombreArchivo(f.name);
                setTexto(decodificar(await f.arrayBuffer()));
              }}
            />
          </Field>
          <details className="plegable">
            <summary>O pegá el texto</summary>
            <Field label="Texto del archivo">
              <textarea rows={5} value={texto} onChange={(e) => setTexto(e.target.value)} />
            </Field>
          </details>
          <Field label="De qué cuenta son">
            <select value={cuentaId} onChange={(e) => setCuentaId(e.target.value)}>
              <option value="">Elegí una</option>
              {cuentas.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </Field>
          {error && <Aviso tono="error">{error}</Aviso>}
          <div className="acciones acciones-final">
            <button type="button" className="btn principal grande" onClick={seguirAColumnas} disabled={!texto}>
              Seguir
            </button>
          </div>
        </>
      )}

      {paso === 'columnas' && col && (
        <>
          <p>Revisá qué es cada columna. La del saldo no se usa nunca.</p>
          {selector('Fecha', 'fecha')}
          {selector('Descripción', 'descripcion')}
          {selector('Importe (con signo)', 'importe', true)}
          {col.importe === -1 && (
            <div className="fila">
              {selector('Débito (sale)', 'debito', true)}
              {selector('Crédito (entra)', 'credito', true)}
            </div>
          )}
          {resultado && (
            <p className="susurro">
              Con estas columnas salen {resultado.filas.length} movimientos
              {resultado.omitidas.length ? ` y se saltean ${resultado.omitidas.length} filas que no tienen fecha o importe` : ''}.
            </p>
          )}
          {error && <Aviso tono="error">{error}</Aviso>}
          <div className="acciones acciones-final">
            <button type="button" className="btn" onClick={() => setPaso('archivo')}>
              Volver
            </button>
            <button type="button" className="btn principal grande" onClick={seguirARevisar}>
              Ver los movimientos
            </button>
          </div>
        </>
      )}

      {paso === 'revisar' && resultado && cuenta && (
        <>
          <p>
            Elegí cuáles importar a <strong>{cuenta.nombre}</strong>. Los que parecen repetidos vienen sin tildar.
          </p>
          {resultado.filas.some((f) => f.fecha < cuenta.fechaSaldo) && (
            <Aviso>
              Los anteriores al {formatDateMedium(cuenta.fechaSaldo)} quedan en el historial sin cambiar el saldo: ese día ya dijiste cuánto había.
            </Aviso>
          )}
          <ul className="lista importar-lista">
            {resultado.filas.map((f) => (
              <li key={f.indice}>
                <label className="importar-fila">
                  <input
                    type="checkbox"
                    checked={elegidas.has(f.indice)}
                    onChange={(e) =>
                      setElegidas((s) => {
                        const n = new Set(s);
                        if (e.target.checked) n.add(f.indice);
                        else n.delete(f.indice);
                        return n;
                      })
                    }
                  />
                  <span className="mov-texto">
                    <span className="lista-nombre">{f.descripcion || 'Sin descripción'}</span>
                    <span className="susurro">
                      {formatDateMedium(f.fecha)}
                      {f.duplicados.length ? ' · parece repetido' : ''}
                      {f.pareceTransferencia ? ' · ¿entre tus cuentas?' : ''}
                    </span>
                  </span>
                  <span className={`mov-importe${f.importe > 0 ? ' entra' : ''}`}>
                    {f.importe > 0 ? '+' : '−'}
                    {formatMoney(Math.abs(f.importe), cuenta.moneda)}
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <p className="susurro">Todo entra como "para revisar". Si alguno fue entre tus cuentas, cambialo a "Entre mis cuentas" al revisarlo.</p>
          <div className="acciones acciones-final">
            <button type="button" className="btn" onClick={() => setPaso('columnas')}>
              Volver
            </button>
            <button type="button" className="btn principal grande" onClick={importar} disabled={elegidas.size === 0}>
              Importar {elegidas.size}
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}
