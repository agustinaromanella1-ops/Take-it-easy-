import type { TrucoId } from '../lib/huellitas/huellitas';
import { sinMovimiento } from '../lib/movimiento';

/**
 * El perro. Es EL MISMO de Pipí Cucú, no uno parecido: los dos archivos de
 * `public/` son copias byte por byte de los de la app hermana
 * (`../public/pipi-cucu-dog-*`). La idea es que todas las apps tengan el
 * mismo perrito, así que no se redibuja, no se recolorea y no se recorta. Si
 * cambia allá, se vuelve a copiar acá.
 *
 * El GIF es el perro volando; el PNG, el mismo cuadro quieto, para quien pidió
 * menos movimiento. Los trucos mueven la imagen entera (saltar, girar,
 * inclinarse) sin tocar el dibujo.
 *
 * Nunca tiene hambre, ni se enferma, ni se pone triste: no hay un estado que
 * dependa de si la persona entró o no.
 */
export const PERRO_VOLANDO = '/pipi-cucu-dog-flying.gif';
export const PERRO_QUIETO = '/pipi-cucu-dog-static.png';
const ANCHO = 483;
const ALTO = 177;

export function Salchicha({ truco, tam = 200, etiqueta = 'Salchi, el perro salchicha' }: { truco?: TrucoId | null; tam?: number; etiqueta?: string }) {
  const quieto = sinMovimiento();
  return (
    <span className="salchicha" data-truco={truco ?? undefined} style={{ width: tam }}>
      <img
        className="perro"
        src={quieto ? PERRO_QUIETO : PERRO_VOLANDO}
        width={tam}
        height={Math.round((tam * ALTO) / ANCHO)}
        alt={etiqueta}
        {...(etiqueta === '' ? { 'aria-hidden': true } : {})}
        decoding="async"
        draggable={false}
      />
      {truco === 'pelota' && <span className="pelota" aria-hidden="true" />}
    </span>
  );
}

/** La huella: cinco almohadillas que se llenan de a una. */
export function Huellita({ llenas, tam = 64, completa = false }: { llenas: number; tam?: number; completa?: boolean }) {
  const n = completa ? 5 : llenas;
  const dedos = [
    { cx: 18, cy: 26, rx: 7, ry: 9 },
    { cx: 32, cy: 16, rx: 7, ry: 9 },
    { cx: 48, cy: 16, rx: 7, ry: 9 },
    { cx: 62, cy: 26, rx: 7, ry: 9 },
  ];
  return (
    <svg className={`huellita${completa ? ' huellita-completa' : ''}`} width={tam} height={tam} viewBox="0 0 80 80" role="img" aria-label={`Huellita: ${n} de 5`}>
      {dedos.map((d, i) => (
        <ellipse key={i} {...d} className={i < n ? 'almohadilla llena' : 'almohadilla'} />
      ))}
      <path className={n >= 5 ? 'almohadilla llena' : 'almohadilla'} d="M40 36 C26 36 16 50 18 60 C20 70 30 68 40 66 C50 68 60 70 62 60 C64 50 54 36 40 36 Z" />
    </svg>
  );
}

/** La hormiguita: chiquita, dibujada simple. */
export function DibujoHormiga({ tam = 36 }: { tam?: number }) {
  return (
    <svg width={tam} height={tam} viewBox="0 0 40 40" aria-hidden="true" focusable="false">
      <g stroke="var(--hormiga)" strokeWidth="2" strokeLinecap="round" fill="none">
        <path d="M14 20 L6 14 M14 22 L5 22 M15 24 L7 31 M24 20 L32 13 M24 22 L34 22 M23 24 L31 31" />
        <path d="M9 9 Q11 5 14 8 M13 8 Q14 4 17 6" />
      </g>
      <circle cx="12" cy="12" r="4.5" fill="var(--hormiga)" />
      <ellipse cx="19" cy="21" rx="4" ry="4.5" fill="var(--hormiga)" />
      <ellipse cx="28" cy="23" rx="6.5" ry="5.5" fill="var(--hormiga)" />
    </svg>
  );
}
