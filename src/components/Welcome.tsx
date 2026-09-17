import { useEffect, useState } from 'react';

/**
 * Pantalla de bienvenida de Pipí Cucú.
 *
 * Reproduce el diseño aprobado (`src/assets/pipi-cucu-welcome-reference.png`).
 * Los colores salen muestreados de ese archivo y las posiciones de medirlo
 * pixel a pixel, no de estimarlas a ojo: cada pieza se ubica dentro de un
 * "escenario" con la misma proporción que la referencia (941 × 1671), así la
 * composición entera escala junta y conserva el diseño en cualquier pantalla.
 *
 * Las nubes son las del propio diseño, extraídas a una capa aparte con su
 * textura de crayón intacta. El perro es el GIF aprobado tal cual, sin filtros
 * ni recortes.
 */
const CLAVE_VISTA = 'pipicucu:bienvenida-vista';

/**
 * Cuánto se queda la portada en los arranques siguientes al primero.
 *
 * Corta a propósito: es un saludo, no una puerta. Una app de trabajo se abre
 * varias veces por día y lo que al principio es encanto se vuelve una demora.
 */
const SALUDO_MS = 1700;

/** Si ya se pasó por la bienvenida. Se muestra solo la primera vez. */
export function bienvenidaPendiente(): boolean {
  try {
    return localStorage.getItem(CLAVE_VISTA) === null;
  } catch {
    // Sin almacenamiento disponible se muestra igual: es preferible repetirla
    // a que nunca aparezca.
    return true;
  }
}

function marcarVista(): void {
  try {
    localStorage.setItem(CLAVE_VISTA, '1');
  } catch {
    /* Sin almacenamiento, la bienvenida volverá a aparecer. No es grave. */
  }
}

/**
 * La gota celeste que en el diseño hace de tilde. Va en SVG y no con
 * border-radius porque la punta es un afinado, no una esquina: con bordes
 * redondeados queda un rectángulo con una punta cortada.
 */
function Gota() {
  return (
    <svg className="wm-gota" viewBox="0 0 100 108" aria-hidden="true" focusable="false">
      <path d="M6 102 C26 74 20 42 40 18 C62 -6 100 8 97 44 C94 78 52 98 6 102 Z" />
    </svg>
  );
}

export function Welcome({ primeraVez, onEmpezar }: { primeraVez: boolean; onEmpezar: () => void }) {
  const [saliendo, setSaliendo] = useState(false);

  // La primera vez se queda hasta que la persona toque Empezar: es cuando hay
  // algo para leer. Después es un saludo al pasar y se va sola.
  useEffect(() => {
    if (primeraVez) return;
    const reloj = window.setTimeout(() => {
      marcarVista();
      onEmpezar();
    }, SALUDO_MS);
    return () => window.clearTimeout(reloj);
  }, [primeraVez, onEmpezar]);

  function pasar() {
    if (saliendo) return;
    setSaliendo(true);
    marcarVista();
    onEmpezar();
  }

  return (
    <div
      className="welcome"
      // Tocar en cualquier lado la saltea. Quien ya la vio cien veces no tiene
      // por qué apuntarle al botón.
      onClick={primeraVez ? undefined : pasar}
    >
      {/* Las nubes van detrás de todo y no reciben eventos, así nunca tapan ni
          bloquean un control. */}
      <div className="welcome-clouds" aria-hidden="true" />

      <div className="welcome-stage">
        <p className="welcome-kicker">Organización para profesionales</p>

        {/* En la referencia las gotas celestes SON las tildes: la última i va
            sin punto (por eso la ı sin punto, que es la letra que lleva debajo
            cualquier í) y no hay acento tipográfico. Cada gota cuelga de su
            letra en vez de estar clavada en la pantalla, así acompaña al texto
            cuando cambia el tamaño. El nombre bien escrito viaja en aria-label,
            que es lo que anuncia el lector de pantalla. */}
        <h1 className="welcome-wordmark" aria-label="Pipí Cucú">
          <span className="wm-pipi" aria-hidden="true">
            Pip<span className="wm-letra">ı<Gota /></span>
          </span>
          <span className="wm-cucu" aria-hidden="true">
            Cuc<span className="wm-letra">u<Gota /></span>
          </span>
        </h1>

        <p className="welcome-tagline">Tu agenda, pipí cucú.</p>

        <img
          className="welcome-dog"
          src="/pipi-cucu-dog-flying.gif"
          alt="Perro salchicha volando"
          width={483}
          height={177}
          decoding="async"
        />

        <button type="button" className="welcome-cta" onClick={pasar}>
          Empezar
        </button>
      </div>
    </div>
  );
}
