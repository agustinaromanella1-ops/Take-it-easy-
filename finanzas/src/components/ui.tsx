import { useEffect, useRef, type ReactNode } from 'react';

/**
 * Piezas de interfaz compartidas. Vienen de Pipí Cucú, donde se aprendió por
 * las malas cada detalle de accesibilidad que tienen.
 */

export function Card({ titulo, accion, children, className }: { titulo?: string; accion?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`card${className ? ` ${className}` : ''}`}>
      {(titulo || accion) && (
        <div className="card-titulo">
          {titulo ? <h2>{titulo}</h2> : <span />}
          {accion}
        </div>
      )}
      {children}
    </section>
  );
}

/**
 * Un campo con su etiqueta. La caja es un `<label>` y el control va ADENTRO:
 * así un lector de pantalla sabe cómo se llama el control sin inventar ids.
 */
export function Field({ label, ayuda, error, children }: { label: string; ayuda?: string; error?: string | undefined; children: ReactNode }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {ayuda && <span className="field-ayuda">{ayuda}</span>}
      {error && <span className="error-text">{error}</span>}
    </label>
  );
}

/** Aviso con texto: el tono nunca va solo por color. */
export function Aviso({ tono = 'info', children }: { tono?: 'info' | 'warn' | 'ok' | 'error'; children: ReactNode }) {
  const prefijo = { info: 'Dato', warn: 'Atención', ok: 'Listo', error: 'Error' }[tono];
  return (
    <div className={`aviso aviso-${tono}`} role={tono === 'error' ? 'alert' : undefined}>
      <span className="aviso-prefijo">{prefijo}:</span> {children}
    </div>
  );
}

const SELECTOR_FOCOABLE = 'a[href], button, input, select, textarea, summary, [tabindex]:not([tabindex="-1"])';

/**
 * Cuadro accesible: cierra con Escape, retiene el tabulador adentro y
 * devuelve el foco a quien lo abrió.
 *
 * `onClose` se guarda en una ref: si fuera dependencia del efecto, cada tecla
 * rearmaría el efecto y el cursor saltaría al primer campo (ya pasó en Pipí
 * Cucú: escribir un importe de cinco cifras era imposible).
 */
export function Modal({ titulo, onClose, children, ancho }: { titulo: string; onClose: () => void; children: ReactNode; ancho?: boolean }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
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
    // Primero lo marcado a propósito; si no hay, el primer control. Un solo
    // selector con coma devolvería el primero en el documento, no el marcado.
    const caja = boxRef.current;
    const first =
      caja?.querySelector<HTMLElement>('[data-autofoco]') ??
      caja?.querySelector<HTMLElement>('input, select, textarea, button:not([data-close])');
    first?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      openerRef.current?.focus();
    };
  }, []);

  return (
    <div
      className="modal-fondo"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={`modal${ancho ? ' modal-ancho' : ''}`} ref={boxRef} role="dialog" aria-modal="true" aria-label={titulo}>
        <div className="modal-cabeza">
          <h2>{titulo}</h2>
          <button className="modal-cerrar" onClick={onClose} data-close aria-label="Cerrar">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Opciones de a una, como botones: más fáciles de tocar que un desplegable. */
export function Opciones<T extends string>({
  legend,
  valor,
  opciones,
  onChange,
  ocultarLegend,
}: {
  legend: string;
  valor: T;
  opciones: readonly { valor: T; texto: string }[];
  onChange: (v: T) => void;
  ocultarLegend?: boolean;
}) {
  return (
    <fieldset className="opciones">
      <legend className={ocultarLegend ? 'solo-lector' : 'field-label'}>{legend}</legend>
      <div className="opciones-lista">
        {opciones.map((o) => (
          <button
            key={o.valor}
            type="button"
            className={`chip${o.valor === valor ? ' chip-activo' : ''}`}
            aria-pressed={o.valor === valor}
            onClick={() => onChange(o.valor)}
          >
            {o.texto}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

/** Interruptor accesible: un checkbox con apariencia de llave. */
export function Llave({ label, ayuda, checked, onChange }: { label: string; ayuda?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="llave">
      <span className="llave-texto">
        <span className="field-label">{label}</span>
        {ayuda && <span className="field-ayuda">{ayuda}</span>}
      </span>
      <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

/** Barra de progreso con su texto: el número también se dice, no solo se dibuja. */
export function Progreso({ valor, max, texto }: { valor: number; max: number; texto: string }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (valor / max) * 100)) : 0;
  return (
    <div className="progreso">
      <div className="progreso-barra" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)} aria-valuetext={texto}>
        <div className="progreso-lleno" style={{ width: `${pct}%` }} />
      </div>
      <div className="progreso-texto">{texto}</div>
    </div>
  );
}
