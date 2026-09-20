import { useMemo, useState } from 'react';
import { useStore } from '../store/StoreContext';
import { pendientes, type Pendiente } from '../lib/pendientes';
import { formatDateLong, today } from '../lib/dates';
import { formatMoney } from '../lib/money';

/**
 * Lo que quedó abierto, de a una cosa.
 *
 * La lista completa existe —está en `pendientes()`— pero acá se muestra la
 * primera y nada más. Una lista de ocho cosas arriba de todo no informa:
 * pide elegir, y elegir antes de empezar es donde se traba el arranque. Con
 * una sola no hay nada que decidir.
 *
 * "Más tarde" no promete nada ni guarda nada: solo corre esa tarjeta y muestra
 * la que sigue, y al recargar vuelve. Es para poder seguir adelante sin tener
 * que resolver algo que ahora no se puede, no para esconderlo.
 */
export function Pendientes({ onGo }: { onGo: (page: 'agenda' | 'finanzas' | 'pacientes') => void }) {
  const { data, dispatch } = useStore();
  const hoy = today();
  const [saltadas, setSaltadas] = useState<string[]>([]);

  // La hora hace falta para no dar por terminada una sesión de anoche que
  // todavía está corriendo. Se lee al dibujar: alcanza, porque esto se vuelve
  // a dibujar con cada cambio de datos.
  const ahoraMin = new Date().getHours() * 60 + new Date().getMinutes();
  const todas = useMemo(() => pendientes(data, hoy, ahoraMin), [data, hoy, ahoraMin]);
  const visibles = todas.filter((p) => !saltadas.includes(p.clave));
  const primera = visibles[0];
  const restan = visibles.length - 1;

  if (!primera) {
    return (
      <p className="pendientes-vacio">
        {todas.length > 0 ? '👍 Por ahora no queda nada más.' : '✨ No hay nada abierto.'}
      </p>
    );
  }

  return (
    <section className="pendientes" aria-label="Lo que quedó abierto">
      <div className="pendientes-rotulo">Lo que quedó abierto</div>
      <p className="pendientes-texto">{texto(primera, data.settings.currency)}</p>
      <p className="pendientes-nota">{nota(primera)}</p>

      <div className="actions pendientes-acciones">
        {primera.tipo === 'cerrar' && (
          <>
            <button
              className="btn small primary"
              onClick={() =>
                dispatch({ type: 'session/setStatus', payload: { id: primera.sesion.id, status: 'realizada' } })
              }
            >
              Vino
            </button>
            <button
              className="btn small"
              onClick={() =>
                dispatch({ type: 'session/setStatus', payload: { id: primera.sesion.id, status: 'ausente' } })
              }
            >
              Faltó
            </button>
            <button
              className="btn small"
              onClick={() =>
                dispatch({ type: 'session/setStatus', payload: { id: primera.sesion.id, status: 'cancelada' } })
              }
            >
              Se canceló
            </button>
          </>
        )}
        {primera.tipo === 'agendar' && (
          <button className="btn small primary" onClick={() => onGo('agenda')}>
            Agendar
          </button>
        )}
        {primera.tipo === 'cobrar' && (
          <button className="btn small primary" onClick={() => onGo('finanzas')}>
            Registrar el cobro
          </button>
        )}
        <button className="btn small ghost" onClick={() => setSaltadas([...saltadas, primera.clave])}>
          Más tarde
        </button>
      </div>

      {restan > 0 && (
        <p className="pendientes-resto">
          {restan === 1 ? 'Queda 1 cosa más.' : `Quedan ${restan} cosas más.`} Van a ir apareciendo acá.
        </p>
      )}
    </section>
  );
}

/**
 * Cuánto hace, sin exagerar.
 *
 * Antes redondeaba a meses con `Math.round(dias / 30)`: como el aviso aparece
 * a los 45 días, el mensaje más benigno posible ya decía "hace 2 meses" y
 * nunca podía decir uno. Abajo de dos meses se cuenta en días, que es exacto,
 * y de ahí en adelante se redondea para abajo.
 */
function antiguedad(dias: number): string {
  if (dias < 60) return `${dias} días`;
  return `${Math.floor(dias / 30)} meses`;
}

function texto(p: Pendiente, moneda: string): string {
  switch (p.tipo) {
    case 'cerrar':
      return `La sesión del ${formatDateLong(p.sesion.date).toLowerCase()} con ${
        p.paciente?.name ?? 'un paciente borrado'
      } quedó sin marcar.`;
    case 'agendar':
      return `${p.paciente.name} no tiene próximo turno.`;
    case 'cobrar':
      return `${p.paciente.name} tiene ${formatMoney(p.monto, moneda)} sin registrar.`;
  }
}

/** La línea chica: por qué aparece, sin reprochar nada. */
function nota(p: Pendiente): string {
  switch (p.tipo) {
    case 'cerrar':
      return 'Hasta marcarla no entra en lo facturado.';
    case 'agendar':
      return p.desdeDias === 1
        ? 'La última sesión fue ayer.'
        : `La última sesión fue hace ${p.desdeDias} días.`;
    case 'cobrar':
      return `Lo más viejo sin saldar es de hace ${antiguedad(p.desdeDias)}. Si ya te pagó, queda registrarlo.`;
  }
}
