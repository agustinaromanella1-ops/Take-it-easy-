/**
 * El perro salchicha de la app, en tres poses.
 *
 * Dibujo de línea: un solo grosor de trazo negro, sin relleno salvo la nariz y
 * el ojo, con las puntas redondeadas. Va en SVG y no como emoji para que se vea
 * igual en todos los dispositivos y para poder cambiarle la pose.
 */
export type DogPose = 'estirado' | 'corriendo' | 'echado';

export const DOG_POSES: DogPose[] = ['estirado', 'corriendo', 'echado'];

interface Props {
  pose?: DogPose;
  size?: number;
  /** Color del trazo. Hereda el de la interfaz para que combine con el tema. */
  color?: string;
}

export function Dachshund({ pose = 'estirado', size = 104, color = '#2b1b12' }: Props) {
  const stroke = {
    stroke: color,
    strokeWidth: 5,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    fill: 'none',
  };

  return (
    <svg
      width={size}
      height={size * 0.54}
      viewBox="0 0 230 124"
      fill="none"
      role="img"
      aria-label={`Perro salchicha ${pose}`}
    >
      {/* Cada pose se dibuja como contorno continuo: una línea para el lomo
          y otra para la panza, con las patas colgando de ellas. Trazos sueltos
          se leen como garabato; el contorno seguido es lo que da el dibujo. */}

      {pose === 'estirado' && (
        <g {...stroke}>
          {/* Lomo: sube desde la cabeza baja hasta la grupa alzada. */}
          <path d="M40 72c6-8 16-12 30-13 30-3 66-10 96-27" />
          {/* Cola levantada. */}
          <path d="M166 32c10-11 24-16 34-11" />
          {/* Grupa y muslo trasero. */}
          <path d="M172 36c12 9 13 28 2 42" />
          {/* Hocico largo y bajo, apoyado casi en el piso. */}
          <path d="M16 88c2-9 10-15 24-16" />
          {/* Mentón y panza, subiendo en diagonal con el cuerpo. */}
          <path d="M20 94c9 3 20 3 30 0 32 1 76-6 102-20" />
          {/* Patas delanteras: cortas y rectas bajo el pecho. */}
          <path d="M54 94c-1 7-1 12-1 16 3 2 7 1 9-1" />
          <path d="M70 93c-1 7-1 12-1 15 3 2 7 1 9-1" />
          {/* Patas traseras, dobladas bajo la cadera en alto. */}
          <path d="M172 78c2 9 2 17 1 22 3 2 7 1 9-1" />
          <path d="M154 84c1 7 1 13 1 17 3 2 7 1 9-1" />
          {/* Oreja larga, colgando junto al hocico. */}
          <path d="M58 68c-9 6-11 21-2 26 7 4 13-4 11-14" />
        </g>
      )}

      {pose === 'corriendo' && (
        <g {...stroke}>
          {/* Lomo horizontal: el cuerpo estirado en pleno salto. */}
          <path d="M14 60c4-10 16-16 32-17 14-1 26 1 40 3 32 0 62-2 84 6" />
          {/* Cola extendida hacia atrás. */}
          <path d="M170 52c14-4 27-9 38-14" />
          {/* Panza larga y baja. */}
          <path d="M16 66c10 4 20 4 32 2 34 8 80 8 114-2" />
          {/* Patas delanteras estiradas hacia adelante. */}
          <path d="M54 68c-8 9-18 15-29 17-4 1-5 5-1 5s5-3 4-6" />
          <path d="M68 72c-8 9-18 15-27 17" />
          {/* Patas traseras extendidas hacia atrás. */}
          <path d="M154 70c10 9 21 15 31 17 4 1 5 5 1 5s-5-3-4-6" />
          <path d="M140 72c9 9 18 15 26 18" />
          {/* Orejas largas y finas, levantadas por el viento. */}
          <path d="M46 44c-4-11 4-19 12-16 6 3 3 12-4 17" />
          <path d="M63 42c0-9 8-14 14-9 4 4 0 10-6 12" />
        </g>
      )}

      {pose === 'echado' && (
        <g {...stroke}>
          {/* Lomo pegado al piso, de la cola al cuello. */}
          <path d="M34 76c11-7 30-11 55-11 24 0 44 2 57 5" />
          {/* Cabeza redonda, levantada a la derecha. */}
          <path d="M146 70c-7-11-2-29 14-34 18-6 33 5 31 22-1 12-10 19-20 21" />
          {/* Panza apoyada, larguísima. */}
          <path d="M36 86c17 7 74 9 137 4" />
          {/* Cola apoyada, enroscándose al final. */}
          <path d="M34 76c-9-2-16 2-14 9 1 3 6 3 7-1" />
          {/* Patitas delanteras estiradas adelante. */}
          <path d="M173 90c9 2 17 2 23 0 4-1 4-6 0-6" />
          {/* Pata trasera asomando bajo el cuerpo. */}
          <path d="M74 92c-2 4 0 8 5 6" />
          {/* Orejas colgando a los costados de la cabeza. */}
          <path d="M150 40c-10-3-17 5-15 17 1 8 8 10 13 5" />
          <path d="M184 36c10-1 15 9 12 21" />
        </g>
      )}

      {/* Nariz y ojo: lo único relleno del dibujo. */}
      {pose === 'estirado' && (
        <>
          <ellipse cx="13" cy="91" rx="5.4" ry="4.4" fill={color} />
          <circle cx="43" cy="76" r="2.8" fill={color} />
        </>
      )}
      {pose === 'corriendo' && (
        <>
          <ellipse cx="12" cy="63" rx="5" ry="4.2" fill={color} />
          <circle cx="36" cy="56" r="2.6" fill={color} />
        </>
      )}
      {pose === 'echado' && (
        <>
          <ellipse cx="191" cy="48" rx="5" ry="4.2" fill={color} />
          <circle cx="176" cy="44" r="2.8" fill={color} />
        </>
      )}
    </svg>
  );
}
