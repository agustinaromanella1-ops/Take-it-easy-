import { useEffect, useRef } from 'react';
import { useStore } from '../store/StoreContext';
import { leerPedido, limpiarPedido, type Pedido } from '../lib/accionDeAviso';
import { estadoDeAccion } from '../lib/recordatorios';

/**
 * Aplica la respuesta que llegó desde una notificación del sistema. No dibuja
 * nada.
 *
 * Tocar "Vino" en el aviso tiene que dejar la sesión marcada y la app abierta
 * mostrando lo que acaba de pasar. Lo segundo importa tanto como lo primero:
 * una acción que ocurre sin que se vea es una acción que no se puede
 * desconfiar ni corregir. Por eso todo pasa por el `dispatch` del store, que
 * deja la barra de deshacer, y la app queda en el inicio con la fila a la
 * vista.
 *
 * "Reagendó" no se aplica solo: necesita una fecha. Abre el cuadro de mover el
 * turno, que es la única respuesta que no se puede dar de un toque.
 */
export function AccionDeAviso({
  onIrAlInicio,
  onReagendar,
}: {
  onIrAlInicio: () => void;
  onReagendar: (sesionId: string) => void;
}) {
  const { data, dispatch } = useStore();
  // El efecto corre una sola vez y con los oyentes puestos de entrada; sin la
  // ref leería los datos del primer dibujo, que puede ser antes de que
  // terminen de cargarse.
  const ultimos = useRef({ data, dispatch, onIrAlInicio, onReagendar });
  ultimos.current = { data, dispatch, onIrAlInicio, onReagendar };

  useEffect(() => {
    const aplicar = (pedido: Pedido) => {
      const { data: datos, dispatch: despachar, onIrAlInicio: alInicio, onReagendar: reagendar } =
        ultimos.current;

      // Tocar el cuerpo del aviso no manda ninguna respuesta —y en iOS no hay
      // botones, así que es el único camino—: ahí solo se abre la app.
      if (!pedido.accion) {
        if (pedido.sesion) alInicio();
        return;
      }

      /*
       * La sesión tiene que existir y seguir sin marcar.
       *
       * Un aviso puede quedar horas en la barra de notificaciones: para cuando
       * se lo toca, esa sesión ya puede estar marcada desde la app, movida de
       * día o borrada. Aplicar la respuesta igual pisaría algo que se decidió
       * después y con más información.
       */
      const sesion = datos.sessions.find((s) => s.id === pedido.sesion);
      if (!sesion || sesion.status !== 'programada') {
        alInicio();
        return;
      }

      const estado = estadoDeAccion(pedido.accion);
      if (estado === null) {
        alInicio();
        reagendar(sesion.id);
        return;
      }

      despachar({ type: 'session/setStatus', payload: { id: sesion.id, status: estado } });
      alInicio();
    };

    // Puerta 1: la app estaba cerrada y se abrió con la respuesta en la
    // dirección. Se limpia enseguida para que recargar no la repita.
    const deLaUrl = leerPedido(window.location.search);
    if (deLaUrl.accion || deLaUrl.sesion) {
      limpiarPedido();
      aplicar(deLaUrl);
    }

    // Puerta 2: la app ya estaba abierta y el service worker la trajo al
    // frente con un mensaje.
    if (!('serviceWorker' in navigator)) return;
    const oir = (e: MessageEvent) => {
      const m: unknown = e.data;
      if (typeof m !== 'object' || m === null) return;
      const { tipo, accion, sesion } = m as Record<string, unknown>;
      if (tipo !== 'pipicucu:accion') return;
      aplicar(
        leerPedido(
          new URLSearchParams({
            hacer: typeof accion === 'string' ? accion : '',
            sesion: typeof sesion === 'string' ? sesion : '',
          }).toString(),
        ),
      );
    };
    navigator.serviceWorker.addEventListener('message', oir);
    return () => navigator.serviceWorker.removeEventListener('message', oir);
  }, []);

  return null;
}
