import { guardarPreferencia, leerPreferencia } from '../datos/preferencias';

/**
 * El token de instalación: anónimo, generado en el teléfono, y sirve para que
 * el proxy limite el uso. Para nada más. No es una cuenta, no identifica a la
 * docente y no viaja con ningún otro dato.
 */
const CLAVE = 'instalacion';

export async function tokenDeInstalacion(): Promise<string> {
  const guardado = await leerPreferencia<string>(CLAVE);
  if (guardado) return guardado;

  const nuevo = crypto.randomUUID();
  await guardarPreferencia(CLAVE, nuevo);
  return nuevo;
}
