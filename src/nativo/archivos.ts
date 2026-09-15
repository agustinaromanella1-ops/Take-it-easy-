// Las pantallas no llaman plugins de Capacitor directo: pasan por un módulo
// propio por función, para que cambiar de plugin sea tocar un solo archivo.

import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

import { esNativa } from './plataforma';

/**
 * Deja el archivo donde la docente elija. En el teléfono se escribe en la
 * carpeta temporal y se abre el menú de compartir de Android, que es donde
 * decide el destino; en el navegador se descarga.
 *
 * El archivo tiene nombres de alumnos, así que el destino lo elige ella y la
 * app no lo deja en ninguna carpeta fija.
 */
export async function guardarArchivo(
  nombre: string,
  contenido: string,
  tipo = 'application/json',
): Promise<void> {
  if (!esNativa()) {
    const url = URL.createObjectURL(new Blob([contenido], { type: tipo }));
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = nombre;
    enlace.click();
    URL.revokeObjectURL(url);
    return;
  }

  const escrito = await Filesystem.writeFile({
    path: nombre,
    data: contenido,
    directory: Directory.Cache,
    encoding: Encoding.UTF8,
  });

  await Share.share({ title: nombre, files: [escrito.uri] });
}
