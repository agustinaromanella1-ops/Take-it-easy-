import { useState } from 'react';

import './Intro.css';

const PASOS = [
  {
    titulo: 'Take It Easy',
    texto:
      'Tu agenda de bolsillo para las clases. Asistencia, notas y observaciones, en el teléfono y entre dos timbres.',
  },
  {
    titulo: 'Primero, tus materias',
    texto:
      'Cargá cada materia con el curso donde la dictás. Después le pegás la lista de alumnos y le ponés el horario semanal.',
  },
  {
    titulo: 'Hoy te muestra el día',
    texto:
      'Con el horario cargado, la pantalla Hoy arma sola las clases del día y destaca la que sigue, para tomar asistencia de un toque.',
  },
  {
    titulo: 'Todo queda en tu teléfono',
    texto:
      'Los datos de tus alumnos no salen de acá. No se piden documentos, ni direcciones, ni fotos, y nada se sube a ningún servidor.',
  },
];

export default function Intro({ terminar }: { terminar: () => void }) {
  const [paso, setPaso] = useState(0);
  const ultimo = paso === PASOS.length - 1;

  return (
    <div className="intro">
      <button className="saltear" onClick={terminar}>
        Saltear
      </button>

      <div className="contenido">
        <h1>{PASOS[paso].titulo}</h1>
        <p>{PASOS[paso].texto}</p>
      </div>

      <div className="pie">
        <div className="puntos" aria-hidden="true">
          {PASOS.map((p, i) => (
            <span key={p.titulo} className={i === paso ? 'punto actual' : 'punto'} />
          ))}
        </div>
        <button className="primario" onClick={() => (ultimo ? terminar() : setPaso(paso + 1))}>
          {ultimo ? 'Empezar' : 'Seguir'}
        </button>
      </div>
    </div>
  );
}
