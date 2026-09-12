import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';

import { enPalabras, hoy } from '../fecha';
import { CONCEPTUAL_COMUN, NUMERICA_1_10, comoSeLlamaLaEscala } from '../datos/escalas';
import { crearEvaluacion, evaluacionesDeMateria } from '../datos/evaluaciones';
import { comoSeLlama, materia as buscarMateria } from '../datos/materias';
import type { Escala, Id } from '../datos/tipos';
import './Evaluaciones.css';

interface Props {
  materiaId: Id;
  volver: () => void;
  abrir: (evaluacionId: Id) => void;
  /** Confirma en la materia, que es a donde vuelve sola después de crearla. */
  alCrear: (evaluacionId: Id, nombre: string) => void;
}

const TIPOS = ['Parcial', 'Trabajo práctico', 'Oral', 'Carpeta'];

export default function Evaluaciones({ materiaId, volver, abrir, alCrear }: Props) {
  const datos = useLiveQuery(
    async () => ({
      materia: await buscarMateria(materiaId),
      evaluaciones: await evaluacionesDeMateria(materiaId),
    }),
    [materiaId],
  );

  const [creando, setCreando] = useState(false);
  const [nombre, setNombre] = useState('');
  const [fecha, setFecha] = useState(hoy());
  const [tipo, setTipo] = useState(TIPOS[0]);
  const [escala, setEscala] = useState<Escala | null>(null);
  const [guardando, setGuardando] = useState(false);

  if (!datos?.materia) return <div className="pantalla evaluaciones" />;

  const { materia, evaluaciones } = datos;
  // Mientras no la toque, la evaluación hereda la escala de la materia.
  const laEscala = escala ?? materia.escalaPorDefecto ?? NUMERICA_1_10;

  async function crear() {
    // Sin esta guarda, el segundo toque crea una evaluación repetida.
    if (guardando || nombre.trim() === '') return;
    setGuardando(true);
    try {
      const id = await crearEvaluacion({ materiaId, nombre, fecha, tipo, escala: laEscala });
      const comoSeLlamo = nombre.trim();
      setNombre('');
      setEscala(null);
      setCreando(false);
      alCrear(id, comoSeLlamo);
    } finally {
      setGuardando(false);
    }
  }

  if (creando) {
    return (
      <div className="pantalla evaluaciones">
        <header>
          <button className="volver" onClick={() => setCreando(false)}>
            ← Volver
          </button>
          <h1>Nueva evaluación</h1>
        </header>

        <label>
          <span>Nombre</span>
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Parcial 1"
            autoFocus
          />
        </label>

        <label>
          <span>Fecha</span>
          <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </label>

        <fieldset>
          <legend>Tipo</legend>
          <div className="opciones">
            {TIPOS.map((t) => (
              <button
                key={t}
                className={t === tipo ? 'elegida' : undefined}
                onClick={() => setTipo(t)}
              >
                {t}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend>Cómo se califica</legend>
          <div className="opciones">
            <button
              className={laEscala.tipo === 'numerica' ? 'elegida' : undefined}
              onClick={() => setEscala(NUMERICA_1_10)}
            >
              Con nota
            </button>
            <button
              className={laEscala.tipo === 'conceptual' ? 'elegida' : undefined}
              onClick={() => setEscala(CONCEPTUAL_COMUN)}
            >
              Conceptual
            </button>
          </div>
          <p className="detalle">{comoSeLlamaLaEscala(laEscala)}</p>
        </fieldset>

        <div className="pie">
          <button
            className="primario"
            onClick={crear}
            disabled={nombre.trim() === '' || guardando}
          >
            Crear evaluación
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="pantalla evaluaciones">
      <header>
        <button className="volver" onClick={volver}>
          ← {comoSeLlama(materia)}
        </button>
        <h1>Evaluaciones</h1>
      </header>

      {evaluaciones.length === 0 ? (
        <section className="vacio">
          <p className="invitacion">Todavía no cargaste ninguna evaluación.</p>
          <p className="detalle">
            Una evaluación es un parcial, un trabajo práctico, un oral: algo que
            se corrige una vez y le pone nota a todo el curso.
          </p>
        </section>
      ) : (
        <ul className="lista">
          {evaluaciones.map((e) => (
            <li key={e.id}>
              <button onClick={() => abrir(e.id)}>
                <span className="nombre">{e.nombre}</span>
                <span className="detalle">
                  {e.tipo} · {enPalabras(e.fecha)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="pie">
        <button className="primario" onClick={() => setCreando(true)}>
          Nueva evaluación
        </button>
      </div>
    </div>
  );
}
