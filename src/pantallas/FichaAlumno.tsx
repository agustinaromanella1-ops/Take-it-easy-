import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';

import { BotonDeDictado } from '../componentes/Dictado';
import { useDictado } from '../componentes/useDictado';
import { enPalabras, hoy } from '../fecha';
import { promedioDeAlumno } from '../datos/calificaciones';
import { db } from '../datos/db';
import { comoSeEscribe, NUMERICA_1_10 } from '../datos/escalas';
import {
  detalleDeAsistencia,
  estuvo,
  materiasDeAlumno,
  resumenDeAsistencia,
} from '../datos/ficha';
import { comoSeLlama, materia as buscarMateria } from '../datos/materias';
import {
  borrarObservacion,
  crearObservacion,
  observacionesDeAlumno,
  restaurarObservacion,
} from '../datos/observaciones';
import type { Id, Observacion } from '../datos/tipos';
import './FichaAlumno.css';

/**
 * La ficha de un alumno, dentro de una materia: quién es, cómo viene y qué se
 * anotó de él. La acción primaria es anotar una observación.
 *
 * No hay foto, ni teléfono, ni documento, ni nada parecido a un campo de
 * salud. No es una omisión que se pueda completar más adelante.
 */

interface Props {
  alumnoId: Id;
  materiaId: Id;
  volver: () => void;
  /** Abre las notas de este alumno en esta materia, para cerrarla. */
  verNotas: () => void;
}

export default function FichaAlumno({ alumnoId, materiaId, volver, verNotas }: Props) {
  const datos = useLiveQuery(async () => {
    const [alumno, materia, materias, asistencia, promedio, observaciones] = await Promise.all([
      db.alumnos.get(alumnoId),
      buscarMateria(materiaId),
      materiasDeAlumno(alumnoId),
      resumenDeAsistencia(alumnoId, materiaId),
      promedioDeAlumno(alumnoId, materiaId),
      observacionesDeAlumno(alumnoId),
    ]);
    return { alumno, materia, materias, asistencia, promedio, observaciones };
  }, [alumnoId, materiaId]);

  const [anotando, setAnotando] = useState(false);
  const [texto, setTexto] = useState('');
  const [guardando, setGuardando] = useState(false);
  // Lo borrado se guarda entero hasta que se vaya de la pantalla: borrar de un
  // toque sin vuelta atrás no cumple la regla de deshacer en lugar de confirmar.
  const [borrada, setBorrada] = useState<Observacion | null>(null);
  // El micrófono sólo aparece si este teléfono reconoce voz sin mandar el
  // audio a ningún lado. Si no puede, no hay botón (1.2).
  const dictado = useDictado(setTexto);

  if (!datos?.alumno || !datos.materia) return <div className="pantalla ficha" />;

  const { alumno, materia, materias, asistencia, promedio, observaciones } = datos;

  async function anotar() {
    // Sin esta guarda, el segundo toque anota la observación dos veces.
    if (guardando || texto.trim() === '') return;
    setGuardando(true);
    try {
      if (dictado.escuchando) await dictado.parar();
      await crearObservacion({ ambito: 'alumno', alumnoId, materiaId, fecha: hoy(), texto: texto.trim() });
      setTexto('');
      setAnotando(false);
    } finally {
      setGuardando(false);
    }
  }

  if (anotando) {
    return (
      <div className="pantalla ficha">
        <header>
          <button
            className="volver"
            onClick={() => {
              // Salir de la pantalla apaga el micrófono: dejarlo prendido en
              // la ficha sería escuchar sin que nada lo muestre.
              if (dictado.escuchando) void dictado.parar();
              setAnotando(false);
            }}
          >
            ← Volver a la ficha
          </button>
          <h1>Anotar</h1>
          <p className="ayuda">
            Sobre {alumno.nombre}, en {comoSeLlama(materia)}. Escribí qué pasó:
            qué entregó, qué dijo, a qué faltó. Lo que se describe es el hecho,
            no la persona.
          </p>
        </header>

        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="No entregó el trabajo. Pidió una semana más."
          rows={7}
          autoFocus
        />

        {dictado.disponible && (
          <BotonDeDictado
            escuchando={dictado.escuchando}
            loEscrito={texto}
            arrancar={dictado.arrancar}
            parar={dictado.parar}
          />
        )}

        {dictado.problema && <p className="dictado-problema">{dictado.problema}</p>}

        <p className="privada">
          <strong>Sólo la ves vos.</strong> Las observaciones no se comparten ni
          se envían a ningún lado: quedan en este teléfono.
        </p>

        <div className="pie">
          <button className="primario" onClick={anotar} disabled={texto.trim() === '' || guardando}>
            Guardar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="pantalla ficha">
      <header>
        <button className="volver" onClick={volver}>
          ← {comoSeLlama(materia)}
        </button>
        <h1>
          {alumno.nombre} {alumno.apellido}
        </h1>
        <div className="materias">
          {materias.map((m) => (
            <span key={m.id} className={`chip ${m.colorPastel}`}>
              {m.nombre}
            </span>
          ))}
        </div>
      </header>

      <div className="tarjetas">
        <div className="tarjeta">
          <p className="rotulo">Asistencia</p>
          <p className="valor">
            {asistencia.registradas === 0 ? '—' : `${estuvo(asistencia)} de ${asistencia.registradas}`}
          </p>
          <p className="detalle">
            {asistencia.registradas === 0
              ? 'Todavía no se tomó lista'
              : detalleDeAsistencia(asistencia) || 'Sin faltas'}
          </p>
        </div>

        {/* La de promedio se toca: abre el año entero, evaluación por
            evaluación, que es lo que hace falta para cerrar la materia. */}
        <button className="tarjeta abre" onClick={verNotas}>
          <p className="rotulo">Notas</p>
          <p className="valor">
            {promedio.valor === null ? '—' : comoSeEscribe(NUMERICA_1_10, promedio.valor)}
          </p>
          <p className="detalle">
            {promedio.numericas === 0 && promedio.conceptuales === 0
              ? 'Sin notas todavía'
              : [
                  `promedio de ${promedio.numericas}`,
                  promedio.conceptuales > 0 &&
                    `${promedio.conceptuales} conceptual${promedio.conceptuales === 1 ? '' : 'es'} afuera`,
                ]
                  .filter(Boolean)
                  .join(' · ')}
          </p>
          <span className="ver">Ver todas →</span>
        </button>
      </div>

      <h2>Observaciones</h2>

      {observaciones.length === 0 ? (
        <p className="ayuda">
          Todavía no anotaste nada. Una observación es lo que pasó en una clase
          —qué entregó, qué dijo, a qué faltó—, no una etiqueta sobre el alumno.
        </p>
      ) : (
        <ul className="obs">
          {observaciones.map((o) => (
            <li key={o.id} className="observacion">
              <div className="cabecera">
                <span className="fecha">{enPalabras(o.fecha)}</span>
              </div>
              <p className="texto">{o.texto}</p>
              <button
                className="borrar"
                onClick={async () => {
                  await borrarObservacion(o.id);
                  setBorrada(o);
                }}
              >
                Borrar
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="pie">
        {borrada && (
          <div className="hecho">
            <span>Se borró la observación.</span>
            <button
              onClick={async () => {
                await restaurarObservacion(borrada);
                setBorrada(null);
              }}
            >
              Deshacer
            </button>
          </div>
        )}
        <button className="primario" onClick={() => setAnotando(true)}>
          Anotar una observación
        </button>
      </div>
    </div>
  );
}
