/**
 * Imágenes: achicar, recortar y rotar, todo en el dispositivo con un canvas.
 */

function cargar(fuente: Blob): Promise<HTMLImageElement> {
  return new Promise((ok, mal) => {
    const url = URL.createObjectURL(fuente);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      ok(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      mal(new Error('No se pudo abrir la imagen.'));
    };
    img.src = url;
  });
}

/** Una imagen chica para una meta, como data URL: queda adentro de los datos, sin pedir nada afuera. */
export async function miniatura(archivo: Blob, lado = 320): Promise<string> {
  const img = await cargar(archivo);
  const escala = Math.min(1, lado / Math.max(img.width, img.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.width * escala);
  canvas.height = Math.round(img.height * escala);
  canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.8);
}

export interface Recorte {
  arriba: number;
  abajo: number;
  izquierda: number;
  derecha: number;
  /** Cuartos de vuelta, en sentido horario. */
  giro: 0 | 1 | 2 | 3;
}

export const SIN_RECORTE: Recorte = { arriba: 0, abajo: 0, izquierda: 0, derecha: 0, giro: 0 };

/**
 * Recorta (en porcentajes de cada borde), gira y achica a un tamaño que el
 * lector de texto maneja bien. Devuelve una imagen nueva; la original no se toca.
 */
export async function prepararParaLeer(archivo: Blob, r: Recorte, maximo = 2000): Promise<Blob> {
  const img = await cargar(archivo);
  const sx = (img.width * r.izquierda) / 100;
  const sy = (img.height * r.arriba) / 100;
  const sw = Math.max(1, img.width * (1 - (r.izquierda + r.derecha) / 100));
  const sh = Math.max(1, img.height * (1 - (r.arriba + r.abajo) / 100));
  const escala = Math.min(1, maximo / Math.max(sw, sh));
  const w = Math.round(sw * escala);
  const h = Math.round(sh * escala);
  const girada = r.giro % 2 === 1;
  const canvas = document.createElement('canvas');
  canvas.width = girada ? h : w;
  canvas.height = girada ? w : h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Este navegador no permite preparar la imagen.');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((r.giro * Math.PI) / 2);
  ctx.drawImage(img, sx, sy, sw, sh, -w / 2, -h / 2, w, h);
  return new Promise((ok, mal) => canvas.toBlob((b) => (b ? ok(b) : mal(new Error('No se pudo preparar la imagen.'))), 'image/png'));
}
