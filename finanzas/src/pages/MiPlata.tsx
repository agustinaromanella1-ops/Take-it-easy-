import { useState } from 'react';
import type { Movimiento } from '../types';
import { useStore } from '../store/StoreContext';
import { useVentanas } from '../components/Ventanas';
import { Card } from '../components/ui';
import { saldosPorCuenta, vencimientos } from '../lib/finanzas/pendientes';
import { esDeuda, esPrestamo, esTarjeta } from '../lib/finanzas/saldos';
import { comprasEnCuotas, proximoResumen, resumenes } from '../lib/finanzas/tarjeta';
import { proximaCuota } from '../lib/finanzas/prestamo';
import { formatMoney } from '../lib/money';
import { capitalizar, daysBetween, distancia, formatDateMedium, today } from '../lib/dates';

const TIPO_TEXTO: Record<Movimiento['tipo'], string> = {
  gasto: 'Gasto',
  ingreso: 'Ingreso',
  transferencia: 'Entre mis cuentas',
  devolucion: 'Devolución',
  'pago-tarjeta': 'Pago de tarjeta o préstamo',
  ajuste: 'Diferencia sin conciliar',
};

type Filtro = 'todos' | 'revisar' | 'sin-cuenta';

export function MiPlata() {
  const { data, dispatch, huellita } = useStore();
  const { abrir } = useVentanas();
  const hoy = today();
  const saldos = saldosPorCuenta(data);
  const activas = data.cuentas.filter((c) => !c.archivada);
  const archivadas = data.cuentas.filter((c) => c.archivada);
  const liquidas = activas.filter((c) => !esDeuda(c));
  const prestamos = activas.filter(esPrestamo);
  const tarjetas = activas.filter(esTarjeta);
  const venc = vencimientos(data);
  const ingresos = data.ingresos.filter((i) => !i.cobrado).sort((a, b) => (a.fecha < b.fecha ? -1 : 1));
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [cuantos, setCuantos] = useState(30);
  const nombre = new Map(data.cuentas.map((c) => [c.id, c.nombre]));

  const aRevisar = data.movimientos.filter((m) => m.aRevisar);
  const sinCuenta = data.movimientos.filter((m) => m.tipo === 'gasto' && m.cuentaId === null);
  const movs = data.movimientos
    .filter((m) => (filtro === 'revisar' ? m.aRevisar : filtro === 'sin-cuenta' ? m.tipo === 'gasto' && m.cuentaId === null : true))
    .sort((a, b) => (a.fecha === b.fecha ? (a.updatedAt > b.updatedAt ? -1 : 1) : a.fecha > b.fecha ? -1 : 1));

  return (
    <div className="pagina">
      <h1>Mi plata</h1>

      <Card
        titulo="Cuentas"
        accion={
          <button className="btn chico" onClick={() => abrir({ tipo: 'cuenta' })}>
            Agregar
          </button>
        }
      >
        {liquidas.length === 0 ? (
          <p>Todavía no hay cuentas. Con una alcanza para empezar.</p>
        ) : (
          <ul className="lista">
            {liquidas.map((c) => {
              const dias = daysBetween(c.confirmadoEn, hoy);
              return (
                <li key={c.id} className="lista-item">
                  <button className="lista-principal" onClick={() => abrir({ tipo: 'cuenta', cuenta: c })}>
                    <span className="lista-nombre">{c.nombre}</span>
                    <span className="susurro">
                      {c.aproximado ? 'Aproximado · ' : ''}
                      {dias === 0 ? 'confirmado hoy' : `confirmado hace ${dias} ${dias === 1 ? 'día' : 'días'}`}
                      {c.cuentaParaDisponible ? '' : ' · no cuenta para lo disponible'}
                    </span>
                  </button>
                  <span className="lista-importe">{formatMoney(saldos.get(c.id) ?? 0, c.moneda)}</span>
                  <button className="btn chico" onClick={() => abrir({ tipo: 'saldo', cuentaId: c.id })}>
                    Actualizar saldo
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {tarjetas.length > 0 && (
        <Card titulo="Tarjetas de crédito">
          <ul className="lista">
            {tarjetas.map((t) => {
              const prox = proximoResumen(t, data.movimientos);
              const futuras = resumenes(t, data.movimientos).filter((r) => r.pendiente > 0);
              return (
                <li key={t.id} className="lista-item">
                  <button className="lista-principal" onClick={() => abrir({ tipo: 'cuenta', cuenta: t })}>
                    <span className="lista-nombre">{t.nombre}</span>
                    <span className="susurro">
                      {prox ? `Próximo resumen: ${formatMoney(prox.pendiente, t.moneda)}, vence ${distancia(hoy, prox.vencimiento)}` : 'Nada por pagar'}
                    </span>
                    {futuras.length > 1 && <span className="susurro">Cuotas en {futuras.length} resúmenes.</span>}
                  </button>
                  <span className="lista-importe">Debés {formatMoney(futuras.reduce((s, r) => s + r.pendiente, 0), t.moneda)}</span>
                  <CuotasDeTarjeta tarjetaId={t.id} />
                  <button className="btn chico" onClick={() => abrir({ tipo: 'resumen', tarjetaId: t.id })}>
                    Revisar con el resumen
                  </button>
                  {prox && (
                    <button
                      className="btn chico"
                      onClick={() =>
                        abrir({
                          tipo: 'pagar',
                          vencimiento: { clave: t.id, tipo: 'tarjeta', id: t.id, nombre: `Resumen de ${t.nombre}`, importe: prox.pendiente, moneda: t.moneda, fecha: prox.vencimiento },
                        })
                      }
                    >
                      Pagar resumen
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {prestamos.length > 0 && (
        <Card titulo="Préstamos">
          <ul className="lista">
            {prestamos.map((pr) => {
              const cuota = proximaCuota(pr, data.movimientos, hoy);
              return (
                <li key={pr.id} className="lista-item">
                  <button className="lista-principal" onClick={() => abrir({ tipo: 'cuenta', cuenta: pr })}>
                    <span className="lista-nombre">{pr.nombre}</span>
                    <span className="susurro">
                      {cuota ? `Próxima cuota: ${formatMoney(cuota.pendiente, pr.moneda)}, vence ${distancia(hoy, cuota.vencimiento)}` : 'Sin cuotas pendientes'}
                      {pr.cuotasRestantes !== null ? ` · quedaban ${pr.cuotasRestantes} al cargarlo` : ''}
                    </span>
                  </button>
                  <span className="lista-importe">Debés {formatMoney(saldos.get(pr.id) ?? 0, pr.moneda)}</span>
                  <button className="btn chico" onClick={() => abrir({ tipo: 'saldo', cuentaId: pr.id })}>
                    Actualizar saldo
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="susurro">Los intereses no se calculan solos: el saldo real lo dice el banco. Los escenarios están en Mis planes.</p>
        </Card>
      )}

      <Card
        titulo="Lo que vence"
        accion={
          <button className="btn chico" onClick={() => abrir({ tipo: 'compromiso' })}>
            Agregar
          </button>
        }
      >
        {venc.length === 0 ? (
          <p>No hay nada cargado para pagar.</p>
        ) : (
          <ul className="lista">
            {venc.map((v) => (
              <li key={v.clave} className="lista-item">
                <button
                  className="lista-principal"
                  onClick={() => {
                    const k = data.compromisos.find((x) => x.id === v.id);
                    if (v.tipo === 'compromiso' && k) abrir({ tipo: 'compromiso', compromiso: k });
                    else abrir({ tipo: 'pagar', vencimiento: v });
                  }}
                >
                  <span className="lista-nombre">{v.nombre}</span>
                  <span className="susurro">
                    {v.fecha < hoy ? `Venció ${distancia(hoy, v.fecha)}` : capitalizar(distancia(hoy, v.fecha))} · {formatDateMedium(v.fecha)}
                  </span>
                </button>
                <span className="lista-importe">{v.importe === null ? 'A confirmar' : formatMoney(v.importe, v.moneda)}</span>
                <button className="btn chico" onClick={() => abrir({ tipo: 'pagar', vencimiento: v })}>
                  Ya lo pagué
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card
        titulo="Plata que espero cobrar"
        accion={
          <button className="btn chico" onClick={() => abrir({ tipo: 'ingreso' })}>
            Agregar
          </button>
        }
      >
        {ingresos.length === 0 ? (
          <p className="susurro">Si cargás cuándo cobrás, "lo que podés usar" se calcula hasta ese día. No se suma antes de cobrarlo.</p>
        ) : (
          <ul className="lista">
            {ingresos.map((i) => (
              <li key={i.id} className="lista-item">
                <button className="lista-principal" onClick={() => abrir({ tipo: 'ingreso', ingreso: i })}>
                  <span className="lista-nombre">{i.nombre}</span>
                  <span className="susurro">
                    {capitalizar(distancia(hoy, i.fecha))} · {formatDateMedium(i.fecha)}
                    {i.variable ? ' · estimado' : ''}
                  </span>
                </button>
                <span className="lista-importe">{i.importe === null ? 'Sin importe' : formatMoney(i.importe, i.moneda)}</span>
                <button className="btn chico" onClick={() => abrir({ tipo: 'cobrar', ingresoId: i.id })}>
                  Ya lo cobré
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card titulo="Movimientos">
        <div className="opciones-lista" role="group" aria-label="Qué movimientos mostrar">
          {(
            [
              ['todos', 'Todos'],
              ['revisar', `Para revisar (${aRevisar.length})`],
              ['sin-cuenta', `Sin cuenta (${sinCuenta.length})`],
            ] as const
          ).map(([v, t]) => (
            <button key={v} className={`chip${filtro === v ? ' chip-activo' : ''}`} aria-pressed={filtro === v} onClick={() => setFiltro(v)}>
              {t}
            </button>
          ))}
        </div>
        <div className="acciones">
          <button className="btn chico" onClick={() => abrir({ tipo: 'importar' })}>
            Importar un archivo del banco
          </button>
        </div>
        {data.movimientos.length > 0 && (
          <button
            className="btn chico"
            onClick={() => {
              // Mirar la lista ya es organizarse: cuenta para la huellita,
              // una vez por día. Si había algo marcado para revisar, queda revisado.
              if (aRevisar.length) dispatch({ type: 'mov/revisado', ids: aRevisar.map((m) => m.id) });
              huellita('revisar-movimientos');
            }}
          >
            Ya los revisé
          </button>
        )}
        {movs.length === 0 ? (
          <p>{filtro === 'todos' ? 'Todavía no anotaste nada. El botón "Anotar" está siempre abajo.' : 'Nada por acá.'}</p>
        ) : (
          <ul className="lista movimientos">
            {movs.slice(0, cuantos).map((m) => {
              const entra = m.tipo === 'ingreso' || m.tipo === 'devolucion' || (m.tipo === 'ajuste' && m.importe > 0);
              const signo = m.tipo === 'transferencia' || m.tipo === 'pago-tarjeta' ? '' : entra ? '+' : '−';
              return (
                <li key={m.id}>
                  <button className="mov" onClick={() => (m.tipo === 'gasto' && m.cuentaId === null ? abrir({ tipo: 'asignar', movimientoId: m.id }) : abrir({ tipo: 'anotar', mov: m }))}>
                    <span className="mov-texto">
                      <span className="lista-nombre">{m.comercio || m.categoria || TIPO_TEXTO[m.tipo]}</span>
                      <span className="susurro">
                        {formatDateMedium(m.fecha)} · {TIPO_TEXTO[m.tipo]}
                        {m.cuentaId ? ` · ${nombre.get(m.cuentaId) ?? ''}` : ' · sin cuenta'}
                        {m.cuentaDestinoId ? ` → ${nombre.get(m.cuentaDestinoId) ?? ''}` : ''}
                        {m.cuotas > 1 ? ` · ${m.cuotas} cuotas` : ''}
                        {m.origen === 'comprobante' ? ' · de un comprobante' : ''}
                        {m.aRevisar ? ' · para revisar' : ''}
                      </span>
                    </span>
                    <span className={`mov-importe${entra ? ' entra' : ''}`}>
                      {signo}
                      {formatMoney(Math.abs(m.importe), m.moneda)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {movs.length > cuantos && (
          <button className="btn chico" onClick={() => setCuantos((n) => n + 50)}>
            Ver más
          </button>
        )}
      </Card>

      {archivadas.length > 0 && (
        <details className="plegable">
          <summary>Cuentas archivadas ({archivadas.length})</summary>
          <ul className="lista">
            {archivadas.map((c) => (
              <li key={c.id} className="lista-item">
                <button className="lista-principal" onClick={() => abrir({ tipo: 'cuenta', cuenta: c })}>
                  <span className="lista-nombre">{c.nombre}</span>
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

/** Las compras en cuotas de una tarjeta, plegadas: de dónde sale cada resumen. */
function CuotasDeTarjeta({ tarjetaId }: { tarjetaId: string }) {
  const { data } = useStore();
  const { abrir } = useVentanas();
  const t = data.cuentas.find((c) => c.id === tarjetaId);
  if (!t) return null;
  const compras = comprasEnCuotas(t, data.movimientos, today());
  if (compras.length === 0) return null;
  return (
    <details className="plegable lista-detalle">
      <summary>Compras en cuotas ({compras.length})</summary>
      <ul className="lista">
        {compras.map(({ movimiento: m, proxima, faltaVencer }) => (
          <li key={m.id}>
            <button className="mov" onClick={() => abrir({ tipo: 'anotar', mov: m })}>
              <span className="mov-texto">
                <span className="lista-nombre">{m.comercio || m.categoria || 'Compra'}</span>
                <span className="susurro">
                  Cuota {proxima} de {m.cuotas} en el próximo resumen · falta que venzan {formatMoney(faltaVencer, m.moneda)}
                </span>
              </span>
              <span className="mov-importe">{formatMoney(m.importe, m.moneda)}</span>
            </button>
          </li>
        ))}
      </ul>
    </details>
  );
}
