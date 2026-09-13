import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';

import { enPalabras, hoy } from '../fecha';
import { CONCEPTUAL_COMUN, NUMERICA_1_10, comoSeLlamaLaEscala } from '../datos/escalas';
import { crearEvaluacion, evaluacionesDeMateria } from '../datos/evaluaciones';
import { comoSeLlama, materia as buscarMateria } from '../datos/materias';
import { planillaDeNotas } from '../datos/planilla';
import { guardarArchivo } from '../nativo/archivos';
import {
  TIPOS_DE_FABRICA,
  olvidarTipo,
  recordarTipo,
  seLlamanIgual,
  tiposPropios,
  todosLosTipos,
} from '../datos/tiposDeEvaluacion';
import Pista from '../instructivo/Pista';
import { usePista } from '../instructivo/useInstructivo';
import type { Escala, Id } from '../datos/tipos';
import './Evaluaciones.css';

interface Props {
  materiaId: Id;
  volver: () => void;
  abrir: (evaluacionId: Id) => void;
  /** Confirma en la materia, que es a donde vuelve sola después de crearla. */
  alCrear: (evaluacionId: Id, nombre: string) => void;
}

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
  const [tipo, setTipo] = useState(TIPOS_DE_FABRICA[0]);
  // Los que escribió ella alguna vez. Se leen una sola vez al abrir la
  // pantalla y se actualizan al guardar uno nuevo.
  const [propios, setPropios] = useState<string[]>([]);
  const [exportando, setExportando] = useState(false);
  const [sinNada, setSinNada] = useState(false);
  const [escribiendoTipo, setEscribiendoTipo] = useState(false);
  const [tipoNuevo, setTipoNuevo] = useState('');

  useEffect(() => {
    let vigente = true;
    void tiposPropios().then((guardados) => {
      if (vigente) setPropios(guardados);
    });
    return () => {
      vigente = false;
    };
  }, []);
  const [escala, setEscala] = useState<Escala | null>(null);
  const [guardando, setGuardando] = useState(false);
  const previas = usePista('notas-de-antes', datos !== undefined);
  const escalas = usePista('con-nota-o-conceptual', true);

  if (!datos?.materia) return <div className="pantalla evaluaciones" />;

  const { materia, evaluaciones } = datos;
  // Mientras no la toque, la evaluación hereda la escala de la materia.
  const laEscala = escala ?? materia.escalaPorDefecto ?? NUMERICA_1_10;

  async function crear() {
    // Sin esta guarda, el segundo toque crea una evaluación repetida.
    if (guardando || nombre.trim() === '' || tipo.trim() === '') return;
    setGuardando(true);
    try {
      const id = await crearEvaluacion({ materiaId, nombre, fecha, tipo, escala: laEscala });
      setPropios(await recordarTipo(tipo));
      const comoSeLlamo = nombre.trim();
      setNombre('');
      setEscala(null);
      setEscribiendoTipo(false);
      setTipoNuevo('');
      setCreando(false);
      alCrear(id, comoSeLlamo);
    } finally {
      setGuardando(false);
    }
  }

  /**
   * La planilla sale por el menú de compartir: tiene nombres de alumnos, así
   * que el destino lo elige ella y la app no la deja en ninguna carpeta fija.
   */
  async function exportar() {
    if (exportando) return;
    setExportando(true);
    setSinNada(false);
    try {
      const planilla = await planillaDeNotas(materiaId);
      if (planilla.alumnos === 0) {
        setSinNada(true);
        return;
      }
      await guardarArchivo(planilla.nombreDeArchivo, planilla.contenido, 'text/csv');
    } finally {
      setExportando(false);
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
            {todosLosTipos(propios).map((t) => (
              <button
                key={t}
                className={seLlamanIgual(t, tipo) && !escribiendoTipo ? 'elegida' : undefined}
                onClick={() => {
                  setTipo(t);
                  setEscribiendoTipo(false);
                }}
              >
                {t}
              </button>
            ))}
            <button
              className={escribiendoTipo ? 'elegida' : undefined}
              onClick={() => {
                setEscribiendoTipo(true);
                setTipo(tipoNuevo);
              }}
            >
              Otro…
            </button>
          </div>

          {escribiendoTipo && (
            <>
              <input
                className="tipo-propio"
                value={tipoNuevo}
                onChange={(e) => {
                  setTipoNuevo(e.target.value);
                  setTipo(e.target.value);
                }}
                placeholder="Coloquio"
                aria-label="Cómo se llama este tipo"
                autoFocus
              />
              <p className="detalle">
                Queda guardado y la próxima vez lo vas a tener entre los de
                arriba.
              </p>
            </>
          )}

          {propios.length > 0 && !escribiendoTipo && (
            <p className="detalle">
              Los que agregaste vos se pueden sacar:{' '}
              {propios.map((t) => (
                <button
                  key={t}
                  className="sacar-tipo"
                  onClick={async () => {
                    const quedan = await olvidarTipo(t);
                    setPropios(quedan);
                    if (seLlamanIgual(tipo, t)) setTipo(TIPOS_DE_FABRICA[0]);
                  }}
                >
                  {t} ✕
                </button>
              ))}
            </p>
          )}
        </fieldset>

        {escalas.mostrarPista && (
          <Pista
            onEntendido={escalas.entendido}
            texto={
              <>
                <p>
                  <strong>Con nota o conceptual</strong>, como la hayas tomado.
                  Cada evaluación se guarda con su escala, así que podés
                  mezclarlas en la misma materia.
                </p>
                <p>
                  Las conceptuales no entran en el promedio: promediar «En
                  proceso» y «Logrado» inventa una distancia que nadie definió.
                  Se cuentan aparte.
                </p>
              </>
            }
          />
        )}

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
            disabled={nombre.trim() === '' || tipo.trim() === '' || guardando}
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

      {sinNada && (
        <p className="aviso">
          Esta materia todavía no tiene alumnos, así que la planilla saldría
          vacía. Cargá la lista del curso primero.
        </p>
      )}

      <div className="pie">
        {previas.mostrarPista && (
          <Pista
            onEntendido={previas.entendido}
            texto={
              <>
                <p>
                  <strong>Las notas de antes también entran.</strong> Si ya
                  tomaste evaluaciones este año, cargalas con la fecha del día
                  en que las tomaste: se ordenan solas y cuentan en el promedio.
                </p>
              </>
            }
          />
        )}
        <button className="primario" onClick={() => setCreando(true)}>
          Nueva evaluación
        </button>
        {evaluaciones.length > 0 && (
          <button className="secundario" onClick={exportar} disabled={exportando}>
            {exportando ? 'Armando la planilla…' : 'Exportar las notas'}
          </button>
        )}
      </div>
    </div>
  );
}
