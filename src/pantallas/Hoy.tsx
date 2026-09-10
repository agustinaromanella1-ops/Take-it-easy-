import { enPalabras, hoy } from '../fecha';
import './Hoy.css';

export default function Hoy() {
  const fecha = hoy();

  return (
    <div className="pantalla hoy">
      <header>
        <p className="fecha">{enPalabras(fecha)}</p>
        <h1>Hoy</h1>
      </header>

      <section className="vacio">
        <p className="invitacion">Todavía no cargaste tus materias.</p>
        <p className="detalle">
          Cuando estén, acá vas a ver las clases del día en orden, y vas a poder
          tomar asistencia de la que sigue.
        </p>
      </section>
    </div>
  );
}
