import { useEffect, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import React from 'react';

/**
 * La hora actual, recalculada cada tanto.
 *
 * El estado de un mensaje depende del reloj: uno programado pasa a atrasado
 * solo por el paso del tiempo, y uno enviado desaparece de la lista a la
 * hora. Sin esto, la pantalla mostraba el estado del momento en que se
 * dibujó y podía quedar horas desactualizada: un mensaje ya enviado llegaba
 * a listarse como atrasado.
 *
 * Solo corre mientras la pantalla está al frente: un timer en una pantalla
 * que nadie mira es batería tirada.
 */
export function useAhora(intervaloMs = 30_000): Date {
  const [ahora, setAhora] = useState(() => new Date());

  useFocusEffect(
    React.useCallback(() => {
      setAhora(new Date());
      const reloj = setInterval(() => setAhora(new Date()), intervaloMs);
      return () => clearInterval(reloj);
    }, [intervaloMs]),
  );

  // Una primera actualización al montar, para las pantallas que no están
  // dentro de un navegador con foco.
  useEffect(() => {
    setAhora(new Date());
  }, []);

  return ahora;
}
