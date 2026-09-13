import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';

import { enPalabras, hoy } from '../fecha';
import { ponerRecordatorio, sacarRecordatorio, apagarNotificaciones } from '../agenda/recordatorios';
import {
  RecordatorioInvalidoError,
  borrarEntrada,
  crearEntrada,
  entradasDesde,
  recordatoriosDe,
} from '../datos/agenda';
import { db } from '../datos/db';
import { comoSeLlama, materiasActivas } from '../datos/materias';
import type { EntradaAgenda, Id, Recordatorio } from '../datos/tipos';
import { hayNotificaciones, pedirPermiso, tenemosPermiso } from '../nativo/notificaciones';
import './Agenda.css';

/**
 * Lo que viene: qué llevar, qué devolver, qué dar en cada clase. Con un
 * recordatorio opcional, que es una notificación del teléfono.
 *
 * Lo que se escribe acá no aparece en la pantalla bloqueada. La notificación
 * dice la materia y nada más (1.5).
 */

interface Props {
  irAMaterias: () => void;
}

interface Fila {
  entrada: EntradaAgenda;
  materia?: string;
  recordatorios: Recordatorio[];
}

/** "2026-09-15T07:30", que es lo que entiende el input de fecha y hora. */
function aLaManana(fecha: string): string {
  return `${fecha}T07:30`;
}

function comoSeLeeLaHora(fechaHoraLocal: string): string {
  const [fecha, hora] = fechaHoraLocal.split('T');
  return `${enPalabras(fecha)} a las ${hora}`;
}

