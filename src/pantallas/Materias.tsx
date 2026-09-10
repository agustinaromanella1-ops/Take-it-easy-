import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';

import { db } from '../datos/db';
import { comoSeLlama, crearMateria, todasLasMaterias } from '../datos/materias';
import type { ColorPastel, Id } from '../datos/tipos';
import './Materias.css';

const COLORES: ColorPastel[] = ['lila', 'rosa', 'durazno', 'celeste', 'noche'];

export default function Materias({ abrir }: { abrir: (materiaId: Id) => void }) {
  const [creando, setCreando] = useState(false);
  const [nombre, setNombre] = useState('');
  const [anio, setAnio] = useState('');
  const [division, setDivision] = useState('');
  const [escuela, setEscuela] = useState('');
  const [color, setColor] = useState<ColorPastel>('lila');

  const materias = useLiveQuery(todasLasMaterias, [], []);
  const escuelas = useLiveQuery(() => db.escuelas.toArray(), [], []);
  const inscripciones = useLiveQuery(() => db.inscripciones.toArray(), [], []);

  const completo = nombre.trim() !== '' && anio.trim() !== '' && division.trim() !== '';

  async function guardar() {
    await crearMateria({ nombre, anio, division, escuela, colorPastel: color });
    setNombre('');
    setAnio('');
    setDivision('');
    setColor(COLORES[(COLORES.indexOf(color) + 1) % COLORES.length]);
    setCreando(false);
  }

  if (creando) {
    return (
      <div className="pantalla materias">
        <header>
          <button className="volver" onClick={() => setCreando(false)}>
            ← Volver
          </button>
          <h1>Nueva materia</h1>
        </header>

        <div className="formulario">
          <label>
            <span>Materia</span>
            <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Historia" />
          </label>

          <div className="fila-campos">
            <label>
              <span>Año</span>
              <input value={anio} onChange={(e) => setAnio(e.target.value)} placeholder="4" inputMode="numeric" />
            </label>
            <label>
              <span>División</span>
              <input value={division} onChange={(e) => setDivision(e.target.value)} placeholder="A" />
            </label>
          </div>

          <label>
            <span>Escuela</span>
            <input
              value={escuela}
              onChange={(e) => setEscuela(e.target.value)}
              placeholder="Escuela N.º 12"
              list="escuelas-conocidas"
            />
            <datalist id="escuelas-conocidas">
              {escuelas.map((e) => (
                <option key={e.id} value={e.nombre} />
              ))}
            </datalist>
          </label>

          <div className="colores">
            <span>Color</span>
            <div>
              {COLORES.map((c) => (
                <button
                  key={c}
                  className={`color ${c} ${c === color ? 'elegido' : ''}`}
                  aria-pressed={c === color}
                  onClick={() => setColor(c)}
                >
                  {c === color ? 'Elegido' : ''}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="pie">
          <button className="primario" onClick={guardar} disabled={!completo}>
            Crear materia
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="pantalla materias">
      <header>
        <h1>Materias</h1>
      </header>

      {materias.length === 0 ? (
        <section className="vacio">
          <p className="invitacion">Todavía no cargaste ninguna materia.</p>
          <p className="detalle">
            Cargá la primera con el curso donde la dictás, y después le agregás
            los alumnos.
          </p>
        </section>
      ) : (
        <ul className="lista">
          {materias.map((m) => {
            const cuantos = inscripciones.filter(
              (i) => i.materiaId === m.id && i.estado === 'activa',
            ).length;
            return (
              <li key={m.id}>
                <button className={`materia ${m.colorPastel}`} onClick={() => abrir(m.id)}>
                  <span className="titulo">{comoSeLlama(m)}</span>
                  <span className="detalle">
                    {cuantos === 0
                      ? 'Sin alumnos todavía'
                      : `${cuantos} ${cuantos === 1 ? 'alumno' : 'alumnos'}`}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="pie">
        <button className="primario" onClick={() => setCreando(true)}>
          Crear materia
        </button>
      </div>
    </div>
  );
}
