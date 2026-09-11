import { useCallback, useEffect, useRef, useState } from 'react';

import Asistente from './asistente/Asistente';
import { escucharBotonAtras } from './nativo/botonAtras';
import Intro from './instructivo/Intro';
import { useIntro } from './instructivo/useInstructivo';
import type { Id } from './datos/tipos';
import Ajustes from './pantallas/Ajustes';
import Asistencia from './pantallas/Asistencia';
import CargarAlumnos from './pantallas/CargarAlumnos';
import Horario from './pantallas/Horario';
import Hoy from './pantallas/Hoy';
import Materia from './pantallas/Materia';
import Materias from './pantallas/Materias';
import NuevaMateria from './pantallas/NuevaMateria';
import './App.css';

type Pantalla =
  | { nombre: 'hoy' }
  | { nombre: 'materias' }
  | { nombre: 'ajustes' }
  | { nombre: 'asistente' }
  | { nombre: 'materia-nueva' }
  | { nombre: 'materia'; materiaId: Id }
  | { nombre: 'alumnos'; materiaId: Id }
  | { nombre: 'horario'; materiaId: Id }
  | { nombre: 'asistencia'; materiaId: Id; bloqueHorarioId?: Id };

export default function App() {
  const [pila, setPila] = useState<Pantalla[]>([{ nombre: 'hoy' }]);
  const { mostrarIntro, terminarIntro, volverAMostrar } = useIntro();
  const [reciencreada, setReciencreada] = useState<{ id: Id; nombre: string } | undefined>();
  const olvidarReciencreada = useCallback(() => setReciencreada(undefined), []);
  const actual = pila[pila.length - 1];

  // El listener del botón atrás se registra una sola vez, así que no puede
  // leer `pila` por closure: necesita la pila de ahora, no la del montaje.
  const pilaRef = useRef(pila);
  useEffect(() => {
    pilaRef.current = pila;
  }, [pila]);

  const ir = useCallback((pantalla: Pantalla) => setPila((p) => [...p, pantalla]), []);

  const volver = useCallback(() => {
    if (pilaRef.current.length <= 1) return false;
    setPila((p) => p.slice(0, -1));
    return true;
  }, []);

  // Vuelve por la pila; sólo cierra la app cuando ya no queda a dónde volver.
  useEffect(() => escucharBotonAtras(volver), [volver]);

  type Seccion = 'hoy' | 'materias' | 'asistente' | 'ajustes';

  function seccion(nombre: Seccion) {
    setPila([{ nombre }]);
  }

  // Todo lo que cuelga de materias —una materia, sus alumnos, su horario, la
  // asistencia— sigue siendo la sección materias mientras se navega adentro.
  const seccionActual: Seccion =
    actual.nombre === 'hoy' || actual.nombre === 'asistente' || actual.nombre === 'ajustes'
      ? actual.nombre
      : 'materias';

  if (mostrarIntro) return <Intro terminar={terminarIntro} />;

  return (
    <div className="app">
      {actual.nombre === 'hoy' && (
        <Hoy
          tomarAsistencia={(materiaId, bloqueHorarioId) =>
            ir({ nombre: 'asistencia', materiaId, bloqueHorarioId })
          }
          irAMaterias={() => seccion('materias')}
        />
      )}

      {actual.nombre === 'materias' && (
        <Materias
          abrir={(materiaId) => ir({ nombre: 'materia', materiaId })}
          crear={() => ir({ nombre: 'materia-nueva' })}
          reciencreada={reciencreada}
          olvidarReciencreada={olvidarReciencreada}
        />
      )}

      {actual.nombre === 'materia-nueva' && (
        <NuevaMateria
          volver={volver}
          alCrear={(id, nombre) => setReciencreada({ id, nombre })}
        />
      )}

      {actual.nombre === 'asistente' && <Asistente />}

      {actual.nombre === 'ajustes' && (
        <Ajustes verInstructivo={volverAMostrar} />
      )}

      {actual.nombre === 'materia' && (
        <Materia
          materiaId={actual.materiaId}
          volver={volver}
          agregarAlumnos={() => ir({ nombre: 'alumnos', materiaId: actual.materiaId })}
          editarHorario={() => ir({ nombre: 'horario', materiaId: actual.materiaId })}
          tomarAsistencia={() => ir({ nombre: 'asistencia', materiaId: actual.materiaId })}
        />
      )}

      {actual.nombre === 'alumnos' && (
        <CargarAlumnos materiaId={actual.materiaId} volver={volver} />
      )}

      {actual.nombre === 'horario' && (
        <Horario materiaId={actual.materiaId} volver={volver} />
      )}

      {actual.nombre === 'asistencia' && (
        <Asistencia
          materiaId={actual.materiaId}
          bloqueHorarioId={actual.bloqueHorarioId}
          volver={volver}
        />
      )}

      <nav>
        {(
          [
            ['hoy', 'Hoy'],
            ['materias', 'Materias'],
            ['asistente', 'Asistente'],
            ['ajustes', 'Ajustes'],
          ] as const
        ).map(([nombre, etiqueta]) => (
          <button
            key={nombre}
            className={seccionActual === nombre ? 'activa' : undefined}
            onClick={() => seccion(nombre)}
          >
            {etiqueta}
          </button>
        ))}
      </nav>
    </div>
  );
}
