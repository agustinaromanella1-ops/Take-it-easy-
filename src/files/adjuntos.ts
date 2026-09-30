import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import {
  nombreEnDisco,
  rechazar,
  type Adjunto,
  type Rechazo,
} from '../domain/adjunto';

/**
 * Los adjuntos viven en una carpeta nuestra dentro de la app.
 *
 * Copiarlos no es una comodidad: el selector del sistema nos da un permiso de
 * lectura que dura lo que dura la app abierta, y el archivo original lo puede
 * borrar o mover su dueño en cualquier momento. Un mensaje programado para el
 * martes que viene tiene que llegar al martes con su archivo, así que se hace
 * una copia propia y se trabaja siempre sobre ella.
 *
 * Las copias se borran cuando ya no las referencia ningún mensaje, en el
 * arranque. Ver `limpiarHuerfanos`.
 */
const CARPETA = `${FileSystem.documentDirectory ?? ''}adjuntos/`;

/** La ruta completa se arma en cada uso: en iOS cambia entre actualizaciones. */
export const uriDe = (archivo: string): string => `${CARPETA}${archivo}`;

async function asegurarCarpeta(): Promise<void> {
  const info = await FileSystem.getInfoAsync(CARPETA);
  if (info.exists && info.isDirectory) return;
  await FileSystem.makeDirectoryAsync(CARPETA, { intermediates: true });
}

export type ResultadoAdjuntar =
  | { ok: true; adjunto: Adjunto }
  | { ok: false; motivo: Rechazo }
  | { ok: false; motivo: 'cancelado' };

/**
 * Abre el selector del sistema y se queda con una copia de lo que se elija.
 *
 * Usa el selector de documentos y no el de la galería a propósito. En Android
 * el de documentos entra igual a las fotos y no pide ningún permiso; el de la
 * galería obliga a declarar READ_MEDIA_IMAGES, que en Google Play arrastra un
 * formulario de justificación. No vale la pena por ahora.
 */
export async function elegirYGuardar(
  nuevoId: () => string,
): Promise<ResultadoAdjuntar> {
  const elegido = await DocumentPicker.getDocumentAsync({
    type: '*/*',
    multiple: false,
    // Sin la copia a caché, en Android la URI es un content:// del proveedor
    // de otra app: no se puede copiar con copyAsync ni leer más tarde.
    copyToCacheDirectory: true,
  });

  const archivo = elegido.assets?.[0];
  if (elegido.canceled || !archivo) return { ok: false, motivo: 'cancelado' };

  // El tamaño que informa el selector puede faltar; el del archivo ya copiado
  // a caché, no. Se mira ese antes de copiar nada a la carpeta definitiva.
  const info = await FileSystem.getInfoAsync(archivo.uri, { size: true });
  const bytes = info.exists ? info.size : (archivo.size ?? 0);

  const motivo = rechazar(bytes);
  if (motivo) return { ok: false, motivo };

  await asegurarCarpeta();
  const nombreDisco = nombreEnDisco(nuevoId(), archivo.name);
  await FileSystem.copyAsync({ from: archivo.uri, to: uriDe(nombreDisco) });

  return {
    ok: true,
    adjunto: {
      archivo: nombreDisco,
      nombre: archivo.name,
      mime: archivo.mimeType ?? 'application/octet-stream',
      bytes,
    },
  };
}

/** ¿La copia sigue estando? Un backup restaurado no trae los archivos. */
export async function existe(adjunto: Adjunto): Promise<boolean> {
  const info = await FileSystem.getInfoAsync(uriDe(adjunto.archivo));
  return info.exists;
}

/**
 * Borra las copias que ya no menciona ningún mensaje.
 *
 * Se llama en el arranque y no al borrar un mensaje porque un borrado se
 * puede deshacer durante unos segundos: si el archivo se fuera con la fila,
 * el "deshacer" devolvería un mensaje con un adjunto roto. En el arranque no
 * hay ningún borrado pendiente de deshacer.
 *
 * Contar por referencias y no por mensaje también resuelve el caso del
 * recurrente: al archivar una repetición quedan dos filas apuntando al mismo
 * archivo, y borrar una no tiene que llevarse el archivo de la otra.
 */
export async function limpiarHuerfanos(enUso: string[]): Promise<number> {
  const info = await FileSystem.getInfoAsync(CARPETA);
  if (!info.exists) return 0;

  const vivos = new Set(enUso);
  const enDisco = await FileSystem.readDirectoryAsync(CARPETA);

  let borrados = 0;
  for (const nombre of enDisco) {
    if (vivos.has(nombre)) continue;
    try {
      await FileSystem.deleteAsync(uriDe(nombre), { idempotent: true });
      borrados += 1;
    } catch {
      // Si no se pudo borrar, se reintenta en el próximo arranque. Un archivo
      // de más ocupa lugar; fallar el arranque por eso sería peor.
    }
  }
  return borrados;
}
