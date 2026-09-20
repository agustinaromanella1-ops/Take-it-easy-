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

/**
 * Cuánto vive un borrador.
 *
 * Tiene que vencer. Un alta a medias guarda nombre, DNI, obra social y notas
 * —datos de salud identificables— y sin vencimiento eso quedaba en el teléfono
 * para siempre, y volvía a la pantalla meses después. Una semana alcanza de
 * sobra para retomar algo que se interrumpió; más que eso ya no es un
 * borrador, es un dato guardado sin que nadie lo pidiera.
 */
const VENCE_EN_MS = 7 * 24 * 60 * 60 * 1000;

export function guardarBorrador(clave: string, valor: unknown): void {
  try {
    localStorage.setItem(PREFIJO + clave, JSON.stringify({ guardadoEn: Date.now(), valor }));
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
    const guardado: unknown = JSON.parse(crudo);
    if (guardado === null || typeof guardado !== 'object') return null;
    const { guardadoEn, valor } = guardado as { guardadoEn?: unknown; valor?: unknown };
    if (typeof guardadoEn !== 'number' || Date.now() - guardadoEn > VENCE_EN_MS) {
      // Vencido, o de un formato viejo sin sello: se descarta y se limpia.
      limpiarBorrador(clave);
      return null;
    }
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

/**
 * Borra todos los borradores.
 *
 * Lo usa la importación de una copia: si se reemplazan los datos, un borrador
 * del dispositivo anterior con el nombre de otra persona adentro no tiene por
 * qué sobrevivir.
 */
export function limpiarTodosLosBorradores(): void {
  try {
    // Se recorre por índice y no con Object.keys: es la forma que define la
    // interfaz Storage, y funciona igual en el navegador y en las pruebas.
    const claves: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k !== null && k.startsWith(PREFIJO)) claves.push(k);
    }
    for (const k of claves) localStorage.removeItem(k);
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
