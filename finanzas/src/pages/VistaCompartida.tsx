import { useEffect, useState } from 'react';
import { Aviso, Card, Progreso } from '../components/ui';
import { descifrar } from '../lib/compartir/cripto';
import { obtener } from '../lib/compartir/cliente';
import { esVista, type VistaCompartida as Vista } from '../lib/compartir/vista';
import { formatMoney } from '../lib/money';
import { capitalizar, distancia, formatDateMedium } from '../lib/dates';

/**
 * Lo que ve quien recibió un enlace. Solo lectura: no hay botones que cambien
 * nada, y no usa el almacenamiento de este navegador.
 *
 * El enlace trae `#id.clave`. El id se pide al servidor; la clave se queda
 * acá y descifra lo que llega.
 */
type Estado = { tipo: 'cargando' } | { tipo: 'no-disponible' } | { tipo: 'error' } | { tipo: 'listo'; vista: Vista };

export function VistaCompartida() {
  const [estado, setEstado] = useState<Estado>({ tipo: 'cargando' });

  useEffect(() => {
    const cargar = () => {
      setEstado({ tipo: 'cargando' });
      const [id, clave] = window.location.hash.slice(1).split('.');
      if (!id || !clave) {
        setEstado({ tipo: 'error' });
        return;
      }
      void (async () => {
        try {
          const cifrado = await obtener(id);
          if (cifrado === null) return setEstado({ tipo: 'no-disponible' });
          const vista = await descifrar(cifrado, clave);
          setEstado(esVista(vista) ? { tipo: 'listo', vista } : { tipo: 'error' });
        } catch {
          setEstado({ tipo: 'error' });
        }
      })();
    };
    cargar();
    // Abrir otro enlace en la misma pestaña solo cambia lo que va después del
    // "#": la página no se recarga, así que hay que volver a leer.
    window.addEventListener('hashchange', cargar);
    return () => window.removeEventListener('hashchange', cargar);
  }, []);

  return (
    <main className="vista-compartida">
      <p className="marca">Salchi</p>
      {estado.tipo === 'cargando' && <p aria-live="polite">Abriendo…</p>}
      {estado.tipo === 'no-disponible' && (
        <>
          <h1>Este enlace ya no está disponible</h1>
          <p>Quien lo compartió dejó de compartirlo, o pasaron más de 30 días.</p>
        </>
      )}
      {estado.tipo === 'error' && (
        <>
          <h1>No se pudo abrir</h1>
          <p>El enlace puede estar incompleto. Pedile a quien te lo mandó que lo copie de nuevo, entero.</p>
        </>
      )}
      {estado.tipo === 'listo' && <Contenido v={estado.vista} />}
    </main>
  );
}

function Contenido({ v }: { v: Vista }) {
  const hoy = v.hoy;
  return (
    <>
      <h1>Lo que te compartieron</h1>
      <Aviso>
        Es de solo lectura y muestra cómo estaba todo el {formatDateMedium(v.generadoEn.slice(0, 10))}. No podés cambiar nada desde acá.
      </Aviso>

      {v.disponible?.map((d) => (
        <Card
          key={d.moneda}
          titulo={`Puede usar hasta el ${formatDateMedium(d.hasta)}${d.moneda === 'USD' ? ' (en dólares)' : ''}`}
          className={`disponible${d.importe !== null && d.importe < 0 ? ' disponible-deficit' : ''}`}
        >
          <p className="disponible-numero">{d.importe === null ? 'Sin datos' : formatMoney(d.importe, d.moneda)}</p>
          {d.importe !== null && d.importe < 0 && (
            <p className="disponible-deficit-texto">
              Con lo que sabe la app, faltan {formatMoney(-d.importe, d.moneda)} para cubrir lo que vence hasta el {formatDateMedium(d.hasta)}.
            </p>
          )}
          {d.faltantes.length > 0 && (
            <ul className="faltantes">
              {d.faltantes.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          )}
        </Card>
      ))}

      {v.vencimientos && (
        <Card titulo="Lo que vence en los próximos 30 días">
          {v.vencimientos.length === 0 ? (
            <p>Nada.</p>
          ) : (
            <ul className="lista">
              {v.vencimientos.map((x, i) => (
                <li key={i} className="lista-item">
                  <div className="lista-principal">
                    <span className="lista-nombre">{x.nombre}</span>
                    <span className="susurro">
                      {x.fecha < hoy ? `Venció ${distancia(hoy, x.fecha)}` : capitalizar(distancia(hoy, x.fecha))} · {formatDateMedium(x.fecha)}
                    </span>
                  </div>
                  <span className="lista-importe">{x.importe === null ? 'A confirmar' : formatMoney(x.importe, x.moneda)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {v.metas && (
        <Card titulo="Metas">
          {v.metas.length === 0 ? (
            <p>Todavía no hay metas.</p>
          ) : (
            v.metas.map((m, i) => (
              <div key={i}>
                <p className="lista-nombre">{m.nombre}</p>
                {m.objetivo ? (
                  <Progreso valor={m.reservado} max={m.objetivo} texto={`${formatMoney(m.reservado, m.moneda)} de ${formatMoney(m.objetivo, m.moneda)}`} />
                ) : (
                  <p>{formatMoney(m.reservado, m.moneda)} apartados.</p>
                )}
              </div>
            ))
          )}
        </Card>
      )}

      {v.movimientos && (
        <Card titulo="Movimientos de los últimos 30 días">
          {v.movimientos.length === 0 ? (
            <p>Nada anotado.</p>
          ) : (
            <ul className="lista movimientos">
              {v.movimientos.map((m, i) => {
                const entra = m.tipo === 'ingreso' || m.tipo === 'devolucion' || (m.tipo === 'ajuste' && m.importe > 0);
                return (
                  <li key={i} className="mov">
                    <span className="mov-texto">
                      <span className="lista-nombre">{m.comercio || m.categoria || 'Movimiento'}</span>
                      <span className="susurro">{formatDateMedium(m.fecha)}</span>
                    </span>
                    <span className={`mov-importe${entra ? ' entra' : ''}`}>
                      {entra ? '+' : '−'}
                      {formatMoney(Math.abs(m.importe), m.moneda)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      )}
    </>
  );
}
