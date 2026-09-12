import { useCallback, useEffect, useRef, useState } from 'react';

import {
  dejarDeDictar,
  empezarADictar,
  pedirMicrofono,
  seEscuchaAcaMismo,
  tenemosMicrofono,
  type MotivoDelFin,
} from '../nativo/dictado';

/**
 * El botón de dictar, y el estado que lo acompaña.
 *
 * Si el teléfono no reconoce voz sin mandar el audio afuera, `disponible` da
 * `false` y el botón no se dibuja. No es un botón gris con una explicación: no
 * está. Quien no lo tiene escribe con el teclado y no se entera de que existía.
 */

export function useDictado(alDictar: (texto: string) => void) {
  const [disponible, setDisponible] = useState(false);
  const [escuchando, setEscuchando] = useState(false);
  const [problema, setProblema] = useState<string | null>(null);
  // Lo que ya estaba escrito cuando se encendió el micrófono. Cada resultado
  // parcial trae la frase entera de nuevo, así que se reemplaza desde acá en
  // vez de irse acumulando dos veces.
  const base = useRef('');
  // Para no llamar a un callback de una pantalla que ya se cerró.
  const vivo = useRef(true);
  // El `escuchando` del estado no sirve para limpiar al desmontar: la función
  // de limpieza ve el valor que había cuando se creó. Este ref sí.
  const prendido = useRef(false);

  useEffect(() => {
    vivo.current = true;
    void seEscuchaAcaMismo().then((hay) => {
      if (vivo.current) setDisponible(hay);
    });
    return () => {
      vivo.current = false;
      // Sólo si de verdad estaba escuchando: apagar un micrófono que nunca se
      // encendió no hace nada y hace ruido.
      if (prendido.current) void dejarDeDictar();
    };
  }, []);

  const arrancar = useCallback(
    async (loEscrito: string) => {
      setProblema(null);
      const hay = (await tenemosMicrofono()) || (await pedirMicrofono());
      if (!hay) {
        setProblema('Android no dio permiso para usar el micrófono.');
        return;
      }

      base.current = loEscrito;
      prendido.current = true;
      setEscuchando(true);
      try {
        await empezarADictar({
          alEntender: (texto) => {
            if (!vivo.current) return;
            const antes = base.current;
            alDictar(antes ? `${antes.replace(/\s*$/, '')} ${texto}` : texto);
          },
          alTerminar: (motivo) => {
            prendido.current = false;
            // El reconocedor puede terminar solo —por silencio o por error— y
            // ahí nadie llamó a `parar`: sin esto los oyentes quedan colgados.
            // Se difiere porque esto corre dentro de uno de ellos.
            void Promise.resolve().then(dejarDeDictar);
            if (!vivo.current) return;
            setEscuchando(false);
            if (motivo) setProblema(quePaso(motivo));
          },
        });
      } catch (e) {
        // Acá no se reintenta con el reconocedor del sistema: si el dictado en
        // el teléfono no anda, se escribe a mano (1.2).
        prendido.current = false;
        setEscuchando(false);
        setProblema(e instanceof Error ? quePaso(e.message) : 'No se pudo escuchar.');
      }
    },
    [alDictar],
  );

  const parar = useCallback(async () => {
    prendido.current = false;
    setEscuchando(false);
    await dejarDeDictar();
  }, []);

  return { disponible, escuchando, problema, arrancar, parar };
}

/**
 * Los códigos no se le muestran a nadie. Lo que importa es si vale la pena
 * volver a intentar o hay que escribir.
 */
export function quePaso(motivo: MotivoDelFin | string): string {
  switch (motivo) {
    case 'SIN_PERMISO':
      return 'Android no dio permiso para usar el micrófono.';
    case 'NO_SE_ENTENDIO':
      return 'No se entendió nada. Probá de nuevo.';
    case 'IDIOMA_NO_DISPONIBLE':
      return 'Este teléfono todavía no tiene el castellano bajado para dictar sin conexión. Escribilo a mano.';
    case 'OCUPADO':
      return 'El micrófono está ocupado. Esperá un segundo.';
    case 'AUDIO':
      return 'No se pudo grabar. Probá de nuevo.';
    default:
      return 'Se cortó el dictado. Probá de nuevo o escribilo a mano.';
  }
}
