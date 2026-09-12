import { useLiveQuery } from 'dexie-react-hooks';

import { DIAS, hoy } from '../fecha';
import { bloquesDeMateria } from '../datos/bloques';
import { evaluacionesDeMateria } from '../datos/evaluaciones';
import { darDeBaja, alumnosInscriptos } from '../datos/inscripciones';
import {
  comoSeLlama,
  materia as buscarMateria,
  nombreDeEscuela,
} from '../datos/materias';
import type { Id } from '../datos/tipos';
import Pista from '../instructivo/Pista';
import { usePista } from '../instructivo/useInstructivo';
import './Materia.css';

interface Props {
  materiaId: Id;
  volver: () => void;
  agregarAlumnos: () => void;
  editarHorario: () => void;
  tomarAsistencia: () => void;
  verEvaluaciones: () => void;
  verFicha: (alumnoId: Id) => void;
}

export default function Materia({
  materiaId,
  volver,
  agregarAlumnos,
  editarHorario,
  tomarAsistencia,
  verEvaluaciones,
  verFicha,
}: Props) {
  const datos = useLiveQuery(async () => {
    const m = await buscarMateria(materiaId);
    return {
      materia: m,
      escuela: m ? await nombreDeEscuela(m.escuelaId) : '',
      alumnos: await alumnosInscriptos(materiaId),
      bloques: await bloquesDeMateria(materiaId),
      evaluaciones: await evaluacionesDeMateria(materiaId),
    };
  }, [materiaId]);

  const sinAlumnos = datos !== undefined && datos.alumnos.length === 0;
  const { mostrarPista, entendido } = usePista('agregar-alumnos', sinAlumnos);

  if (!datos?.materia) return <div className="pantalla materia" />;

  const { materia, escuela, alumnos, bloques, evaluaciones } = datos;

  return (
    <div className="pantalla materia">
      <header>
        <button className="volver" onClick={volver}>
          ← Materias
        </button>
        <h1>{comoSeLlama(materia)}</h1>
        {escuela && <p className="escuela">{escuela}</p>}
      </header>

      <button className="horario" onClick={editarHorario}>
        <span className="rotulo">Horario</span>
        <span className="valor">
          {bloques.length === 0
            ? 'Sin cargar'
            : bloques
                .map((b) => `${DIAS[b.diaSemana - 1].nombre} ${b.horaInicio}`)
                .join(' · ')}
        </span>
      </button>

      <button className="horario" onClick={verEvaluaciones}>
        <span className="rotulo">Evaluaciones</span>
        <span className="valor">
          {evaluaciones.length === 0
            ? 'Ninguna todavía'
            : `${evaluaciones.length} ${evaluaciones.length === 1 ? 'cargada' : 'cargadas'}`}
        </span>
      </button>

      {alumnos.length === 0 ? (
        <section className="vacio">
          <p className="invitacion">Esta materia todavía no tiene alumnos.</p>
          <p className="detalle">
            Pegá la lista del curso y quedan inscriptos acá. Los que ya estén
            cargados de otra materia no se duplican.
          </p>
        </section>
      ) : (
        <>
          <p className="cuantos">
            {alumnos.length} {alumnos.length === 1 ? 'alumno inscripto' : 'alumnos inscriptos'}
          </p>
          <ul className="alumnos">
            {alumnos.map((alumno) => (
              <li key={alumno.id}>
                <button className="nombre" onClick={() => verFicha(alumno.id)}>
                  {alumno.apellido}, {alumno.nombre}
                </button>
                <button onClick={() => darDeBaja(materiaId, alumno.id, hoy())}>Dar de baja</button>
              </li>
            ))}
          </ul>
        </>
      )}

      <div className="pie">
        {mostrarPista && (
          <Pista
            texto="Pegá acá la lista del curso: se dan de alta y quedan inscriptos en un paso."
            onEntendido={entendido}
          />
        )}
        {alumnos.length > 0 && (
          <button className="primario" onClick={tomarAsistencia}>
            Tomar asistencia
          </button>
        )}
        <button
          className={alumnos.length > 0 ? 'secundario' : 'primario'}
          onClick={agregarAlumnos}
        >
          Agregar alumnos
        </button>
      </div>
    </div>
  );
}
