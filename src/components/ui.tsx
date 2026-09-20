import { useEffect, useRef, type ReactNode } from 'react';

/**
 * Encabezado de sección: el título va afuera de la tarjeta, con su acción a la
 * derecha. Da la jerarquía de la app original, donde cada bloque se anuncia
 * antes de mostrarse.
 */
export function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="section">
      <div className="section-head">
        <h2>{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Card({ title, action, children }: { title?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="card">
      {(title || action) && (
        <div className="card-title">
          {title ? <h2>{title}</h2> : <span />}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Stat({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: 'ok' | 'warn' | 'danger';
}) {
  return (
    <div className="stat">
      <div className="stat-label">{label}</div>
      <div className={`stat-value${tone ? ` ${tone}` : ''}`}>{value}</div>
      {hint && <div className="stat-hint">{hint}</div>}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="empty">{children}</p>;
}

/**
 * Un campo con su etiqueta.
 *
 * La caja es un `<label>` y el control va ADENTRO. Antes era un `<div>` con la
 * etiqueta al lado: se veía igual, pero para un lector de pantalla el control
 * quedaba sin nombre —"cuadro combinado", sin decir de qué— porque nada los
 * ataba. Anidarlo los ata sin necesidad de inventar un `id` por campo, y de
 * paso tocar la etiqueta enfoca el control.
 */
export function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string | undefined;
  children: ReactNode;
}) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {error && <span className="error-text">{error}</span>}
    </label>
  );
}

/**
 * Modal accesible: cierra con Escape, bloquea el scroll del fondo y devuelve el
 * foco al elemento que lo abrió (si no, el foco queda perdido arriba de todo y
 * la navegación por teclado se vuelve inusable).
 */
/** Lo que puede recibir el foco adentro de un cuadro. */
const SELECTOR_FOCOABLE =
  'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])';

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);

  /**
   * `onClose` llega casi siempre como una función escrita en el JSX, así que es
   * una función distinta en cada render. Guardarla en una ref permite que el
   * efecto de abajo se monte UNA vez y siga llamando a la versión actual.
   *
   * Tenerla como dependencia del efecto costaba caro: cada tecla cambiaba el
   * estado del formulario, el padre volvía a dibujar, el efecto se rearmaba y
   * devolvía el foco al primer campo. Escribir un honorario de cinco cifras era
   * imposible: al segundo dígito el cursor saltaba al nombre.
   */
  const cerrarRef = useRef(onClose);
  cerrarRef.current = onClose;

  useEffect(() => {
    openerRef.current = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        cerrarRef.current();
        return;
      }
      if (e.key !== 'Tab') return;

      // El cuadro dice `aria-modal="true"`, o sea "el fondo no existe". Si el
      // tabulador igual se va al fondo, el teclado y el lector de pantalla
      // cuentan cosas distintas: uno pasea por botones que el otro considera
      // inexistentes. Medido antes de esto: de 45 tabulaciones seguidas, 28
      // caían afuera.
      const caja = boxRef.current;
      if (!caja) return;
      const focoables = [...caja.querySelectorAll<HTMLElement>(SELECTOR_FOCOABLE)].filter(
        (el) => !el.hasAttribute('disabled') && el.offsetParent !== null,
      );
      const primero = focoables[0];
      const ultimo = focoables[focoables.length - 1];
      if (!primero || !ultimo) return;

      if (e.shiftKey && document.activeElement === primero) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && document.activeElement === ultimo) {
        e.preventDefault();
        primero.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Foco al primer control del formulario, listo para escribir. Solo al
    // abrir: si se repitiera, pisaría el campo en el que se está tipeando.
    const first = boxRef.current?.querySelector<HTMLElement>(
      'input, select, textarea, button:not([data-close])',
    );
    first?.focus();

    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      openerRef.current?.focus();
    };
  }, []);

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal" ref={boxRef} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="modal-close" onClick={onClose} data-close aria-label="Cerrar">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function ConfirmButton({
  label,
  confirmLabel,
  onConfirm,
}: {
  label: string;
  confirmLabel: string;
  onConfirm: () => void;
}) {
  return (
    <button
      className="btn danger small"
      onClick={() => {
        if (window.confirm(confirmLabel)) onConfirm();
      }}
    >
      {label}
    </button>
  );
}

/**
 * Lo que aparece cuando se intenta agendar o cobrar sin tener pacientes.
 *
 * Antes esos botones estaban apagados y listo. Un botón apagado no explica
 * nada: quien lo toca no sabe si la app se colgó, si le falta un permiso o si
 * hizo algo mal. Decirle qué falta —y llevarlo ahí— es la diferencia entre una
 * traba y una instrucción.
 */
export function SinPacientes({ onClose, onIr }: { onClose: () => void; onIr: () => void }) {
  return (
    <Modal title="Primero cargá un paciente" onClose={onClose}>
      <p style={{ marginTop: 0 }}>
        Las sesiones y los cobros van siempre asociados a un paciente, así que hace falta tener al
        menos uno cargado. Se hace en un minuto: alcanza con el nombre.
      </p>
      <div className="actions" style={{ justifyContent: 'flex-end' }}>
        <button className="btn" onClick={onClose}>
          Ahora no
        </button>
        <button className="btn primary" onClick={onIr}>
          Ir a Pacientes
        </button>
      </div>
    </Modal>
  );
}
