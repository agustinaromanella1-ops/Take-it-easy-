/**
 * Lo que se estaba escribiendo y todavía no se guardó.
 *
 * Cargar un paciente son quince campos. Si en el medio suena el timbre y la
 * pantalla se cierra —el toque afuera del cuadro, la app que el sistema
 * descarta para liberar memoria, la pestaña que se cierra sin querer—, lo
 * escrito se pierde y hay que volver a empezar. Volver a empezar es el punto
 * donde una tarea deja de hacerse.
 *
 * Por eso el borrador se guarda solo, sin botón y sin avisar, y se ofrece al
 * volver. No reemplaza a los datos: vive en su propia clave y se borra apenas
 * el formulario se guarda de verdad.
 */

const PREFIJO = 'pipicucu:borrador:';

export function guardarBorrador(clave: string, valor: unknown): void {
  try {
    localStorage.setItem(PREFIJO + clave, JSON.stringify(valor));
  } catch {
    /* Sin espacio o sin permiso: el formulario sigue funcionando igual. */
  }
}

/**
 * Devuelve el borrador guardado, o `null`.
 *
 * No valida la forma de lo que vuelve: quien lo pide sabe qué esperaba, y un
 * borrador roto se descarta solo cuando el formulario lo mezcla con sus
 * valores por defecto.
 */
export function leerBorrador<T>(clave: string): T | null {
  try {
    const crudo = localStorage.getItem(PREFIJO + clave);
    if (crudo === null) return null;
    const valor: unknown = JSON.parse(crudo);
    return valor !== null && typeof valor === 'object' ? (valor as T) : null;
  } catch {
    return null;
  }
}

export function limpiarBorrador(clave: string): void {
  try {
    localStorage.removeItem(PREFIJO + clave);
  } catch {
    /* Ídem. */
  }
}

/** Si un borrador tiene algo escrito, comparado con el formulario en blanco. */
export function tieneContenido<T extends object>(borrador: T, vacio: T): boolean {
  return (Object.keys(borrador) as (keyof T)[]).some((k) => {
    const v = borrador[k];
    // Solo cuenta lo que se escribe a mano. Un color o un desplegable que
    // quedó en otra opción no es "algo que se estaba cargando".
    if (typeof v === 'string') return v.trim() !== '' && v !== vacio[k];
    return false;
  });
}
