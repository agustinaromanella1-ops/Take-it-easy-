import { useLiveQuery } from 'dexie-react-hooks';

import { db } from '../datos/db';
import { comoSeLlama, todasLasMaterias } from '../datos/materias';
import type { Id } from '../datos/tipos';
import './Materias.css';

interface Props {
  abrir: (materiaId: Id) => void;
  crear: () => void;
}

export default function Materias({ abrir, crear }: Props) {
  const materias = useLiveQuery(todasLasMaterias, [], []);
  const inscripciones = useLiveQuery(() => db.inscripciones.toArray(), [], []);

  return (
    <div className="pantalla materias">
      <header>
        <h1>Materias</h1>
      </header>

      {materias.length === 0 ? (
        <section className="vacio">
          <p className="invitacion">Todavía no cargaste ninguna materia.</p>
          <p className="detalle">
            Cargá la primera con el curso donde la dictás, y después le agregás
            los alumnos.
          </p>
        </section>
      ) : (
        <ul className="lista">
          {materias.map((m) => {
            const cuantos = inscripciones.filter(
              (i) => i.materiaId === m.id && i.estado === 'activa',
            ).length;
            return (
              <li key={m.id}>
                <button className={`materia ${m.colorPastel}`} onClick={() => abrir(m.id)}>
                  <span className="titulo">{comoSeLlama(m)}</span>
                  <span className="detalle">
                    {cuantos === 0
                      ? 'Sin alumnos todavía'
                      : `${cuantos} ${cuantos === 1 ? 'alumno' : 'alumnos'}`}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="pie">
        <button className="primario" onClick={crear}>
          Crear materia
        </button>
      </div>
    </div>
  );
}
