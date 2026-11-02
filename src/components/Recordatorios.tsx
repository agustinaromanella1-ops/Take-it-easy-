import { useEffect, useRef } from 'react';
import { useStore } from '../store/StoreContext';
import { today } from '../lib/dates';
import { avisar, sePuedeAvisar } from '../lib/notificar';
import {
  faltaDelDia,
  hayQueAvisar,
  momentoQueCorresponde,
  momentosDelDia,
  textoRecordatorio,
} from '../lib/recordatorios';

/**
 * Dispara los recordatorios del nivel elegido. No dibuja nada.
 *
 * Lo que puede y lo que no puede hacer está explicado en
 * `src/lib/recordatorios.ts`, y Ajustes lo dice con todas las letras: el aviso
 * sale cuando la app está abierta o se la vuelve a traer al frente después de
 * la hora, no con todo cerrado. No hay servidor que mande push, y la API que
 * programaría avisos sin servidor nunca se lanzó en ningún navegador.
 */

/** Cada cuánto se mira el reloj. El mismo latido que el aviso de turno. */
const LATIDO_MS = 30000;

/** Lo ya avisado, por día. */
const CLAVE = 'pipicucu:recordatorios';

function leerHechos(hoy: string): Set<string> {
  try {
    const crudo = localStorage.getItem(CLAVE);
    if (!crudo) return new Set();
    const v: unknown = JSON.parse(crudo);
    if (typeof v !== 'object' || v === null) return new Set();
    const { fecha, ids } = v as { fecha?: unknown; ids?: unknown };
    // De otro día no sirve: mañana hay que volver a recordar.
    if (fecha !== hoy || !Array.isArray(ids)) return new Set();
    return new Set(ids.filter((x): x is string => typeof x === 'string'));
  } catch {
    return new Set();
  }
}

function guardarHechos(hoy: string, ids: Set<string>): void {
  try {
    localStorage.setItem(CLAVE, JSON.stringify({ fecha: hoy, ids: [...ids] }));
  } catch {
    /* Sin almacenamiento un recargue puede repetir un aviso. No es grave. */
  }
}

export function Recordatorios({ permiso }: { permiso: string }) {
  const { data } = useStore();
  const nivel = data.settings.recordatorios;
  // Los datos se leen adentro del intervalo; la ref los mantiene frescos sin
  // tener que rearmarlo en cada tecla de un formulario.
  const ultimos = useRef(data);
  ultimos.current = data;

  useEffect(() => {
    if (nivel === 'nula') return;
    if (!sePuedeAvisar()) return;

    const mirar = () => {
      const hoy = today();
      const ahora = new Date();
      const minutos = ahora.getHours() * 60 + ahora.getMinutes();
      const datos = ultimos.current;

      const delDia = datos.sessions.filter((s) => s.date === hoy);
      const momentos = momentosDelDia(nivel, delDia);
      const hechos = leerHechos(hoy);
      const { ahora: momento, vencidos } = momentoQueCorresponde(momentos, minutos, hechos);
      if (vencidos.length === 0) return;

      /*
       * Todo lo que pasó se da por hecho, dispare o no.
       *
       * Es lo que impide que abrir la app a la noche largue la pila del día
       * entero, y también que un recordatorio que no tenía nada que decir
       * —porque estaba todo marcado— vuelva a intentarlo cada treinta
       * segundos hasta que algo quede abierto.
       */
      for (const v of vencidos) hechos.add(v.id);
      guardarHechos(hoy, hechos);
      if (!momento) return;

      const falta = faltaDelDia(datos, hoy, minutos);
      if (!hayQueAvisar(momento.tipo, falta)) return;

      const texto = textoRecordatorio(momento.tipo, falta);
      void avisar({
        titulo: texto.titulo,
        cuerpo: texto.cuerpo,
        // Un tag por tipo: dos avisos de cobro del mismo día se reemplazan en
        // vez de apilarse, pero el de marcar no pisa al de cobrar.
        tag: `pipicucu:${momento.tipo}`,
        sesion: texto.sesion,
      });
    };

    mirar();
    const t = window.setInterval(mirar, LATIDO_MS);
    // Volver a la app es el momento más probable de que haya pasado una hora
    // con todo cerrado: sin esto habría que esperar al próximo latido.
    document.addEventListener('visibilitychange', mirar);
    return () => {
      window.clearInterval(t);
      document.removeEventListener('visibilitychange', mirar);
    };
    // `permiso` rearma el efecto al conceder el permiso: Ajustes guarda el
    // nivel antes de pedirlo, así que sin esto el primer día no avisaría nada.
  }, [nivel, permiso]);

  return null;
}
