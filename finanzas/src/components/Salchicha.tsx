import type { TrucoId } from '../lib/huellitas/huellitas';

/**
 * El salchicha, dibujado por partes para poder animarlo.
 *
 * Es un personaje provisional inspirado en el perro de Pipí Cucú
 * (`public/pipi-cucu-dog-static.png` en la app hermana): naranja, panza
 * crema, orejas marrones, ojos cerrados sonrientes. Se reemplaza cambiando
 * este archivo; nada más en la app sabe cómo está dibujado.
 *
 * Nunca tiene hambre, ni se enferma, ni se pone triste: no hay un estado que
 * dependa de si la persona entró o no.
 */
export function Salchicha({ truco, tam = 200, etiqueta = 'Salchi, el perro salchicha' }: { truco?: TrucoId | null; tam?: number; etiqueta?: string }) {
  return (
    <svg
      className="salchicha"
      data-truco={truco ?? undefined}
      width={tam}
      height={tam / 2}
      viewBox="0 0 240 120"
      role="img"
      aria-label={etiqueta}
    >
      <g className="perro">
        <g className="cola">
          <path d="M196 56 Q214 48 220 26" fill="none" stroke="var(--perro-trazo)" strokeWidth="9" strokeLinecap="round" />
          <path d="M196 56 Q214 48 220 26" fill="none" stroke="var(--perro-cuerpo)" strokeWidth="4.5" strokeLinecap="round" />
        </g>
        <g className="patas-tras">
          <rect x="166" y="66" width="13" height="32" rx="6.5" fill="var(--perro-cuerpo)" stroke="var(--perro-trazo)" strokeWidth="3" />
          <rect x="182" y="66" width="13" height="32" rx="6.5" fill="var(--perro-oreja)" stroke="var(--perro-trazo)" strokeWidth="3" />
        </g>
        <g className="pata-del-2">
          <rect x="88" y="66" width="13" height="32" rx="6.5" fill="var(--perro-oreja)" stroke="var(--perro-trazo)" strokeWidth="3" />
        </g>
        <rect x="58" y="38" width="146" height="44" rx="22" fill="var(--perro-cuerpo)" stroke="var(--perro-trazo)" strokeWidth="3" />
        <path d="M78 70 Q130 84 190 70" fill="none" stroke="var(--perro-panza)" strokeWidth="9" strokeLinecap="round" />
        <g className="pata-del-1">
          <rect x="70" y="66" width="13" height="32" rx="6.5" fill="var(--perro-cuerpo)" stroke="var(--perro-trazo)" strokeWidth="3" />
        </g>
        <g className="cabeza">
          <ellipse cx="50" cy="44" rx="25" ry="23" fill="var(--perro-cuerpo)" stroke="var(--perro-trazo)" strokeWidth="3" />
          <ellipse cx="27" cy="55" rx="20" ry="12" fill="var(--perro-panza)" stroke="var(--perro-trazo)" strokeWidth="3" />
          <circle cx="10" cy="51" r="5.5" fill="var(--perro-trazo)" />
          <path d="M41 40 Q47 34 53 40" fill="none" stroke="var(--perro-trazo)" strokeWidth="3" strokeLinecap="round" />
          <path d="M18 62 Q26 68 34 62" fill="none" stroke="var(--perro-trazo)" strokeWidth="2.5" strokeLinecap="round" />
          <g className="oreja">
            <path d="M58 26 Q86 30 78 62 Q70 70 62 60 Q56 44 58 26 Z" fill="var(--perro-oreja)" stroke="var(--perro-trazo)" strokeWidth="3" strokeLinejoin="round" />
          </g>
        </g>
      </g>
      <circle className="pelota" cx="232" cy="92" r="8" fill="var(--pelota)" stroke="var(--perro-trazo)" strokeWidth="2.5" />
    </svg>
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
