import { useCallback, useEffect, useRef, useState } from 'react';

import { escucharBotonAtras } from './nativo/botonAtras';
import type { Id } from './datos/tipos';
import Asistencia from './pantallas/Asistencia';
import CargarAlumnos from './pantallas/CargarAlumnos';
import Hoy from './pantallas/Hoy';
import Materia from './pantallas/Materia';
import Materias from './pantallas/Materias';
import './App.css';

type Pantalla =
  | { nombre: 'hoy' }
  | { nombre: 'materias' }
  | { nombre: 'materia'; materiaId: Id }
  | { nombre: 'alumnos'; materiaId: Id }
  | { nombre: 'asistencia'; materiaId: Id };

export default function App() {
  const [pila, setPila] = useState<Pantalla[]>([{ nombre: 'hoy' }]);
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

  function seccion(nombre: 'hoy' | 'materias') {
    setPila([{ nombre }]);
  }

  const enHoy = actual.nombre === 'hoy';

  return (
    <div className="app">
      {actual.nombre === 'hoy' && <Hoy />}

      {actual.nombre === 'materias' && (
        <Materias abrir={(materiaId) => ir({ nombre: 'materia', materiaId })} />
      )}

      {actual.nombre === 'materia' && (
        <Materia
          materiaId={actual.materiaId}
          volver={volver}
          agregarAlumnos={() => ir({ nombre: 'alumnos', materiaId: actual.materiaId })}
          tomarAsistencia={() => ir({ nombre: 'asistencia', materiaId: actual.materiaId })}
        />
      )}

      {actual.nombre === 'alumnos' && (
        <CargarAlumnos materiaId={actual.materiaId} volver={volver} />
      )}

      {actual.nombre === 'asistencia' && (
        <Asistencia materiaId={actual.materiaId} volver={volver} />
      )}

      <nav>
        <button className={enHoy ? 'activa' : undefined} onClick={() => seccion('hoy')}>
          Hoy
        </button>
        <button className={enHoy ? undefined : 'activa'} onClick={() => seccion('materias')}>
          Materias
        </button>
      </nav>
    </div>
  );
}
