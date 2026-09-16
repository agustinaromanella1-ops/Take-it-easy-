import { useCallback, useEffect, useLayoutEffect, useState } from 'react';

/**
 * Los carteles que explican cada botón la primera vez.
 *
 * Señala un control real de la pantalla —no un dibujo de uno— buscándolo por
 * su atributo `data-tour`. Así el cartel siempre apunta al botón que de verdad
 * está ahí: en el celular la navegación es la barra de abajo y en la
 * computadora la de arriba, y el mismo paso sirve para las dos.
 *
 * Se puede saltear en cualquier momento y no vuelve solo. Quien quiera verlo
 * de nuevo lo pide desde la guía.
 */
const CLAVE_VISTO = 'pipicucu:carteles-vistos';

export type Paso = { destino: string; titulo: string; texto: string };

export const PASOS: Paso[] = [
  {
    destino: 'pacientes',
    titulo: 'Tus pacientes',
    texto: 'Acá cargás a cada persona: cuánto cobra, cada cuánto viene y su teléfono. Es lo primero que conviene hacer.',
  },
  {
    destino: 'agenda',
    titulo: 'La agenda',
    texto: 'El calendario del mes. Desde acá agendás una sesión suelta o una serie que se repite, y marcás lo que pasó cada día.',
  },
  {
    destino: 'finanzas',
    titulo: 'Los números',
    texto: 'Lo facturado y lo cobrado del mes, quién te debe, tu meta y los datos para armar la factura.',
  },
  {
    destino: 'ajustes',
    titulo: 'Tu copia de seguridad',
    texto: 'Importante: los datos viven en este teléfono. Desde Ajustes exportás una copia. Hacela cada tanto.',
  },
  {
    destino: 'ayuda',
    titulo: 'Si te perdés',
    texto: 'Este signo de pregunta abre la guía completa, con todo explicado. Y desde ahí podés volver a ver estos carteles.',
  },
];

/** Si todavía no se vieron los carteles. */
export function cartelesPendientes(): boolean {
  try {
    return localStorage.getItem(CLAVE_VISTO) === null;
  } catch {
    return false;
  }
}

function marcarVistos(): void {
  try {
    localStorage.setItem(CLAVE_VISTO, '1');
  } catch {
    /* Sin almacenamiento los carteles volverán a aparecer. No es grave. */
  }
}

type Caja = { top: number; left: number; width: number; height: number };

/** Dónde está en pantalla el control de este paso, si es que está visible. */
function ubicar(destino: string): Caja | null {
  const todos = [...document.querySelectorAll<HTMLElement>(`[data-tour="${destino}"]`)];
  // Puede haber dos copias del mismo control (barra de abajo y de arriba):
  // vale la que se está viendo.
  const visible = todos.find((el) => el.getBoundingClientRect().width > 0);
  if (!visible) return null;
  const r = visible.getBoundingClientRect();
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

export function Tour({ onCerrar }: { onCerrar: () => void }) {
  const [i, setI] = useState(0);
  const [caja, setCaja] = useState<Caja | null>(null);
  const paso = PASOS[i]!;

  const cerrar = useCallback(() => {
    marcarVistos();
    onCerrar();
  }, [onCerrar]);

  // Se mide después de pintar y en cada cambio de tamaño: si el teclado, el
  // giro de pantalla o la barra del navegador mueven el botón, el cartel lo
  // sigue en lugar de quedar apuntando al vacío.
  useLayoutEffect(() => {
    const medir = () => setCaja(ubicar(paso.destino));
    medir();
    window.addEventListener('resize', medir);
    window.addEventListener('scroll', medir, true);
    return () => {
      window.removeEventListener('resize', medir);
      window.removeEventListener('scroll', medir, true);
    };
  }, [paso.destino]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cerrar();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [cerrar]);

  const ultimo = i === PASOS.length - 1;

  // Si el control de este paso no está en pantalla, el cartel va al medio en
  // vez de apuntar a cualquier lado.
  const arribaDelDestino = caja !== null && caja.top > window.innerHeight / 2;
  const estilo: React.CSSProperties =
    caja === null
      ? { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }
      : arribaDelDestino
        ? { bottom: `${window.innerHeight - caja.top + 14}px` }
        : { top: `${caja.top + caja.height + 14}px` };

  return (
    <div className="tour" role="dialog" aria-modal="true" aria-label={`Guía rápida: ${paso.titulo}`}>
      <div className="tour-fondo" onClick={cerrar} />

      {/* El aro marca el botón del que se está hablando. */}
      {caja !== null && (
        <div
          className="tour-aro"
          aria-hidden="true"
          style={{ top: caja.top - 6, left: caja.left - 6, width: caja.width + 12, height: caja.height + 12 }}
        />
      )}

      <div className="tour-cartel" style={estilo}>
        <p className="tour-paso">Paso {i + 1} de {PASOS.length}</p>
        <h2>{paso.titulo}</h2>
        <p className="tour-texto">{paso.texto}</p>
        <div className="tour-acciones">
          <button type="button" className="tour-saltar" onClick={cerrar}>
            {ultimo ? 'Listo' : 'Saltar'}
          </button>
          {!ultimo && (
            <button type="button" className="btn primary" onClick={() => setI((n) => n + 1)}>
              Siguiente
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
