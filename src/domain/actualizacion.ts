/**
 * Detección de versión nueva.
 *
 * La app no se distribuye por Play Store sino como un APK en una publicación
 * de GitHub con etiqueta fija, así que no hay número de versión que comparar:
 * el archivo se reemplaza y conserva el mismo nombre. Lo que sí cambia es
 * cuándo se subió, y eso alcanza.
 *
 * Al compilar se graba la fecha de la compilación adentro de la app. Si el
 * archivo publicado es más nuevo que eso, hay algo para bajar.
 */

export interface Publicacion {
  /** Cuándo se subió el archivo, en ISO. */
  publicadoEn: string;
  /** La página de la publicación, para abrirla en el navegador. */
  url: string;
}

/**
 * Margen para no avisar por diferencias de segundos. La compilación termina
 * unos minutos después de que se graba la fecha, así que sin margen la app
 * recién instalada se anunciaría a sí misma como desactualizada.
 */
export const MARGEN_MINUTOS = 10;

export function hayActualizacion(
  compiladaEn: string | null | undefined,
  publicacion: Publicacion | null,
  margenMinutos: number = MARGEN_MINUTOS,
): boolean {
  if (!compiladaEn || !publicacion) return false;

  const propia = new Date(compiladaEn).getTime();
  const publicada = new Date(publicacion.publicadoEn).getTime();
  if (Number.isNaN(propia) || Number.isNaN(publicada)) return false;

  return publicada > propia + margenMinutos * 60_000;
}

/** "hace 3 días", para decir de cuándo es la versión que hay instalada. */
export function describirVersion(compiladaEn: string | null | undefined): string {
  if (!compiladaEn) return 'Versión de desarrollo';
  const fecha = new Date(compiladaEn);
  if (Number.isNaN(fecha.getTime())) return 'Versión de desarrollo';

  const dias = Math.floor((Date.now() - fecha.getTime()) / 86_400_000);
  if (dias <= 0) return 'Instalaste la versión de hoy';
  if (dias === 1) return 'Instalaste la versión de ayer';
  return `Instalaste la versión de hace ${dias} días`;
}
