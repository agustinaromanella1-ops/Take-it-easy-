/**
 * El perro salchicha de la app.
 *
 * Ilustración plana en SVG, al estilo del dibujo de referencia: silueta de
 * color terracota, patas más oscuras, oreja con contorno fino y cola levantada.
 * Va dibujado a mano y no como emoji para que se vea igual en todos los
 * dispositivos (el emoji de perro cambia mucho entre Android, iOS y Windows).
 *
 * `wag` le mueve la cola; se activa al tocarlo.
 */
export function Dachshund({ size = 56, wag = false }: { size?: number; wag?: boolean }) {
  const coat = '#b9542c';
  const paw = '#6e3a22';
  const line = '#5a2e1b';

  return (
    <svg
      width={size}
      height={size * 0.68}
      viewBox="0 0 130 88"
      fill="none"
      role="img"
      aria-label="Perro salchicha"
    >
      {/* Cola levantada, del lado opuesto a la cabeza. */}
      <g style={{ transformOrigin: '30px 44px' }}>
        {wag && (
          <animateTransform
            attributeName="transform"
            type="rotate"
            values="0 30 44; -16 30 44; 0 30 44; 12 30 44; 0 30 44"
            dur="0.7s"
            repeatCount="3"
          />
        )}
        <path
          d="M38 54C29 47 18 32 19 20c.2-2.6 1.6-4 3.4-3.6 1.9.4 2.4 2.2 2.2 4.6-.8 9.4 6 20 14.6 26.4Z"
          fill={coat}
        />
      </g>

      {/* Patas traseras: van primero para quedar por detrás del cuerpo. */}
      <rect x="33" y="56" width="11" height="24" rx="5.5" fill={coat} />
      <path d="M33 70h11v5.5a5.5 5.5 0 0 1-11 0Z" fill={paw} />
      <rect x="48" y="57" width="11" height="23" rx="5.5" fill={paw} />

      {/* Cuerpo largo: lo que lo hace salchicha. */}
      <rect x="28" y="38" width="66" height="28" rx="14" fill={coat} />

      {/* Cabeza y hocico en una sola silueta, como en el dibujo. */}
      <path
        d="M78 44c0-13 8.5-23 21-23 7 0 12.5 3.4 16 8.4l12 7.2c1.6 1 1.6 3.4 0 4.3l-6 3.4c-1 .6-2.2.6-3.2 0l-4-2.3c-3 6-9 9.8-15.8 9.8C86 51.8 78 52 78 44Z"
        fill={coat}
      />

      {/* Nariz en la punta del hocico. */}
      <ellipse cx="125" cy="38.5" rx="4.2" ry="3.4" fill="#2b1b12" />

      {/* Oreja larga y caída, la marca de la raza: relleno y contorno fino. */}
      <path
        d="M94 24c-6.4 0-10.5 5.4-10.5 15S87 55.5 93.5 55.5 103 49 103 39.5 100.4 24 94 24Z"
        fill={coat}
        stroke={line}
        strokeWidth="1.8"
      />

      {/* Ojo: un punto, nada más. */}
      <circle cx="111" cy="31" r="2.6" fill="#2b1b12" />

      {/* Boca: la línea que lo hace sonreír. */}
      <path d="M117 44.8c1.8 1.6 3.8 1.7 5.8.2" stroke={line} strokeWidth="1.6" strokeLinecap="round" />

      {/* Patas delanteras, por delante del cuerpo. */}
      <rect x="70" y="57" width="11" height="23" rx="5.5" fill={paw} />
      <rect x="84" y="56" width="11" height="24" rx="5.5" fill={coat} />
      <path d="M84 70h11v5.5a5.5 5.5 0 0 1-11 0Z" fill={paw} />
    </svg>
  );
}
