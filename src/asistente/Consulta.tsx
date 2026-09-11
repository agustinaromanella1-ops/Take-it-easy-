import './Asistente.css';

/**
 * Donde se escribe la consulta. Acá el texto todavía tiene los nombres
 * reales: es lo que la docente escribiría en un papel. Anonimizar y revisar
 * viene después, y no se puede saltear.
 */

interface Props {
  texto: string;
  escribir: (texto: string) => void;
  revisar: () => void;
  /** Mientras el borrador no terminó de cargar, avanzar perdería lo escrito. */
  listo: boolean;
  preparando: boolean;
  /** Hay algo escrito que no va a quedar guardado. */
  avisarDelBorrador: boolean;
  /** No se pudo leer la lista de alumnos, así que no hay con qué filtrar. */
  falla: boolean;
}

const EJEMPLO =
  'Tengo que hablar con la familia de un alumno que viene faltando mucho. ' +
  '¿Cómo lo planteo sin que suene a reproche?';

export default function Consulta({
  texto,
  escribir,
  revisar,
  listo,
  preparando,
  avisarDelBorrador,
  falla,
}: Props) {
  return (
    <div className="pantalla asistente">
      <header>
        <h1>Preguntale al asistente</h1>
        <p className="ayuda">
          Escribilo como se lo contarías a un colega, con nombres y todo.
          Antes de que salga del teléfono vas a ver el texto exacto que se
          envía: los nombres de tus alumnos no van.
        </p>
      </header>

      <textarea
        value={texto}
        onChange={(e) => escribir(e.target.value)}
        placeholder={EJEMPLO}
        rows={10}
      />

      {avisarDelBorrador && (
        <p className="descartado">
          Si salís de acá, el correo o el número largo no quedan guardados: la
          app no los guarda en ningún lado. Al asistente tampoco le llegan.
        </p>
      )}

      {falla && (
        <p className="bloqueo">
          No se pudo leer tu lista de alumnos, así que el filtro no tiene con
          qué comparar. Probá de nuevo.
        </p>
      )}

      <div className="pie">
        <button
          className="primario"
          onClick={revisar}
          disabled={texto.trim() === '' || !listo || preparando}
        >
          {preparando ? 'Preparando…' : 'Revisar lo que se envía'}
        </button>
      </div>
    </div>
  );
}
