import './Dictado.css';

/**
 * El botón de dictar. Sólo se dibuja si `useDictado` dijo que este teléfono
 * reconoce voz sin mandar el audio afuera; no es un botón gris con una
 * explicación, directamente no está.
 */

interface Props {
  escuchando: boolean;
  /** Lo que hay escrito ahora: el dictado se agrega atrás de esto. */
  loEscrito: string;
  arrancar: (loEscrito: string) => void | Promise<void>;
  parar: () => void | Promise<void>;
}

export function BotonDeDictado({ escuchando, loEscrito, arrancar, parar }: Props) {
  return (
    <button
      type="button"
      className={escuchando ? 'dictar escuchando' : 'dictar'}
      onClick={() => void (escuchando ? parar() : arrancar(loEscrito))}
      aria-pressed={escuchando}
    >
      <span className="icono" aria-hidden="true">
        🎤
      </span>
      {escuchando ? 'Escuchando… tocá para terminar' : 'Dictar'}
    </button>
  );
}
