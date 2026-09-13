import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';

import { enPalabras } from '../fecha';
import {
  NotaFinalInvalidaError,
  boletinDeAlumno,
  borrarNotaFinal,
  ponerNotaFinal,
} from '../datos/boletin';
import { comoSeEscribe, leerNumero } from '../datos/escalas';
import { db } from '../datos/db';
import { comoSeLlama, materia as buscarMateria } from '../datos/materias';
import type { Id } from '../datos/tipos';
import './NotasDelAlumno.css';

/**
 * Todo lo de un alumno en una materia, junto: cada evaluación con su nota, las
 * conceptuales incluidas, las observaciones, y abajo la nota final.
 *
 * Es la pantalla de cerrar una materia. Hasta acá eso había que armarlo en la
 * cabeza abriendo evaluación por evaluación.
 */

interface Props {
  alumnoId: Id;
  materiaId: Id;
  volver: () => void;
}

export default function NotasDelAlumno({ alumnoId, materiaId, volver }: Props) {
  const datos = useLiveQuery(async () => {
    const [alumno, materia, boletin] = await Promise.all([
      db.alumnos.get(alumnoId),
      buscarMateria(materiaId),
      boletinDeAlumno(alumnoId, materiaId),
    ]);
    return { alumno, materia, boletin };
  }, [alumnoId, materiaId]);

  // Lo tipeado mientras se tipea. Sale de acá al guardarse.
  const [tipeado, setTipeado] = useState<string | null>(null);
  const [error, setError] = useState(false);

  if (!datos?.alumno || !datos.materia) return <div className="pantalla notas-alumno" />;

  const { alumno, materia, boletin } = datos;
  const { lineas, promedio, observaciones, notaFinal, escalaFinal } = boletin;
  const conNota = lineas.filter((l) => l.comoSeLee !== null).length;

  async function guardarFinal(escrito: string) {
    setTipeado(null);
    if (escrito.trim() === '') {
      await borrarNotaFinal(alumnoId, materiaId);
      setError(false);
      return;
    }

    const numero = leerNumero(escrito);
    if (numero === null) {
      setError(true);
      return;
    }

    try {
      await ponerNotaFinal(alumnoId, materiaId, numero, escalaFinal);
      setError(false);
    } catch (e) {
      if (e instanceof NotaFinalInvalidaError) setError(true);
      else throw e;
    }
  }

  return (
    <div className="pantalla notas-alumno">
      <header>
        <button className="volver" onClick={volver}>
          ← {comoSeLlama(materia)}
        </button>
        <h1>
          {alumno.nombre} {alumno.apellido}
        </h1>
        <p className="detalle">
          {conNota} de {lineas.length}{' '}
          {lineas.length === 1 ? 'evaluación con nota' : 'evaluaciones con nota'}
          {promedio.valor !== null && (
            <span className="promedio">
              {' '}
              · promedio {comoSeEscribe(escalaFinal, promedio.valor)}
            </span>
          )}
        </p>
      </header>

      {lineas.length === 0 ? (
        <section className="vacio">
          <p className="invitacion">Esta materia todavía no tiene evaluaciones.</p>
          <p className="detalle">
            Cargá una desde la materia y acá vas a ver cómo le fue en cada una.
          </p>
        </section>
      ) : (
        <ul className="lineas">
          {lineas.map(({ evaluacion, comoSeLee }) => (
            <li key={evaluacion.id} className={comoSeLee === null ? 'linea sin' : 'linea'}>
              <div className="que">
                <span className="nombre">{evaluacion.nombre}</span>
                <span className="detalle">
                  {evaluacion.tipo} · {enPalabras(evaluacion.fecha)}
                </span>
              </div>
              <span
                className={
                  evaluacion.escala.tipo === 'conceptual' ? 'valor conceptual' : 'valor'
                }
              >
                {comoSeLee ?? 'Sin nota'}
              </span>
            </li>
          ))}
        </ul>
      )}

      {promedio.conceptuales > 0 && (
        <p className="ayuda">
          {promedio.conceptuales === 1
            ? 'Hay una evaluación conceptual, y no entra en el promedio'
            : `Hay ${promedio.conceptuales} evaluaciones conceptuales, y no entran en el promedio`}
          : promediar etiquetas inventa una distancia que nadie definió.
        </p>
      )}

      <section className="final">
        <h2>Nota final</h2>
        <p className="ayuda">
          La ponés vos. La app no la calcula ni la sugiere: cada escuela pondera
          distinto, y el promedio de arriba es una referencia, no la cuenta.
        </p>
        <div className="poner">
          <input
            className={error ? 'nota error' : 'nota'}
            inputMode="decimal"
            value={tipeado ?? (notaFinal === null ? '' : comoSeEscribe(escalaFinal, notaFinal))}
            onChange={(e) => setTipeado(e.target.value)}
            onBlur={(e) => void guardarFinal(e.target.value)}
            placeholder="—"
            aria-label={`Nota final de ${alumno.nombre} ${alumno.apellido} en ${comoSeLlama(materia)}`}
          />
          <span className="de">
            de {escalaFinal.tipo === 'numerica' ? `${escalaFinal.min} a ${escalaFinal.max}` : ''}
          </span>
        </div>
        {error && (
          <p className="aviso">
            Esa nota no entra en la escala de la materia
            {escalaFinal.tipo === 'numerica' && `, que va de ${escalaFinal.min} a ${escalaFinal.max}`}
            . No se guardó.
          </p>
        )}
      </section>

      <section className="anotado">
        <h2>Observaciones</h2>
        {observaciones.length === 0 ? (
          <p className="ayuda">No anotaste nada de este alumno en esta materia.</p>
        ) : (
          <ul className="obs">
            {observaciones.map((o) => (
              <li key={o.id}>
                <span className="fecha">{enPalabras(o.fecha)}</span>
                <p className="texto">{o.texto}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
