import { useState } from 'react';

import CargarAlumnos from './pantallas/CargarAlumnos';
import Hoy from './pantallas/Hoy';
import './App.css';

type Seccion = 'hoy' | 'alumnos';

export default function App() {
  const [seccion, setSeccion] = useState<Seccion>('hoy');

  return (
    <div className="app">
      {seccion === 'hoy' ? <Hoy /> : <CargarAlumnos />}

      <nav>
        <button
          className={seccion === 'hoy' ? 'activa' : undefined}
          onClick={() => setSeccion('hoy')}
        >
          Hoy
        </button>
        <button
          className={seccion === 'alumnos' ? 'activa' : undefined}
          onClick={() => setSeccion('alumnos')}
        >
          Alumnos
        </button>
      </nav>
    </div>
  );
}
