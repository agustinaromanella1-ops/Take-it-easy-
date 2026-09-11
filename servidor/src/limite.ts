/**
 * Límite de uso por instalación.
 *
 * El token de instalación es anónimo y sirve para esto y para nada más: que
 * una app con la URL del proxy no pueda gastar la cuenta de la docente. Vive
 * en memoria a propósito —el proxy no tiene base de datos (4.2)—, así que
 * reiniciar el servidor borra la cuenta. Es un tope de gasto, no un control
 * de acceso.
 */

export interface Limite {
  /** Cuántas consultas entran en la ventana. */
  porVentana: number;
  /** El largo de la ventana, en milisegundos. */
  ventanaMs: number;
}

export const POR_DEFECTO: Limite = { porVentana: 60, ventanaMs: 60 * 60 * 1000 };

export interface Veredicto {
  permitido: boolean;
  /** Cuánto falta para que se libere un lugar. Sólo cuando no está permitido. */
  esperarMs: number;
}

export function crearLimitador(limite: Limite = POR_DEFECTO) {
  const usos = new Map<string, number[]>();

  return {
    /** Cuenta una consulta y dice si se puede hacer. */
    consultar(instalacion: string, ahora = Date.now()): Veredicto {
      const desde = ahora - limite.ventanaMs;
      const previos = (usos.get(instalacion) ?? []).filter((t) => t > desde);

      if (previos.length >= limite.porVentana) {
        usos.set(instalacion, previos);
        // El más viejo es el que libera el lugar.
        const masViejo = previos[0] ?? ahora;
        return { permitido: false, esperarMs: masViejo + limite.ventanaMs - ahora };
      }

      usos.set(instalacion, [...previos, ahora]);
      return { permitido: true, esperarMs: 0 };
    },

    /**
     * Saca las instalaciones sin uso reciente. Sin esto, el mapa crece con
     * cada instalación que consultó una vez y nunca más.
     */
    limpiar(ahora = Date.now()): void {
      const desde = ahora - limite.ventanaMs;
      for (const [instalacion, marcas] of usos) {
        const vigentes = marcas.filter((t) => t > desde);
        if (vigentes.length === 0) usos.delete(instalacion);
        else usos.set(instalacion, vigentes);
      }
    },

    /** Cuántas instalaciones tiene en cuenta ahora mismo. Para poder probarlo. */
    get tamaño(): number {
      return usos.size;
    },
  };
}
