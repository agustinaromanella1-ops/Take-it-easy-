import './Pista.css';

interface Props {
  texto: string;
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
      <p>{texto}</p>
      <button onClick={onEntendido}>Entendido</button>
    </div>
  );
}
