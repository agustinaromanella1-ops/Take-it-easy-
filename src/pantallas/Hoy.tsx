import { useLiveQuery } from 'dexie-react-hooks';

import { db } from '../datos/db';
import { enPalabras, hoy } from '../fecha';
import './Hoy.css';

export default function Hoy() {
  const fecha = hoy();
  const cuantasMaterias = useLiveQuery(() => db.materias.count(), [], null);

  return (
    <div className="pantalla hoy">
      <header>
        <p className="fecha">{enPalabras(fecha)}</p>
        <h1>Hoy</h1>
      </header>

      {/* Hasta que la consulta responde no se sabe cuál de los dos textos va, y
          mostrar uno al azar hace parpadear un mensaje falso. */}
      <section className="vacio">
        {cuantasMaterias === null ? null : cuantasMaterias === 0 ? (
          <>
            <p className="invitacion">Todavía no cargaste tus materias.</p>
            <p className="detalle">
              Cargalas desde Materias, con el curso donde las dictás, y después
              les agregás los alumnos.
            </p>
          </>
        ) : (
          <>
            <p className="invitacion">Falta cargar tus horarios.</p>
            <p className="detalle">
              Cuando cada materia tenga su horario semanal, acá vas a ver las
              clases del día en orden. Mientras tanto, podés tomar asistencia
              entrando a la materia.
            </p>
          </>
        )}
      </section>
    </div>
  );
}
