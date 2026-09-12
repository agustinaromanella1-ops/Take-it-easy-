/**
 * Colores de paciente. Sirven para reconocerlo de un vistazo en la agenda, así
 * que se eligieron con suficiente separación de tono entre sí y con contraste
 * suficiente sobre blanco para el texto.
 */
export interface PatientColor {
  name: string;
  /** Color pleno: bordes y puntos. */
  solid: string;
  /** Versión clara para fondos de etiqueta. */
  soft: string;
  /** Versión oscura, legible como texto sobre `soft`. */
  ink: string;
}

export const PATIENT_COLORS: PatientColor[] = [
  { name: 'Turquesa', solid: '#5a9aae', soft: '#e4f0f4', ink: '#3c7286' },
  { name: 'Lavanda', solid: '#8b7bb8', soft: '#eeeaf7', ink: '#63539a' },
  { name: 'Rosa', solid: '#c97b96', soft: '#fae9ef', ink: '#a1516e' },
  { name: 'Verde', solid: '#6ba583', soft: '#e6f2ea', ink: '#457a5c' },
  { name: 'Ámbar', solid: '#c4924f', soft: '#f8eeda', ink: '#8e6526' },
  { name: 'Coral', solid: '#d08268', soft: '#fbeae4', ink: '#a45840' },
  { name: 'Índigo', solid: '#6b83bb', soft: '#e8ecf8', ink: '#455f9c' },
  { name: 'Oliva', solid: '#94a05f', soft: '#f0f2e2', ink: '#6a7539' },
];

/** Devuelve siempre un color válido, aunque el índice guardado quede fuera de rango. */
export function patientColor(index: number): PatientColor {
  const safe = ((Math.trunc(index) % PATIENT_COLORS.length) + PATIENT_COLORS.length) % PATIENT_COLORS.length;
  return PATIENT_COLORS[safe]!;
}

/** Color sugerido al dar de alta: el primero que no esté en uso. */
export function nextFreeColor(used: number[]): number {
  const taken = new Set(used.map((i) => ((i % PATIENT_COLORS.length) + PATIENT_COLORS.length) % PATIENT_COLORS.length));
  for (let i = 0; i < PATIENT_COLORS.length; i++) {
    if (!taken.has(i)) return i;
  }
  return used.length % PATIENT_COLORS.length;
}
