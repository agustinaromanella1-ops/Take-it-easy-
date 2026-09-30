import type { Meta } from '../types';
import { useStore } from '../store/StoreContext';
import { useVentanas } from '../components/Ventanas';
import { Card, Progreso } from '../components/ui';
import { mesesCubiertos, proximoHito, reservado } from '../lib/finanzas/metas';
import { formatMoney } from '../lib/money';
import { formatDateMedium } from '../lib/dates';

/**
 * Metas y reserva. Una meta destacada; las otras plegadas, para que no sean
 * cinco exigencias a la vez. Todo lo que se muestra es plata apartada de
 * verdad: las huellitas no suman acá.
 */
export function MisPlanes() {
  const { data } = useStore();
  const { abrir } = useVentanas();
  const reserva = data.metas.find((m) => m.esReserva);
  const metas = data.metas.filter((m) => !m.esReserva);
  const destacada = metas.find((m) => m.destacada) ?? metas[0];
  const otras = metas.filter((m) => m !== destacada);

  return (
    <div className="pagina">
      <h1>Mis planes</h1>

      {destacada ? (
        <TarjetaMeta meta={destacada} />
      ) : (
        <Card titulo="Una meta">
          <p>Algo para lo que te gustaría juntar plata. Sin fecha fija y sin porcentajes obligatorios: se aporta cuando se puede.</p>
          <button className="btn principal" onClick={() => abrir({ tipo: 'meta' })}>
            Crear una meta
          </button>
        </Card>
      )}

      {reserva ? (
        <TarjetaMeta meta={reserva} />
      ) : (
        <Card titulo="Reserva para imprevistos">
          <p>Plata para cuando algo sale distinto. Empieza con un número chico, el que elijas.</p>
          <button className="btn" onClick={() => abrir({ tipo: 'meta', esReserva: true })}>
            Armar mi reserva
          </button>
        </Card>
      )}

      {otras.length > 0 && (
        <details className="plegable">
          <summary>Otras metas ({otras.length})</summary>
          {otras.map((m) => (
            <TarjetaMeta key={m.id} meta={m} puedeDestacar />
          ))}
        </details>
      )}

      {destacada && (
        <button className="btn" onClick={() => abrir({ tipo: 'meta' })}>
          Otra meta
        </button>
      )}
    </div>
  );
}

function TarjetaMeta({ meta, puedeDestacar = false }: { meta: Meta; puedeDestacar?: boolean }) {
  const { data, dispatch } = useStore();
  const { abrir } = useVentanas();
  const hay = reservado(meta, data.aportes);
  const hito = meta.esReserva ? proximoHito(meta, hay) : meta.objetivo;
  const meses = mesesCubiertos(meta, hay);
  const virtual = data.aportes.filter((a) => a.metaId === meta.id && a.forma === 'virtual').reduce((s, a) => s + a.importe, 0);

  return (
    <Card
      titulo={meta.nombre}
      accion={
        <button className="btn chico" onClick={() => abrir({ tipo: 'meta', meta })}>
          Editar
        </button>
      }
    >
      {meta.imagen && <img className="meta-imagen grande" src={meta.imagen} alt="" />}
      {hito ? (
        <Progreso valor={hay} max={hito} texto={`${formatMoney(hay, meta.moneda)} de ${formatMoney(hito, meta.moneda)}${meta.esReserva ? ' (próximo hito)' : ''}`} />
      ) : (
        <p>
          {formatMoney(hay, meta.moneda)} apartados{meta.esReserva && meta.hitos.length + (meta.objetivo ? 1 : 0) > 0 ? '. Pasaste todos tus hitos.' : '.'}
        </p>
      )}
      {virtual > 0 && <p className="susurro">{formatMoney(virtual, meta.moneda)} están apartados dentro de la app, en tus cuentas de siempre.</p>}
      {meses !== null && <p className="susurro">Cubre unos {meses.toLocaleString('es-AR')} meses de gastos esenciales, según tu estimación de {formatMoney(meta.esencialesPorMes ?? 0, meta.moneda)} por mes.</p>}
      {meta.fecha && <p className="susurro">Para más o menos el {formatDateMedium(meta.fecha)}. Si no llega, se mueve.</p>}
      {meta.pasoChico && <p>Próximo paso: {meta.pasoChico}</p>}
      <div className="acciones">
        <button className="btn principal" onClick={() => abrir({ tipo: 'aporte', metaId: meta.id })}>
          Apartar
        </button>
        {hay > 0 && (
          <button className="btn" onClick={() => abrir({ tipo: 'aporte', metaId: meta.id, usar: true })}>
            {meta.esReserva ? 'Usar la reserva' : 'Usar'}
          </button>
        )}
        {puedeDestacar && (
          <button className="btn chico" onClick={() => dispatch({ type: 'meta/destacar', id: meta.id })}>
            Destacar
          </button>
        )}
      </div>
    </Card>
  );
}