export default function Agenda({ irAMaterias }: Props) {
  const datos = useLiveQuery(async () => {
    const entradas = await entradasDesde(hoy());
    const materias = await materiasActivas();
    const filas: Fila[] = [];
    for (const entrada of entradas) {
      filas.push({
        entrada,
        materia: (() => {
          const m = materias.find((x) => x.id === entrada.materiaId);
          return m ? comoSeLlama(m) : undefined;
        })(),
        recordatorios: (await recordatoriosDe(entrada.id)).filter((r) => r.estado === 'programado'),
      });
    }
    return { filas, materias };
  }, []);

  const [anotando, setAnotando] = useState(false);
  const [titulo, setTitulo] = useState('');
  const [detalle, setDetalle] = useState('');
  const [fecha, setFecha] = useState(hoy());
  const [materiaId, setMateriaId] = useState<Id | ''>('');
  const [conAviso, setConAviso] = useState(false);
  const [cuando, setCuando] = useState(aLaManana(hoy()));
  const [guardando, setGuardando] = useState(false);
  const [sinPermiso, setSinPermiso] = useState(false);
  const [avisoPasado, setAvisoPasado] = useState(false);

  if (!datos) return <div className="pantalla agenda" />;

  const { filas, materias } = datos;

  function empezar() {
    setTitulo('');
    setDetalle('');
    setFecha(hoy());
    setMateriaId('');
    setConAviso(false);
    setCuando(aLaManana(hoy()));
    setSinPermiso(false);
    setAvisoPasado(false);
    setAnotando(true);
  }

  /**
   * El aviso acompaña al día de la entrada. Sin esto quedaba fechado hoy
   * aunque la entrada fuera de la semana que viene, y un aviso de hoy a las
   * 7:30, a las diez de la mañana, ya pasó: no suena nunca.
   */
  function cambiarFecha(nueva: string) {
    const hora = cuando.split('T')[1] ?? '07:30';
    setFecha(nueva);
    setCuando(`${nueva}T${hora}`);
  }

  async function guardar() {
    // Sin esta guarda, el segundo toque anota la entrada dos veces.
    if (guardando || titulo.trim() === '') return;
    setGuardando(true);
    try {
      const id = await crearEntrada({
        materiaId: materiaId || undefined,
        fecha,
        titulo,
        detalle,
      });

      if (conAviso) {
        const entrada = await db.entradasAgenda.get(id);
        if (entrada) await ponerRecordatorio(entrada, cuando);
      }
      setAnotando(false);
    } catch (e) {
      // La entrada ya quedó guardada: lo único que falló es el aviso, y se
      // dice acá en vez de perder lo escrito.
      if (e instanceof RecordatorioInvalidoError) setAvisoPasado(true);
      else throw e;
    } finally {
      setGuardando(false);
    }
  }

  async function prenderAviso(prendido: boolean) {
    setConAviso(prendido);
    if (!prendido || !hayNotificaciones()) return;
    // Pedir el permiso al prenderlo y no al guardar: si lo rechaza, se entera
    // ahora y no después de haber escrito todo.
    const hay = (await tenemosPermiso()) || (await pedirPermiso());
    setSinPermiso(!hay);
    if (!hay) setConAviso(false);
  }

  if (anotando) {
    return (
      <div className="pantalla agenda">
        <header>
          <button className="volver" onClick={() => setAnotando(false)}>
            ← Volver
          </button>
          <h1>Anotar en la agenda</h1>
        </header>

        <label>
          <span>Qué</span>
          <input
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Llevar los mapas"
            autoFocus
          />
        </label>

        <label>
          <span>Cuándo</span>
          <input type="date" value={fecha} onChange={(e) => cambiarFecha(e.target.value)} />
        </label>

        <label>
          <span>Materia (opcional)</span>
          <select value={materiaId} onChange={(e) => setMateriaId(e.target.value)}>
            <option value="">Ninguna</option>
            {materias.map((m) => (
              <option key={m.id} value={m.id}>
                {comoSeLlama(m)}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>Detalle (opcional)</span>
          <textarea
            value={detalle}
            onChange={(e) => setDetalle(e.target.value)}
            rows={3}
            placeholder="Los de América, están en el armario del fondo."
          />
        </label>

        <section className="aviso">
          <label className="interruptor">
            <input
              type="checkbox"
              checked={conAviso}
              onChange={(e) => void prenderAviso(e.target.checked)}
            />
            <span>Avisarme</span>
          </label>

          {conAviso && (
            <>
              <input
                type="datetime-local"
                value={cuando}
                onChange={(e) => setCuando(e.target.value)}
              />
              <p className="detalle">
                El aviso dice la materia y nada más. Lo que escribiste no
                aparece en la pantalla bloqueada, donde lo puede leer cualquiera
                que esté cerca.
              </p>
              <p className="detalle">
                Puede llegar unos minutos más tarde: la app no pide el permiso
                de alarma exacta de Android, que obligaría a darte de alta en una
                pantalla de ajustes del sistema.
              </p>
            </>
          )}

          {avisoPasado && (
            <p className="bloqueo">
              Ese momento ya pasó, así que el aviso no sonaría. La entrada quedó
              guardada igual: elegí una hora que venga y volvé a intentar.
            </p>
          )}

          {sinPermiso && (
            <p className="bloqueo">
              Android no dio permiso para avisarte. La entrada se guarda igual,
              y la vas a ver acá.
            </p>
          )}

          {!hayNotificaciones() && conAviso && (
            <p className="bloqueo">
              En el navegador no hay avisos: esto anda en el teléfono.
            </p>
          )}
        </section>

        <div className="pie">
          <button
            className="primario"
            onClick={guardar}
            disabled={titulo.trim() === '' || guardando}
          >
            Guardar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="pantalla agenda">
      <header>
        <h1>Agenda</h1>
        <p className="ayuda">Lo que viene: qué llevar, qué devolver, qué dar.</p>
      </header>

      {filas.length === 0 ? (
        <section className="vacio">
          <p className="invitacion">No tenés nada anotado de acá en adelante.</p>
          <p className="detalle">
            Sirve para lo que se olvida entre el aula y la casa: llevar un
            material, devolver unos trabajos, arrancar un tema.
          </p>
          {materias.length === 0 && (
            <button className="secundario" onClick={irAMaterias}>
              Cargar una materia primero
            </button>
          )}
        </section>
      ) : (
        <ul className="entradas">
          {filas.map(({ entrada, materia, recordatorios }) => (
            <li key={entrada.id}>
              <div className="cabecera">
                <span className="fecha">{enPalabras(entrada.fecha)}</span>
                {materia && <span className="materia">{materia}</span>}
              </div>
              <p className="titulo">{entrada.titulo}</p>
              {entrada.detalle && <p className="detalle">{entrada.detalle}</p>}

              {recordatorios.map((r) => (
                <div key={r.id} className="recordatorio">
                  <span>Aviso: {comoSeLeeLaHora(r.fechaHoraLocal)}</span>
                  <button onClick={() => void sacarRecordatorio(r.id)}>Sacar</button>
                </div>
              ))}

              <button
                className="borrar"
                onClick={async () => apagarNotificaciones(await borrarEntrada(entrada.id))}
              >
                Borrar
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="pie">
        <button className="primario" onClick={empezar}>
          Anotar algo
        </button>
      </div>
    </div>
  );
}
