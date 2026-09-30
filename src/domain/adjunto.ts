/**
 * Un archivo que viaja con el mensaje: una foto, un PDF, lo que sea.
 *
 * Lo primero que hay que entender de esto es que **el adjunto no puede ir por
 * el camino directo**. El deep link de WhatsApp (`whatsapp://send?phone=…` y
 * `wa.me`) solo acepta un número y un texto: no hay ningún parámetro para un
 * archivo, y no lo hay a propósito. Así que un mensaje con adjunto sale como
 * los mensajes a grupos: se le entrega el archivo a WhatsApp y la usuaria
 * elige el chat. Un toque más, y no se puede hacer mejor desde afuera.
 *
 * La segunda cosa: al entregar un archivo no viaja el texto. Por eso, cuando
 * hay adjunto, el texto se copia al portapapeles antes de abrir WhatsApp, y
 * la usuaria lo pega como epígrafe. Feo, pero es eso o perder el mensaje.
 */

export interface Adjunto {
  /**
   * Nombre del archivo dentro de la carpeta de adjuntos de la app.
   *
   * Se guarda el nombre y no la ruta completa porque en iOS la carpeta de la
   * app cambia de nombre en cada actualización: una ruta absoluta guardada
   * hoy apunta a la nada después de actualizar.
   */
  archivo: string;
  /** El nombre que tenía el archivo original, para mostrarlo. */
  nombre: string;
  mime: string;
  bytes: number;
}

/**
 * Hasta acá copiamos. No es un límite de WhatsApp —los documentos llegan a
 * 2 GB— sino nuestro: el archivo se copia a la carpeta de la app y se queda
 * ahí hasta que el mensaje sale. Cien megas por mensaje ya es mucho para algo
 * que puede quedar semanas esperando.
 */
export const LIMITE_BYTES = 100 * 1024 * 1024;

/** Lo que WhatsApp acepta como foto, video o audio. Arriba de esto, rebota. */
export const LIMITE_MEDIA_BYTES = 16 * 1024 * 1024;

export const esImagen = (mime: string): boolean => mime.startsWith('image/');
export const esVideo = (mime: string): boolean => mime.startsWith('video/');
export const esAudio = (mime: string): boolean => mime.startsWith('audio/');

/** Los tres que WhatsApp comprime y limita a 16 MB. El resto va como documento. */
export const esMedia = (mime: string): boolean =>
  esImagen(mime) || esVideo(mime) || esAudio(mime);

export function tipoLegible(mime: string): string {
  if (esImagen(mime)) return 'Foto';
  if (esVideo(mime)) return 'Video';
  if (esAudio(mime)) return 'Audio';
  if (mime === 'application/pdf') return 'PDF';
  return 'Documento';
}

export function emojiDe(mime: string): string {
  if (esImagen(mime)) return '🖼️';
  if (esVideo(mime)) return '🎬';
  if (esAudio(mime)) return '🎵';
  if (mime === 'application/pdf') return '📄';
  return '📎';
}

/** Tamaño en criollo. Con coma decimal, que es como se escribe acá. */
export function formatearTamano(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '';
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} kB`;
  const mb = kb / 1024;
  const redondeado = mb < 10 ? Math.round(mb * 10) / 10 : Math.round(mb);
  return `${String(redondeado).replace('.', ',')} MB`;
}

export type Rechazo = 'demasiado-grande' | 'vacio';

/** Por qué no podemos guardar este archivo, o null si se puede. */
export function rechazar(bytes: number): Rechazo | null {
  if (bytes <= 0) return 'vacio';
  if (bytes > LIMITE_BYTES) return 'demasiado-grande';
  return null;
}

export const MOTIVOS: Record<Rechazo, string> = {
  'demasiado-grande': `Ese archivo pesa más de ${formatearTamano(LIMITE_BYTES)} y no lo podemos guardar hasta la hora del mensaje. Mandalo por WhatsApp en el momento.`,
  vacio: 'Ese archivo está vacío o no lo pudimos leer.',
};

/**
 * Aviso de que WhatsApp lo va a rebotar por tamaño, o null si está bien.
 * No impide adjuntarlo: el límite es de WhatsApp y puede cambiar, así que
 * avisamos en vez de prohibir.
 */
export function avisoDeTamano(a: Adjunto): string | null {
  if (!esMedia(a.mime) || a.bytes <= LIMITE_MEDIA_BYTES) return null;
  // "una foto", pero "un video" y "un audio".
  return `Es ${esImagen(a.mime) ? 'una' : 'un'} ${tipoLegible(a.mime).toLowerCase()} de ${formatearTamano(a.bytes)}. WhatsApp acepta hasta ${formatearTamano(LIMITE_MEDIA_BYTES)} en fotos, videos y audios, así que puede rechazarlo. Lo podés adjuntar igual y probar.`;
}

/**
 * Nombre único y sin sorpresas para guardar en disco.
 *
 * El nombre que viene del selector lo eligió otra app y puede traer barras,
 * dos puntos o caracteres que el sistema de archivos no acepta. Y dos fotos
 * distintas se llaman "IMG_0001.jpg" las dos, así que el id va adelante.
 */
export function nombreEnDisco(id: string, original: string): string {
  const limpio = original
    .normalize('NFC')
    .replace(/[/\\:*?"<>|\u0000-\u001f]/g, '_')
    .replace(/^\.+/, '_')
    .slice(-80);
  return `${id}-${limpio || 'archivo'}`;
}
