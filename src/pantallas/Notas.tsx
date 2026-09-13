import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';

import { enPalabras } from '../fecha';
import { borrarCalificacion, calificar } from '../datos/calificaciones';
import { cabeEnLaEscala, comoSeEscribe, leerNumero } from '../datos/escalas';
import { distribucion, planillaDeEvaluacion, promedioDeEvaluacion } from '../datos/evaluaciones';
import type { Id } from '../datos/tipos';
import Pista from '../instructivo/Pista';
import { usePista } from '../instructivo/useInstructivo';
import './Notas.css';

/**
 * Cargar las notas de una evaluación. La acción primaria es poner una nota, y
 * no hay botón de guardar: cada nota se escribe cuando se termina de escribir.
 */

interface Props {
  evaluacionId: Id;
  volver: () => void;
  /** Terminó de cargar: confirma y vuelve a la materia, sin usar la flecha. */
  listo: (nombreDeLaEvaluacion: string) => void;
}

export default function Notas({ evaluacionId, volver, listo }: Props) {
  const planilla = useLiveQuery(() => planillaDeEvaluacion(evaluacionId), [evaluacionId]);
  // Lo tipeado mientras se tipea. Sale de acá al guardarse, y entonces vuelve a
  // mandar lo que dice la base.
  const [tipeado, setTipeado] = useState<Record<Id, string>>({});
  const [errores, setErrores] = useState<Record<Id, boolean>>({});
  // Cada nota se guarda sola al escribirla, y guardar en silencio hace dudar.
  // El cartel se va solo: es un aviso, no una tarea pendiente.
  const [recienGuardada, setRecienGuardada] = useState(false);
  // Dos marcas y no una: escribir un número y tocar una etiqueta se cargan
  // distinto, así que cada planilla se explica la primera vez que se la ve.
  // Con una sola marca, quien empezara por una numérica no veía nunca cómo se
  // usa la conceptual.
  const comoSeCarga = usePista(
    planilla?.evaluacion.escala.tipo === 'conceptual'
      ? 'cargar-notas-conceptuales'
      : 'cargar-notas-numericas',
    planilla !== undefined,
  );

  useEffect(() => {
    if (!recienGuardada) return;
    const temporizador = setTimeout(() => setRecienGuardada(false), 2500);
    return () => clearTimeout(temporizador);
  }, [recienGuardada]);

  if (!planilla) return <div className="pantalla notas" />;

  const { evaluacion, notas, cargadas } = planilla;
  const { escala } = evaluacion;
  const promedio = promedioDeEvaluacion(evaluacion, notas);
  const escalones = distribucion(evaluacion, notas);

  async function guardarNumero(alumnoId: Id, escrito: string) {
    const numero = leerNumero(escrito);

    if (escrito.trim() === '') {
      await borrarCalificacion(evaluacionId, alumnoId);
      setErrores((e) => ({ ...e, [alumnoId]: false }));
      setTipeado((t) => ({ ...t, [alumnoId]: '' }));
      return;
    }

    if (numero === null || !cabeEnLaEscala(escala, numero)) {
      setErrores((e) => ({ ...e, [alumnoId]: true }));
      return;
    }

    await calificar({ evaluacionId, alumnoId, valor: numero });
    setErrores((e) => ({ ...e, [alumnoId]: false }));
    setRecienGuardada(true);
    setTipeado((t) => {
      const { [alumnoId]: _, ...resto } = t;
      return resto;
    });
  }

  async function tocarEtiqueta(alumnoId: Id, etiquetaId: Id, yaPuesta: boolean) {
    // Volver a tocar la que ya estaba la saca: es la forma de corregirse sin
    // un botón de borrar por fila.
    if (yaPuesta) await borrarCalificacion(evaluacionId, alumnoId);
    else await calificar({ evaluacionId, alumnoId, valor: etiquetaId });
    setRecienGuardada(true);
  }

  return (
    <div className="pantalla notas">
      <header>
        <button className="volver" onClick={volver}>
          ← Evaluaciones
        </button>
        <h1>{evaluacion.nombre}</h1>
        <p className="detalle">
          {evaluacion.tipo} · {enPalabras(evaluacion.fecha)}
        </p>
        <p className="resumen">
          {cargadas} de {notas.length} {notas.length === 1 ? 'nota cargada' : 'notas cargadas'}
          {promedio !== null && (
            <span className="promedio"> · promedio {comoSeEscribe(escala, promedio)}</span>
          )}
        </p>
        {recienGuardada && <p className="guardada">Guardado</p>}
      </header>

      {comoSeCarga.mostrarPista && notas.length > 0 && (
        <Pista
          onEntendido={comoSeCarga.entendido}
          texto={
            escala.tipo === 'numerica' ? (
              <>
                <p>
                  <strong>Cada nota se guarda sola</strong> al terminar de
                  escribirla. No hay que confirmar nada.
                </p>
                <p>
                  Con el «siguiente» del teclado pasás al alumno de abajo sin
                  tocar la pantalla: con la planilla de papel al lado, cargás la
                  columna entera de corrido.
                </p>
              </>
            ) : (
              <>
                <p>
                  <strong>Tocá la etiqueta que le corresponde</strong> a cada
                  alumno. Se guarda sola, y si te equivocaste, tocás la que ya
                  estaba puesta y se saca.
                </p>
              </>
            )
          }
        />
      )}

      {notas.length === 0 ? (
        <section className="vacio">
          <p className="invitacion">Esta materia todavía no tiene alumnos.</p>
          <p className="detalle">Cargá la lista del curso y después volvé acá.</p>
        </section>
      ) : (
        <ul className="alumnos">
          {notas.map(({ alumno, valor }) => (
            <li key={alumno.id} className={errores[alumno.id] ? 'fila error' : 'fila'}>
              <span className="nombre">
                {alumno.apellido}, {alumno.nombre}
              </span>

              {escala.tipo === 'numerica' ? (
                <input
                  className="nota"
                  inputMode="decimal"
                  value={tipeado[alumno.id] ?? (valor === null ? '' : comoSeEscribe(escala, valor))}
                  onChange={(e) => setTipeado((t) => ({ ...t, [alumno.id]: e.target.value }))}
                  onBlur={(e) => void guardarNumero(alumno.id, e.target.value)}
                  placeholder="—"
                  aria-label={`Nota de ${alumno.apellido}, ${alumno.nombre}`}
                />
              ) : (
                <div className="etiquetas">
                  {escala.etiquetas.map((etiqueta) => (
                    <button
                      key={etiqueta.id}
                      className={valor === etiqueta.id ? 'elegida' : undefined}
                      onClick={() => void tocarEtiqueta(alumno.id, etiqueta.id, valor === etiqueta.id)}
                    >
                      {etiqueta.texto}
                    </button>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {Object.values(errores).some(Boolean) && (
        <p className="aviso">
          Hay una nota que no entra en la escala de esta evaluación
          {escala.tipo === 'numerica' && `, que va de ${escala.min} a ${escala.max}`}. No se guardó.
        </p>
      )}

      <div className="pie">
        <button className="primario" onClick={() => listo(evaluacion.nombre)}>
          Listo
        </button>
      </div>

      {escalones.length > 0 && cargadas > 0 && (
        <section className="distribucion">
          <h2>Cómo quedó el curso</h2>
          <p className="detalle">
            En una escala conceptual no hay promedio: promediar etiquetas
            inventa una distancia entre ellas que nadie definió.
          </p>
          <ul>
            {escalones.map((e) => (
              <li key={e.id}>
                <span>{e.texto}</span>
                <span className="cuantas">{e.cuantas}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
