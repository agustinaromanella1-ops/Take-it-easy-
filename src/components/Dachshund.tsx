/**
 * El perro salchicha de la app.
 *
 * Ilustración de color plano al estilo del dibujo de referencia: cuerpo color
 * caramelo, oreja más oscura, cachete rosado y sweater blanco a rayas rosas.
 * Va dibujado en SVG y no como imagen para que escale sin pesar y para poder
 * moverle la cola.
 */
interface Props {
  size?: number;
  /** Mueve la cola. Se activa al tocarlo. */
  wag?: boolean;
}

const COAT = '#c79a6d';
const COAT_SHADE = '#b0855a';
const EAR = '#9d6b45';
const INK = '#2e2019';
const BLUSH = '#f2b4c3';
const KNIT = '#fdfbf8';
const STRIPE = '#f6d2d6';
const SEAM = '#d8d4dd';

export function Dachshund({ size = 132, wag = false }: Props) {
  return (
    <svg
      width={size}
      height={size * 0.5}
      viewBox="0 0 300 150"
      fill="none"
      role="img"
      aria-label="Perro salchicha con sweater a rayas"
    >
      <defs>
        {/* Las rayas se recortan con la silueta del sweater, así siguen su
            contorno en vez de desbordarlo. */}
        <clipPath id="pf-knit">
          <path d="M104 56h76c14 0 22 9 22 22v24c0 13-8 22-22 22h-76c-14 0-22-9-22-22V78c0-13 8-22 22-22Z" />
        </clipPath>
      </defs>

      {/* Cola, por detrás del cuerpo. */}
      <g style={{ transformOrigin: '238px 80px' }}>
        {wag && (
          <animateTransform
            attributeName="transform"
            type="rotate"
            values="0 238 80; -13 238 80; 0 238 80; 9 238 80; 0 238 80"
            dur="0.75s"
            repeatCount="3"
          />
        )}
        <path
          d="M232 76c11-2 24-13 30-28 1-3 4-4 6-2s3 5 2 8c-7 19-22 32-36 36Z"
          fill={COAT}
        />
      </g>

      {/* Patas del lado de atrás, más oscuras para dar profundidad. */}
      <rect x="100" y="100" width="14" height="40" rx="7" fill={COAT_SHADE} />
      <rect x="206" y="100" width="14" height="40" rx="7" fill={COAT_SHADE} />

      {/* Cuerpo largo y bajo: la proporción es lo que lo hace salchicha. */}
      <rect x="66" y="58" width="178" height="54" rx="27" fill={COAT} />

      {/* Patas del lado de adelante. */}
      <rect x="116" y="102" width="15" height="40" rx="7.5" fill={COAT} />
      <rect x="222" y="102" width="15" height="40" rx="7.5" fill={COAT} />

      {/* Cabeza, con el hocico afinándose hacia la izquierda. */}
      <path
        d="M32 62c0-15 12-25 27-25s25 11 25 25c0 14-9 24-22 26h-3c-15 0-24-7-27-17l-8-3c-4-2-3-6 2-7Z"
        fill={COAT}
      />

      {/* Sweater: el tejido, después las rayas recortadas. Cubre el lomo pero
          deja el cuarto trasero a la vista, como en el dibujo. */}
      <path
        d="M104 56h76c14 0 22 9 22 22v24c0 13-8 22-22 22h-76c-14 0-22-9-22-22V78c0-13 8-22 22-22Z"
        fill={KNIT}
      />
      <g clipPath="url(#pf-knit)">
        {/* Bandas inclinadas siguiendo la caída del tejido sobre el lomo. */}
        <g transform="rotate(14 142 90)">
          {[58, 80, 102, 124, 146, 168, 190].map((x) => (
            <rect key={x} x={x} y="20" width="11" height="140" fill={STRIPE} />
          ))}
        </g>
      </g>
      <path
        d="M104 56h76c14 0 22 9 22 22v24c0 13-8 22-22 22h-76c-14 0-22-9-22-22V78c0-13 8-22 22-22Z"
        stroke={SEAM}
        strokeWidth="1.5"
      />

      {/* Cuello del sweater: una banda al borde del tejido, no un parche
          flotando en el medio. */}
      <path
        d="M91 53c11 0 15 8 15 20v34c0 12-5 20-16 20s-16-8-16-20V73c0-12 6-20 17-20Z"
        fill={KNIT}
        stroke={SEAM}
        strokeWidth="1.5"
      />

      {/* Oreja larga y angosta, por delante del cuello. */}
      <path
        d="M66 40c12-2 20 9 19 24-1 16-8 27-18 26-8-1-11-12-10-24 1-13 3-24 9-26Z"
        fill={EAR}
      />

      {/* Cara: nariz, ojo y cachete. */}
      <ellipse cx="26" cy="62" rx="5" ry="4.3" fill={INK} />
      <circle cx="55" cy="55" r="4.3" fill={INK} />
      <circle cx="43" cy="69" r="6" fill={BLUSH} />
    </svg>
  );
}
