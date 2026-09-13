import { useCallback, useEffect, useState } from 'react';

import { guardarPreferencia, leerPreferencia } from '../datos/preferencias';

const INTRO = 'intro-vista';

// Los hooks llevan prefijo `use` aunque el resto del código esté en español:
// React analiza las reglas de hooks por el nombre, y con otro prefijo el
// linter deja de revisarlos.

/**
 * Recuerda qué se mostró ya. Va a la base y no a memoria: si el instructivo
 * volviera a aparecer cada vez que Android reinicia la app, sería peor que no
 * tenerlo.
 */
function useMarca(clave: string) {
  const [vista, setVista] = useState<boolean | null>(null);

  useEffect(() => {
    let vigente = true;
    leerPreferencia<boolean>(clave).then((guardada) => {
      if (vigente) setVista(guardada === true);
    });
    return () => {
      vigente = false;
    };
  }, [clave]);

  const marcarVista = useCallback(() => {
    setVista(true);
    void guardarPreferencia(clave, true);
  }, [clave]);

  return { vista, marcarVista, olvidar: () => setVista(false) };
}

export function useIntro() {
  const { vista, marcarVista, olvidar } = useMarca(INTRO);
  // Mientras no se sabe, no se muestra: es peor que parpadee.
  return { mostrarIntro: vista === false, terminarIntro: marcarVista, volverAMostrar: olvidar };
}

/**
 * Una pista por lugar, la primera vez que se llega. Se apaga al tocarla y no
 * vuelve.
 */
export function usePista(nombre: string, habilitada = true) {
  const { vista, marcarVista } = useMarca(`pista:${nombre}`);
  return { mostrarPista: habilitada && vista === false, entendido: marcarVista };
}
