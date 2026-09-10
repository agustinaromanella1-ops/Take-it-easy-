import { useLiveQuery } from 'dexie-react-hooks';

import { db } from '../datos/db';
import {
  comoSeLlama,
  materiasActivas,
  materiasArchivadas,
  recuperarMateria,
} from '../datos/materias';
import type { Id } from '../datos/tipos';
import './Materias.css';

interface Props {
  abrir: (materiaId: Id) => void;
  crear: () => void;
}

export default function Materias({ abrir, crear }: Props) {
  const materias = useLiveQuery(materiasActivas, [], []);
  const archivadas = useLiveQuery(materiasArchivadas, [], []);
  const inscripciones = useLiveQuery(() => db.inscripciones.toArray(), [], []);

  return (
    <div className="pantalla materias">
      <header>
        <h1>Materias</h1>
      </header>

      {materias.length === 0 && archivadas.length === 0 ? (
        <section className="vacio">
          <p className="invitacion">Todavía no cargaste ninguna materia.</p>
          <p className="detalle">
            Cargá la primera con el curso donde la dictás, y después le agregás
            los alumnos.
          </p>
        </section>
      ) : materias.length > 0 ? (
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
      ) : null}

      {archivadas.length > 0 && (
        <section className="archivadas">
          <h2>Archivadas</h2>
          <ul>
            {archivadas.map((m) => (
              <li key={m.id}>
                <span>{comoSeLlama(m)}</span>
                <button onClick={() => recuperarMateria(m.id)}>Recuperar</button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="pie">
        <button className="primario" onClick={crear}>
          Crear materia
        </button>
      </div>
    </div>
  );
}
