import {
  MARCADORES,
  datosDeContacto,
  type SesionDeAnonimizacion,
  type Sustitucion,
} from './anonimizacion';

/**
 * La lógica de la pantalla de revisión, aparte de la pantalla para poder
 * probarla. Es el último lugar donde se puede evitar que un nombre salga del
 * teléfono, así que lo que decide qué se envía no puede estar mezclado con
 * cómo se ve.
 */

export interface Revision {
  /** Palabras que parecen un nombre y todavía no tienen decisión. */
  sospechas: string[];
  /**
   * Nombres conocidos que quedaron en el texto final. Pasa cuando la docente
   * reescribe uno a mano en esta pantalla; mientras haya alguno, no se envía.
   */
  nombres: string[];
  /**
   * Correos, enlaces y números largos escritos a mano acá. El filtro los
   * reemplaza al entrar, pero lo que se escribe después no pasa por el filtro:
   * sin revisarlo de nuevo, un correo tipeado en la edición se enviaría tal
   * cual.
   */
  datos: string[];
  sePuedeEnviar: boolean;
}

/**
 * El segundo escaneo defensivo del pipeline, sobre el texto que se enviaría
 * —ya con las ediciones a mano—. Se llama en cada tecla y otra vez al tocar
 * enviar: que el botón esté deshabilitado no es garantía de nada.
 */
export function revisar(
  sesion: SesionDeAnonimizacion,
  texto: string,
  permitidas: readonly string[],
): Revision {
  const nombres = sesion.nombresQueQuedaron(texto);
  // Un nombre conocido no se ofrece como duda: preguntarle a la docente si
  // "Malena" es un nombre, al lado del cartel que dice que lo es, invita a
  // contestar que no y a creer que con eso se destraba.
  const sospechas = sesion
    .sospechasDe(texto)
    .filter((p) => !permitidas.includes(p) && !nombres.includes(p));

  const datos = datosDeContacto(texto);

  return {
    sospechas,
    nombres,
    datos,
    sePuedeEnviar:
      nombres.length === 0 &&
      sospechas.length === 0 &&
      datos.length === 0 &&
      texto.trim() !== '',
  };
}

function escapar(texto: string): string {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Saca una palabra del texto y deja el marcador en su lugar.
 *
 * El límite de palabra se arma con letras Unicode y no con `\b`, que es ASCII:
 * con `\b`, "Martín" no coincidiría, porque entre la "n" final y el espacio
 * hay borde, pero entre una "í" y un espacio no lo hay para el motor.
 */
export function sacar(texto: string, palabra: string): string {
  const patron = new RegExp(`(?<![\\p{L}\\p{N}])${escapar(palabra)}(?![\\p{L}\\p{N}])`, 'gu');
  return texto.replace(patron, MARCADORES.nombre);
}

export interface Trozo {
  texto: string;
  /** Lo que reemplazó a un dato que no viaja. */
  resaltado: boolean;
}

/**
 * Parte el texto para poder mostrar resaltado lo que la app reemplazó. Sin
 * esto la revisión es un bloque de texto en el que hay que buscar a ojo qué
 * cambió, que es tanto como no revisar.
 */
export function trozos(texto: string, resaltados: readonly string[]): Trozo[] {
  const unicos = [...new Set(resaltados)].filter(Boolean);
  if (unicos.length === 0) return texto === '' ? [] : [{ texto, resaltado: false }];

  // Los más largos primero, para que "Estudiante A" no gane sobre uno más
  // específico que lo contenga.
  const patron = new RegExp(
    unicos.sort((a, b) => b.length - a.length).map(escapar).join('|'),
    'g',
  );

  const partes: Trozo[] = [];
  let desde = 0;
  for (const coincidencia of texto.matchAll(patron)) {
    const inicio = coincidencia.index;
    if (inicio > desde) partes.push({ texto: texto.slice(desde, inicio), resaltado: false });
    partes.push({ texto: coincidencia[0], resaltado: true });
    desde = inicio + coincidencia[0].length;
  }
  if (desde < texto.length) partes.push({ texto: texto.slice(desde), resaltado: false });

  return partes;
}

/** Todo lo que la pantalla resalta: los alias de los nombres y los marcadores. */
export function loResaltado(sustituciones: readonly Sustitucion[]): string[] {
  return [...sustituciones.map((s) => s.alias), ...Object.values(MARCADORES)];
}
