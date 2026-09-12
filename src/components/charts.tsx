import type { ReactNode } from 'react';

/**
 * Gráficos de monitoreo.
 *
 * Son barras hechas con HTML y CSS, sin librería: pesan cero, andan sin
 * conexión y heredan la tipografía de la app.
 *
 * Sobre el color: la paleta se validó con el verificador de contraste y
 * daltonismo en vez de elegirla a ojo. El primer intento usaba verde para
 * "cobrado" y rojo para "pendiente", que es el par clásico de los tableros y
 * resulta indistinguible en deuteranopía (ΔE 4,2). El par azul/ámbar que quedó
 * separa bien en todos los tipos de daltonismo (ΔE ≥ 16).
 *
 * El gris de "canceladas" sí queda por debajo del piso de saturación, pero es
 * deliberado: representa el estado "no pasó nada" y su separación contra los
 * otros dos pasa cómoda (ΔE ≥ 13).
 *
 * Los valores van escritos sobre cada barra en lugar de en un globo al pasar el
 * mouse: la app se usa sobre todo en el celular, donde no existe el hover.
 */

export const CHART_COLORS = {
  /** Azul: lo cobrado, lo realizado. */
  primary: '#0f74a8',
  /** Ámbar: lo pendiente, las ausencias. */
  attention: '#d9963f',
  /** Gris deliberado: lo cancelado, el estado sin consecuencias. */
  neutral: '#9a94a4',
} as const;

export interface Segment {
  label: string;
  value: number;
  color: string;
  /** Texto que se muestra encima del segmento, si entra. */
  caption?: string;
}

/**
 * Barra apilada horizontal. Los segmentos se separan con 2 px de superficie
 * para que se lean como piezas distintas y no como un degradado.
 */
export function StackedBar({
  segments,
  total,
  title,
}: {
  segments: Segment[];
  total: number;
  title?: string;
}) {
  const safeTotal = total > 0 ? total : 1;
  const visible = segments.filter((s) => s.value > 0);

  return (
    <div className="sbar" title={title} role="img" aria-label={title}>
      {visible.map((s, i) => {
        const pct = (s.value / safeTotal) * 100;
        return (
          <div
            key={s.label}
            className="sbar-seg"
            style={{
              width: `${pct}%`,
              background: s.color,
              // Las puntas redondeadas solo en los extremos de la barra entera.
              borderTopLeftRadius: i === 0 ? 4 : 0,
              borderBottomLeftRadius: i === 0 ? 4 : 0,
              borderTopRightRadius: i === visible.length - 1 ? 4 : 0,
              borderBottomRightRadius: i === visible.length - 1 ? 4 : 0,
            }}
          >
            {s.caption && pct > 22 && <span className="sbar-cap">{s.caption}</span>}
          </div>
        );
      })}
      {visible.length === 0 && <div className="sbar-empty" />}
    </div>
  );
}

/** Una fila del gráfico: nombre a la izquierda, barra y valor a la derecha. */
export function ChartRow({
  name,
  swatch,
  children,
  value,
}: {
  name: string;
  swatch?: string;
  children: ReactNode;
  value?: ReactNode;
}) {
  return (
    <div className="chart-row">
      <div className="chart-name">
        {swatch && <span className="dot" style={{ background: swatch }} />}
        <span className="chart-name-text">{name}</span>
      </div>
      <div className="chart-bar">{children}</div>
      {value !== undefined && <div className="chart-value">{value}</div>}
    </div>
  );
}

/**
 * Referencia de colores. Va siempre que haya más de una serie, porque la
 * identidad nunca puede depender solo del color.
 */
export function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <div className="legend" role="list">
      {items.map((i) => (
        <span key={i.label} role="listitem">
          <i className="mini-dot" style={{ background: i.color, width: 9, height: 9 }} />
          {i.label}
        </span>
      ))}
    </div>
  );
}
