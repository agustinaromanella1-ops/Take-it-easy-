import { useStore } from '../store/StoreContext';

/**
 * La barra de deshacer, abajo y encima de la barra de pestañas.
 *
 * Además de deshacer, confirma: dice en palabras qué acaba de pasar. Un
 * cambio que se aplica en silencio obliga a revisar la pantalla para saber si
 * salió, y esa revisión es justo la que se olvida.
 */
export function Deshacer() {
  const { deshacer } = useStore();
  if (!deshacer) return null;

  return (
    <div className="deshacer" role="status">
      <span className="deshacer-texto">{deshacer.etiqueta}</span>
      <button className="btn small" onClick={deshacer.hacer}>
        Deshacer
      </button>
    </div>
  );
}
