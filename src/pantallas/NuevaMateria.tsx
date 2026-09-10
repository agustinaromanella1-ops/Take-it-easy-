import { useLiveQuery } from 'dexie-react-hooks';

import { db } from '../datos/db';
import { crearMateria } from '../datos/materias';
import type { ColorPastel } from '../datos/tipos';
import { useBorrador } from '../hooks/useBorrador';
import './Materias.css';

const COLORES: ColorPastel[] = ['lila', 'rosa', 'durazno', 'celeste', 'noche'];

interface Formulario {
  nombre: string;
  anio: string;
  division: string;
  escuela: string;
  color: ColorPastel;
}

const VACIO: Formulario = { nombre: '', anio: '', division: '', escuela: '', color: 'lila' };

export default function NuevaMateria({ volver }: { volver: () => void }) {
  const { valor, setValor, limpiar, listo } = useBorrador<Formulario>('materia-nueva', VACIO);
  const escuelas = useLiveQuery(() => db.escuelas.toArray(), [], []);

  function cambiar<C extends keyof Formulario>(campo: C, nuevo: Formulario[C]) {
    setValor((previo) => ({ ...previo, [campo]: nuevo }));
  }

  const completo =
    valor.nombre.trim() !== '' && valor.anio.trim() !== '' && valor.division.trim() !== '';

  async function guardar() {
    await crearMateria({
      nombre: valor.nombre,
      anio: valor.anio,
      division: valor.division,
      escuela: valor.escuela,
      colorPastel: valor.color,
    });
    limpiar();
    volver();
  }

  return (
    <div className="pantalla materias">
      <header>
        <button className="volver" onClick={volver}>
          ← Materias
        </button>
        <h1>Nueva materia</h1>
      </header>

      <div className="formulario">
        <label>
          <span>Materia</span>
          <input
            value={valor.nombre}
            onChange={(e) => cambiar('nombre', e.target.value)}
            placeholder="Historia"
          />
        </label>

        <div className="fila-campos">
          <label>
            <span>Año</span>
            <input
              value={valor.anio}
              onChange={(e) => cambiar('anio', e.target.value)}
              placeholder="4"
              inputMode="numeric"
            />
          </label>
          <label>
            <span>División</span>
            <input
              value={valor.division}
              onChange={(e) => cambiar('division', e.target.value)}
              placeholder="A"
            />
          </label>
        </div>

        <label>
          <span>Escuela</span>
          <input
            value={valor.escuela}
            onChange={(e) => cambiar('escuela', e.target.value)}
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
                className={`color ${c} ${c === valor.color ? 'elegido' : ''}`}
                aria-pressed={c === valor.color}
                onClick={() => cambiar('color', c)}
              >
                {c === valor.color ? 'Elegido' : ''}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="pie">
        <button className="primario" onClick={guardar} disabled={!completo || !listo}>
          Crear materia
        </button>
      </div>
    </div>
  );
}
