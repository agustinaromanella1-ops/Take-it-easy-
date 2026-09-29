/**
 * Consejos que aparecen la primera vez que se entra a cada pantalla.
 *
 * No son un tutorial que hay que atravesar: es un solo cartel por pantalla,
 * que se descarta y no vuelve. Mostrar varios a la vez sería el mismo
 * problema que se quiso evitar en el primer uso — información que nadie lee
 * porque tapa lo que se vino a hacer.
 */

export type Pantalla = 'programados' | 'nuevo' | 'plantillas' | 'ajustes';

export interface Consejo {
  id: string;
  pantalla: Pantalla;
  titulo: string;
  texto: string;
}

export const CONSEJOS: Consejo[] = [
  {
    id: 'empezar',
    pantalla: 'programados',
    titulo: 'Escribilo cuando lo pensás',
    texto: 'Tocá "＋ Nuevo mensaje", elegí a quién y cuándo, y olvidate. Te avisamos a esa hora.',
  },
  {
    id: 'atajos',
    pantalla: 'nuevo',
    titulo: 'No hace falta abrir el calendario',
    texto: 'Los atajos de arriba —"Mañana 9:00", "Lunes 9:00"— cubren casi todos los casos con un toque.',
  },
  {
    id: 'plantillas',
    pantalla: 'nuevo',
    titulo: '¿Mandás seguido algo parecido?',
    texto: 'Guardalo como plantilla con el enlace de abajo del texto. La próxima vez la elegís y completás solo lo que cambia.',
  },
  {
    id: 'llaves',
    pantalla: 'plantillas',
    titulo: 'Lo que va entre llaves',
    texto: 'Si escribís {nombre} o {día}, la app te lo va a preguntar cada vez que uses la plantilla. El resto del texto queda igual.',
  },
  {
    id: 'confirmar',
    pantalla: 'programados',
    titulo: 'El último paso es tuyo',
    texto: 'Cuando suene el aviso se abre WhatsApp con el texto ya escrito. Vos tocás enviar: WhatsApp no deja que otra app lo mande por vos.',
  },
  {
    id: 'puntualidad',
    pantalla: 'ajustes',
    titulo: 'Si los avisos llegan tarde',
    texto: 'Acá abajo están los dos ajustes de Android que lo resuelven. La app mide sola cuánto tardan y te avisa si se repite.',
  },
];

/**
 * El primer consejo sin ver de esa pantalla, o ninguno. De a uno: si se
 * mostraran todos juntos, el cartel taparía la pantalla entera.
 */
export function siguienteConsejo(
  pantalla: Pantalla,
  vistos: readonly string[],
): Consejo | null {
  return (
    CONSEJOS.find((c) => c.pantalla === pantalla && !vistos.includes(c.id)) ??
    null
  );
}

export function quedanConsejos(vistos: readonly string[]): boolean {
  return CONSEJOS.some((c) => !vistos.includes(c.id));
}
