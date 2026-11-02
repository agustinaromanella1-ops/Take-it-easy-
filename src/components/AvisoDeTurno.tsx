import { useEffect, useRef } from 'react';
import { useStore } from '../store/StoreContext';
import { sesionesPorAvisar, textoAviso } from '../lib/aviso';
import { avisar, sePuedeAvisar } from '../lib/notificar';
import { timeToMinutes, today } from '../lib/dates';

/**
 * Dispara el aviso de que se viene un turno. No dibuja nada.
 *
 * Los límites de esto están explicados en `src/lib/aviso.ts` y, sobre todo, en
 * Ajustes: solo suena con la app abierta. Acá el cuidado es no avisar dos
 * veces lo mismo, que es la forma más rápida de que alguien apague los avisos
 * para siempre.
 */

/** Cada cuánto se mira el reloj. */
const LATIDO_MS = 30000;

/** Lo ya avisado, por día. Se guarda para que recargar no repita el aviso. */
const CLAVE = 'pipicucu:avisadas';

function leerAvisadas(hoy: string): Set<string> {
  try {
    const crudo = localStorage.getItem(CLAVE);
    if (!crudo) return new Set();
    const v: unknown = JSON.parse(crudo);
    if (typeof v !== 'object' || v === null) return new Set();
    const { fecha, ids } = v as { fecha?: unknown; ids?: unknown };
    // De otro día no sirve: al día siguiente hay que volver a avisar.
    if (fecha !== hoy || !Array.isArray(ids)) return new Set();
    return new Set(ids.filter((x): x is string => typeof x === 'string'));
  } catch {
    return new Set();
  }
}

function guardarAvisadas(hoy: string, ids: Set<string>): void {
  try {
    localStorage.setItem(CLAVE, JSON.stringify({ fecha: hoy, ids: [...ids] }));
  } catch {
    /* Sin almacenamiento, un recargue puede repetir un aviso. No es grave. */
  }
}

export function AvisoDeTurno({ permiso }: { permiso: string }) {
  const { data } = useStore();
  const antes = data.settings.avisarAntesMin;
  // Los datos se leen adentro del intervalo; la ref los mantiene frescos sin
  // tener que rearmarlo en cada tecla de un formulario.
  const ultimos = useRef(data);
  ultimos.current = data;

  useEffect(() => {
    if (antes <= 0) return;
    if (!sePuedeAvisar()) return;

    const mirar = () => {
      const hoy = today();
      const ahora = new Date();
      const minutos = ahora.getHours() * 60 + ahora.getMinutes();
      const avisadas = leerAvisadas(hoy);
      const pendientes = sesionesPorAvisar(ultimos.current.sessions, hoy, minutos, antes, avisadas);
      if (pendientes.length === 0) return;

      for (const s of pendientes) {
        const { titulo, cuerpo } = textoAviso(timeToMinutes(s.time) - minutos);
        /*
         * Sale por el service worker y no por `new Notification()`.
         *
         * Ese constructor tira una excepción en Chrome de Android, que es
         * justo donde se usa la app: el aviso quedaba atrapado en un `catch`
         * vacío y nunca sonaba en el celular, sin ninguna señal de que no
         * estaba funcionando.
         *
         * Sin sesión en el aviso no van botones: "Vino" no tiene sentido en
         * un turno que todavía no empezó.
         */
        void avisar({ titulo, cuerpo, tag: s.id });
        avisadas.add(s.id);
      }
      guardarAvisadas(hoy, avisadas);
    };

    mirar();
    const t = window.setInterval(mirar, LATIDO_MS);
    return () => window.clearInterval(t);
    // `permiso` está entre las dependencias para que conceder el permiso rearme
    // el intervalo. Ajustes guarda el minuto elegido ANTES de pedir el permiso,
    // así que sin esto el efecto se rearmaba con el permiso todavía en
    // 'default', salía por la puerta de arriba, y el aviso no sonaba hasta
    // recargar la app. Con la app instalada eso puede ser días.
  }, [antes, permiso]);

  return null;
}
