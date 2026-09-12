import type { ReactNode } from 'react';

import './Pista.css';

interface Props {
  /** Acepta formato: algunas pistas necesitan resaltar el nombre de un botón. */
  texto: ReactNode;
  onEntendido: () => void;
}

/**
 * Una pista anclada a lo que hay que tocar. No es un diálogo: no tapa la
 * pantalla ni bloquea nada, porque la regla del proyecto es cero modales, y
 * porque si aparece en mal momento tiene que poder ignorarse.
 */
export default function Pista({ texto, onEntendido }: Props) {
  return (
    <div className="pista" role="note">
      <div className="dice">{texto}</div>
      <button onClick={onEntendido}>Entendido</button>
    </div>
  );
}
