import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';

import { enPalabras, hoy } from '../fecha';
import {
  asistenciaDeLaClase,
  borrarAsistencia,
  marcarAsistencia,
} from '../datos/asistencia';
import { claseDelDia } from '../datos/clases';
import { alumnosInscriptos } from '../datos/inscripciones';
import { comoSeLlama, materia as buscarMateria } from '../datos/materias';
import type { EstadoAsistencia, Id, RegistroAsistencia } from '../datos/tipos';
import './Asistencia.css';

const ESTADOS: { estado: EstadoAsistencia; letra: string; palabra: string }[] = [
  { estado: 'presente', letra: 'P', palabra: 'Presente' },
  { estado: 'ausente', letra: 'A', palabra: 'Ausente' },
  { estado: 'tarde', letra: 'T', palabra: 'Tarde' },
];

interface CambioDeshacible {
  alumnoId: Id;
  nombre: string;
  descripcion: string;
  anterior: RegistroAsistencia | undefined;
}

export default function Asistencia({ materiaId, volver }: { materiaId: Id; volver: () => void }) {
  const fecha = hoy();
  const [claseId, setClaseId] = useState<Id | null>(null);
  const [ultimo, setUltimo] = useState<CambioDeshacible | null>(null);

  useEffect(() => {
    let vigente = true;
    claseDelDia(materiaId, fecha).then((clase) => {
      if (vigente) setClaseId(clase.id);
    });
    return () => {
      vigente = false;
    };
  }, [materiaId, fecha]);

  const datos = useLiveQuery(async () => {
    if (!claseId) return undefined;
    return {
      materia: await buscarMateria(materiaId),
      alumnos: await alumnosInscriptos(materiaId),
      registros: await asistenciaDeLaClase(claseId),
    };
  }, [materiaId, claseId]);

  useEffect(() => {
    if (!ultimo) return;
    const temporizador = setTimeout(() => setUltimo(null), 6000);
    return () => clearTimeout(temporizador);
  }, [ultimo]);

  if (!datos || !claseId) {
    return <div className="pantalla asistencia" />;
  }

  const { materia, alumnos, registros } = datos;
  const porAlumno = new Map(registros.map((r) => [r.alumnoId, r]));
  const registrados = alumnos.filter((a) => porAlumno.has(a.id)).length;

  async function tocar(alumnoId: Id, nombre: string, estado: EstadoAsistencia) {
    const anterior = porAlumno.get(alumnoId);
    // Segundo toque sobre el estado ya elegido: alterna la marca de justificada.
    const repetido = anterior?.estado === estado;
    const justificada = repetido ? !anterior.justificada : false;

    await marcarAsistencia({ claseSesionId: claseId!, alumnoId, estado, justificada });

    const palabra = ESTADOS.find((e) => e.estado === estado)!.palabra.toLowerCase();
    setUltimo({
      alumnoId,
      nombre,
      descripcion: estado !== 'presente' && justificada ? `${palabra} justificada` : palabra,
      anterior,
    });
  }

  async function deshacer() {
    if (!ultimo) return;
    if (ultimo.anterior) {
      await marcarAsistencia({
        claseSesionId: claseId!,
        alumnoId: ultimo.alumnoId,
        estado: ultimo.anterior.estado,
        justificada: ultimo.anterior.justificada,
      });
    } else {
      await borrarAsistencia(claseId!, ultimo.alumnoId);
    }
    setUltimo(null);
  }

  return (
    <div className="pantalla asistencia">
      <header>
        <button className="volver" onClick={volver}>
          ← Volver a la materia
        </button>
        <h1>{materia ? comoSeLlama(materia) : 'Asistencia'}</h1>
        <p className="subtitulo">{enPalabras(fecha)}</p>
      </header>

      {alumnos.length === 0 ? (
        <section className="vacio">
          <p className="invitacion">Esta materia todavía no tiene alumnos.</p>
          <p className="detalle">
            Agregalos desde la materia y después volvé acá a tomar asistencia.
          </p>
        </section>
      ) : (
        <>
          <p className="avance">
            <b>{registrados}</b> de {alumnos.length} registrados. Lo que marcás se guarda solo.
          </p>

          <ul className="alumnos">
            {alumnos.map((alumno) => {
              const registro = porAlumno.get(alumno.id);
              return (
                <li key={alumno.id} className="alumno">
                  <div className="nombre">
                    <p className="n">
                      {alumno.apellido}, {alumno.nombre}
                    </p>
                    {registro?.justificada && <p className="just">Justificada</p>}
                  </div>
                  <div className="estados">
                    {ESTADOS.map(({ estado, letra, palabra }) => {
                      const elegido = registro?.estado === estado;
                      return (
                        <button
                          key={estado}
                          className={`op ${estado}`}
                          aria-pressed={elegido}
                          onClick={() => tocar(alumno.id, alumno.nombre, estado)}
                        >
                          {elegido && estado === 'presente' && <span className="punto" />}
                          {elegido ? palabra : letra}
                        </button>
                      );
                    })}
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {ultimo && (
        <div className="deshacer">
          <span>
            {ultimo.nombre}: {ultimo.descripcion}.
          </span>
          <button onClick={deshacer}>Deshacer</button>
        </div>
      )}
    </div>
  );
}
