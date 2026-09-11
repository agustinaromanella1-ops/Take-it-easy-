import { useLiveQuery } from 'dexie-react-hooks';

import { clasesDelDia, estadoDeClase, laQueSigue } from '../datos/bloques';
import { db } from '../datos/db';
import type { Id } from '../datos/tipos';
import { enPalabras, hoy } from '../fecha';
import './Hoy.css';

interface Props {
  tomarAsistencia: (materiaId: Id, bloqueHorarioId: Id) => void;
  irAMaterias: () => void;
}

export default function Hoy({ tomarAsistencia, irAMaterias }: Props) {
  const fecha = hoy();

  const datos = useLiveQuery(
    async () => ({
      clases: await clasesDelDia(fecha),
      cuantasMaterias: await db.materias.filter((m) => !m.archivada).count(),
    }),
    [fecha],
  );

  if (!datos) return <div className="pantalla hoy" />;

  const { clases, cuantasMaterias } = datos;
  const siguiente = laQueSigue(clases);

  return (
    <div className="pantalla hoy">
      <header>
        <p className="fecha">{enPalabras(fecha)}</p>
        <h1>Hoy</h1>
      </header>

      {clases.length === 0 ? (
        <section className="vacio">
          {cuantasMaterias === 0 ? (
            <>
              <p className="invitacion">Todavía no cargaste tus materias.</p>
              <p className="detalle">
                Cargalas con el curso donde las dictás, y después les agregás los
                alumnos y el horario.
              </p>
            </>
          ) : (
            <>
              <p className="invitacion">Hoy no tenés clases cargadas.</p>
              <p className="detalle">
                Si dictás alguna materia hoy, cargale el horario y va a aparecer
                acá sola.
              </p>
            </>
          )}
          <button className="secundario" onClick={irAMaterias}>
            Ir a Materias
          </button>
        </section>
      ) : (
        <ul className="clases">
          {clases.map((clase) => {
            const esLaQueSigue = clase.bloque.id === siguiente?.bloque.id;
            const estado = estadoDeClase(clase);
            // Deja de haber acción primaria cuando ya no queda nada por hacer.
            const pendiente = estado.tipo === 'sin-registrar' || estado.tipo === 'a-medias';

            return (
              <li
                key={clase.bloque.id}
                className={`clase ${clase.materia.colorPastel} ${
                  esLaQueSigue && pendiente ? 'siguiente' : ''
                }`}
              >
                <div className="hora">{clase.bloque.horaInicio}</div>
                <div className="cuerpo">
                  {esLaQueSigue && pendiente && <p className="etiqueta">La que sigue</p>}
                  <p className="materia">{clase.materia.nombre}</p>
                  <p className="curso">
                    {clase.materia.anio}.º {clase.materia.division}
                  </p>

                  {esLaQueSigue && pendiente ? (
                    <button
                      className="primario"
                      onClick={() => tomarAsistencia(clase.materia.id, clase.bloque.id)}
                    >
                      {estado.tipo === 'a-medias' ? 'Seguir tomando asistencia' : 'Tomar asistencia'}
                    </button>
                  ) : (
                    <button
                      className={`estado ${estado.tipo}`}
                      onClick={() => tomarAsistencia(clase.materia.id, clase.bloque.id)}
                    >
                      {estado.texto}
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
