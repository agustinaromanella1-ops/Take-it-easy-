import { useLiveQuery } from 'dexie-react-hooks';

import { DIAS, hoy } from '../fecha';
import { comoVaLaAsistencia } from '../datos/asistencia';
import { bloqueSugerido, bloquesDeMateria } from '../datos/bloques';
import { evaluacionesDeMateria } from '../datos/evaluaciones';
import { darDeBaja, alumnosInscriptos } from '../datos/inscripciones';
import {
  comoSeLlama,
  materia as buscarMateria,
  nombreDeEscuela,
} from '../datos/materias';
import type { Id } from '../datos/tipos';
import Guardado, { type LoGuardado } from '../componentes/Guardado';
import Pista from '../instructivo/Pista';
import { usePista } from '../instructivo/useInstructivo';
import './Materia.css';

/**
 * Los días vienen en minúscula, como se escriben en español. Acá arrancan una
 * frase. Lo hace el texto y no un `text-transform: capitalize`, que además
 * escribía "Sin Cargar" y "1 Cargada".
 */
function conMayuscula(texto: string): string {
  return texto.charAt(0).toLocaleUpperCase('es-AR') + texto.slice(1);
}

interface Props {
  materiaId: Id;
  volver: () => void;
  agregarAlumnos: () => void;
  editarHorario: () => void;
  tomarAsistencia: () => void;
  verEvaluaciones: () => void;
  verFicha: (alumnoId: Id) => void;
  /** Lo último que se guardó en una pantalla de más adentro. */
  guardado?: LoGuardado;
  olvidarGuardado: () => void;
}

export default function Materia({
  materiaId,
  volver,
  agregarAlumnos,
  editarHorario,
  tomarAsistencia,
  verEvaluaciones,
  verFicha,
  guardado,
  olvidarGuardado,
}: Props) {
  const datos = useLiveQuery(async () => {
    const m = await buscarMateria(materiaId);
    const alumnos = await alumnosInscriptos(materiaId);
    const fecha = hoy();
    return {
      materia: m,
      escuela: m ? await nombreDeEscuela(m.escuelaId) : '',
      alumnos,
      bloques: await bloquesDeMateria(materiaId),
      evaluaciones: await evaluacionesDeMateria(materiaId),
      asistencia: await comoVaLaAsistencia(
        materiaId,
        fecha,
        await bloqueSugerido(materiaId, fecha),
        alumnos.length,
      ),
    };
  }, [materiaId]);

  const sinAlumnos = datos !== undefined && datos.alumnos.length === 0;
  const { mostrarPista, entendido } = usePista('agregar-alumnos', sinAlumnos);
  // Sólo cuando ya hay alumnos: antes de eso la pantalla está pidiendo otra
  // cosa, y dos pistas juntas no se leen, se saltean.
  const notas = usePista('dónde-van-las-notas', datos !== undefined && !sinAlumnos);

  if (!datos?.materia) return <div className="pantalla materia" />;

  const { materia, escuela, alumnos, bloques, evaluaciones, asistencia } = datos;
  // Tomada del todo, empezada, o sin empezar: son tres cosas distintas y el
  // botón tiene que decir cuál. «Tomar asistencia» cuando ya está tomada hace
  // dudar de si se guardó.
  const yaSeTomo = asistencia.total > 0 && asistencia.registradas >= asistencia.total;
  const aMedias = asistencia.registradas > 0 && !yaSeTomo;

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
                .map((b) => `${conMayuscula(DIAS[b.diaSemana - 1].nombre)} ${b.horaInicio}`)
                .join(' · ')}
        </span>
      </button>

      {notas.mostrarPista && (
        <Pista
          onEntendido={notas.entendido}
          texto={
            <>
              <p>
                <strong>Las notas van acá.</strong> Cada parcial, trabajo
                práctico u oral es una evaluación, y adentro le ponés la nota a
                todo el curso de una vez.
              </p>
            </>
          }
        />
      )}

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
        {guardado && <Guardado {...guardado} alIrse={olvidarGuardado} />}
        {mostrarPista && (
          <Pista
            texto="Pegá acá la lista del curso: se dan de alta y quedan inscriptos en un paso."
            onEntendido={entendido}
          />
        )}
        {alumnos.length > 0 && (
          <button
            className={yaSeTomo ? 'secundario' : 'primario'}
            onClick={tomarAsistencia}
          >
            {yaSeTomo
              ? 'Asistencia tomada · revisar'
              : aMedias
                ? `Seguir la asistencia · ${asistencia.registradas} de ${asistencia.total}`
                : 'Tomar asistencia'}
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
