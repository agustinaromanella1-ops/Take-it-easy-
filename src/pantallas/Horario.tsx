import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';

import { agregarBloque, bloquesDeMateria, quitarBloque } from '../datos/bloques';
import { comoSeLlama, materia as buscarMateria } from '../datos/materias';
import type { Id } from '../datos/tipos';
import { DIAS, enMinutos, type DiaSemana } from '../fecha';
import './Horario.css';

interface Props {
  materiaId: Id;
  volver: () => void;
}

export default function Horario({ materiaId, volver }: Props) {
  const [dia, setDia] = useState<DiaSemana | null>(null);
  const [inicio, setInicio] = useState('');
  const [fin, setFin] = useState('');

  const datos = useLiveQuery(
    async () => ({
      materia: await buscarMateria(materiaId),
      bloques: await bloquesDeMateria(materiaId),
    }),
    [materiaId],
  );

  const ordenados = dia !== null && inicio !== '' && fin !== '' && enMinutos(fin) > enMinutos(inicio);

  async function agregar() {
    if (!ordenados) return;
    await agregarBloque({ materiaId, diaSemana: dia, horaInicio: inicio, horaFin: fin });
    setDia(null);
    setInicio('');
    setFin('');
  }

  if (!datos?.materia) return <div className="pantalla horario" />;

  return (
    <div className="pantalla horario">
      <div className="barra">
        <button className="atras" onClick={volver} aria-label="Volver a la materia">
          ←
        </button>
        <div>
          <h1>Horario</h1>
          <p className="subtitulo">{comoSeLlama(datos.materia)}</p>
        </div>
      </div>

      {datos.bloques.length === 0 ? (
        <p className="ayuda">
          Cargá los días y horas en que dictás esta materia. Con eso, las clases
          van a aparecer solas en Hoy.
        </p>
      ) : (
        <ul className="bloques">
          {datos.bloques.map((bloque) => (
            <li key={bloque.id}>
              <span className="dia">{DIAS[bloque.diaSemana - 1].nombre}</span>
              <span className="horas">
                {bloque.horaInicio} a {bloque.horaFin}
              </span>
              <button onClick={() => quitarBloque(bloque.id)}>Quitar</button>
            </li>
          ))}
        </ul>
      )}

      <div className="agregar">
        <p className="rotulo">Agregar un día</p>
        <div className="dias">
          {DIAS.map(({ dia: d, letra, nombre }) => (
            <button
              key={d}
              className={d === dia ? 'elegido' : undefined}
              aria-pressed={d === dia}
              aria-label={nombre}
              onClick={() => setDia(d === dia ? null : d)}
            >
              {letra}
            </button>
          ))}
        </div>

        <div className="horas-campos">
          <label>
            <span>Empieza</span>
            <input type="time" value={inicio} onChange={(e) => setInicio(e.target.value)} />
          </label>
          <label>
            <span>Termina</span>
            <input type="time" value={fin} onChange={(e) => setFin(e.target.value)} />
          </label>
        </div>

        {inicio !== '' && fin !== '' && enMinutos(fin) <= enMinutos(inicio) && (
          <p className="aviso">La hora de fin tiene que ser posterior a la de inicio.</p>
        )}
      </div>

      <div className="pie">
        <button className="primario" onClick={agregar} disabled={!ordenados}>
          Agregar al horario
        </button>
      </div>
    </div>
  );
}
