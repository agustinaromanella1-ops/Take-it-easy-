import { useLiveQuery } from 'dexie-react-hooks';

import { db } from '../datos/db';
import {
  archivarMateria,
  comoSeLlama,
  deshacerCreacion,
  materiasActivas,
  materiasArchivadas,
  recuperarMateria,
} from '../datos/materias';
import type { Id } from '../datos/tipos';
import Pista from '../instructivo/Pista';
import Guardado from '../componentes/Guardado';
import { usePista } from '../instructivo/useInstructivo';
import './Materias.css';

interface Props {
  abrir: (materiaId: Id) => void;
  crear: () => void;
  /** La que se acaba de crear, para confirmar que quedó guardada. */
  reciencreada?: { id: Id; nombre: string };
  olvidarReciencreada: () => void;
}

export default function Materias({ abrir, crear, reciencreada, olvidarReciencreada }: Props) {
  const materias = useLiveQuery(materiasActivas, [], []);
  const archivadas = useLiveQuery(materiasArchivadas, [], []);
  const inscripciones = useLiveQuery(() => db.inscripciones.toArray(), [], []);
  const { mostrarPista, entendido } = usePista('crear-materia', materias.length === 0);

  async function deshacerAlta() {
    if (reciencreada) await deshacerCreacion(reciencreada.id);
    olvidarReciencreada();
  }

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
              <li key={m.id} className={`fila ${m.colorPastel}`}>
                <button className="materia" onClick={() => abrir(m.id)}>
                  <span className="titulo">{comoSeLlama(m)}</span>
                  <span className="detalle">
                    {cuantos === 0
                      ? 'Sin alumnos todavía'
                      : `${cuantos} ${cuantos === 1 ? 'alumno' : 'alumnos'}`}
                  </span>
                </button>
                <button className="archivar" onClick={() => archivarMateria(m.id)}>
                  Archivar
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
        {reciencreada && (
          <Guardado
            texto={`${reciencreada.nombre} quedó guardada.`}
            deshacer={deshacerAlta}
            alIrse={olvidarReciencreada}
          />
        )}
        {mostrarPista && (
          <Pista
            texto="Empezá creando una materia con el curso donde la dictás."
            onEntendido={entendido}
          />
        )}
        <button className="primario" onClick={crear}>
          Crear materia
        </button>
      </div>
    </div>
  );
}
