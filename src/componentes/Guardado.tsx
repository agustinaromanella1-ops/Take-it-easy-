import { useEffect } from 'react';

import './Guardado.css';

/**
 * La barra que confirma que algo quedó guardado.
 *
 * Guardar en silencio obliga a revisar si de verdad se guardó, y revisar es
 * justo lo que la app tiene que ahorrar. Se va sola: es un aviso, no una tarea
 * pendiente.
 */

export interface LoGuardado {
  texto: string;
  /** Lo que sigue naturalmente, para no tener que volver a buscarlo. */
  accion?: { texto: string; hacer: () => void };
  deshacer?: () => void | Promise<void>;
}

interface Props extends LoGuardado {
  alIrse: () => void;
}

const SE_VA_EN_MS = 8000;

export default function Guardado({ texto, accion, deshacer, alIrse }: Props) {
  useEffect(() => {
    const temporizador = setTimeout(alIrse, SE_VA_EN_MS);
    return () => clearTimeout(temporizador);
  }, [texto, alIrse]);

  return (
    <div className="guardado">
      <span>{texto}</span>
      {deshacer && (
        <button
          onClick={async () => {
            await deshacer();
            alIrse();
          }}
        >
          Deshacer
        </button>
      )}
      {accion && (
        <button
          onClick={() => {
            accion.hacer();
            alIrse();
          }}
        >
          {accion.texto}
        </button>
      )}
    </div>
  );
}
