import type { EstadoBorrador } from '../lib/useBorrador';

/**
 * El cartel de "quedó algo a medio cargar", arriba del primer campo.
 *
 * Va adentro del formulario y no arriba de la pantalla porque es donde se mira
 * al abrir. El mismo en los tres formularios que guardan borrador: que el de
 * pacientes diga una cosa y el de turnos otra obligaría a leerlos dos veces.
 */
export function AvisoBorrador({
  estado,
  onRetomar,
  onDescartar,
}: {
  estado: EstadoBorrador;
  onRetomar: () => void;
  onDescartar: () => void;
}) {
  if (estado === 'no') return null;

  if (estado === 'ofrecido') {
    return (
      <div className="borrador-aviso">
        <span>Quedó algo a medio cargar la última vez.</span>
        <div className="actions">
          <button className="btn small primary" onClick={onRetomar}>
            Retomarlo
          </button>
          <button className="btn small ghost" onClick={onDescartar}>
            Empezar de cero
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="borrador-aviso">
      <span>Esto es lo que habías empezado a cargar.</span>
      <button className="btn small ghost" onClick={onDescartar}>
        Empezar de cero
      </button>
    </div>
  );
}
