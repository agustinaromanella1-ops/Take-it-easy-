import { esIdentificatoria } from '../alumnos/particulas';

/**
 * El filtro de anonimización: ningún nombre de alumno sale del dispositivo.
 *
 * El principio que gobierna todo lo de acá es **errar por exceso**. Sustituir
 * de más deja un texto un poco raro; sustituir de menos es una fuga.
 */

export interface Persona {
  id: string;
  nombre: string;
  apellido: string;
}

export interface Contexto {
  alumnos: Persona[];
  /** El nombre de la docente tampoco viaja. */
  docente?: string;
  /** No identifican a un alumno, pero evitan marcar sospechas de más. */
  escuelas?: string[];
  materias?: string[];
}

export interface Sustitucion {
  /** Lo que estaba escrito, tal cual. */
  original: string;
  alias: string;
}

export interface TextoAnonimizado {
  /** Exactamente lo que se enviaría. */
  texto: string;
  sustituciones: Sustitucion[];
  /** Palabras que parecen un nombre que la app no conoce, esperando decisión. */
  sospechas: string[];
  /** Datos reemplazados por un marcador genérico. */
  datosQuitados: string[];
}

/**
 * El final no puede ser "cualquier cosa que no sea un espacio": con eso, en
 * "escribile a ana@correo.com, y llamala" la coma entra en la coincidencia y
 * desaparece del texto que se envía junto con el correo.
 */
const CORREO = /[^\s@]+@[^\s@]+\.\p{L}{2,}/gu;
const ENLACE = /\b(?:https?:\/\/|www\.)\S*[^\s.,;:!?)\]]/gi;
const ARROBA = /(?<![\w@])@\w{2,}/g;
/** Seis o más dígitos, con o sin separadores: documentos, teléfonos, matrículas. */
const NUMERO_LARGO = /\b\d[\d.\-\s]{4,}\d\b/g;

const ALIAS_DOCENTE = 'la docente';
const ALIAS_ESCUELA = 'la escuela';

/**
 * Lo que queda en lugar de un dato que no viaja. La pantalla de revisión los
 * resalta y usa `nombre` cuando la docente decide sacar una palabra marcada,
 * así que viven acá y no repetidos en cada archivo.
 */
export const MARCADORES = {
  correo: '[un correo]',
  enlace: '[un enlace]',
  numero: '[un número]',
  usuario: '[un usuario]',
  nombre: '[un nombre]',
} as const;

/**
 * Palabras que empiezan con mayúscula y no son nombres de persona. Sin esta
 * lista, "el lunes" o "la Revolución de Mayo" caerían como sospechas y la
 * pantalla de revisión se volvería ruido que nadie lee.
 */
const MAYUSCULAS_ESPERABLES = new Set([
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto',
  'septiembre', 'setiembre', 'octubre', 'noviembre', 'diciembre',
  'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo',
  'escuela', 'colegio', 'instituto', 'curso', 'division', 'aula', 'trimestre',
  'argentina', 'revolucion', 'independencia', 'nacion', 'provincia', 'mayo',
  'estudiante', 'estudiantes', 'alumno', 'alumna', 'alumnos', 'alumnas',
]);

const LETRAS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/**
 * Ruido ordinal alrededor del número de una escuela. Sin sacarlo, "Escuela
 * N.º 12" y "Escuela Nº 12" son dos frases distintas y la guardada no
 * coincide con la escrita.
 */
const ORDINAL = /^(?:n|no|nro|num|numero|nº|n°|º|°)$/;

/**
 * Los alias "la escuela" y "la docente" ya traen el artículo, y son femeninos.
 * Sin esto, "la Escuela N.º 12" quedaría como "la la escuela", y "el Colegio
 * San Martín" como "el la escuela".
 */
const DETERMINANTES = new Set([
  'el', 'la', 'un', 'una', 'mi', 'tu', 'su', 'este', 'esta', 'ese', 'esa',
  'nuestro', 'nuestra',
]);

/** "del Colegio" es "de el Colegio": se reemplaza el artículo, no la preposición. */
const CONTRACCIONES: Record<string, string> = { del: 'de ', al: 'a ' };

export function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

function palabrasDe(texto: string): string[] {
  return normalizar(texto).split(/[^\p{L}\p{N}]+/u).filter(Boolean);
}

interface Token {
  texto: string;
  inicio: number;
  fin: number;
  normalizada: string;
}

function tokenizar(texto: string): Token[] {
  return [...texto.matchAll(/[\p{L}\p{N}]+/gu)].map((m) => ({
    texto: m[0],
    inicio: m.index ?? 0,
    fin: (m.index ?? 0) + m[0].length,
    normalizada: normalizar(m[0]),
  }));
}

type Tipo = 'alumno' | 'docente' | 'escuela';

interface Entrada {
  clave: string;
  tipo: Tipo;
  palabras: Set<string>;
}

function entradasDe(contexto: Contexto): Entrada[] {
  const entradas: Entrada[] = [];

  for (const alumno of contexto.alumnos) {
    const palabras = new Set(
      palabrasDe(`${alumno.nombre} ${alumno.apellido}`).filter(esIdentificatoria),
    );
    if (palabras.size > 0) {
      entradas.push({ clave: alumno.id, tipo: 'alumno', palabras });
    }
  }

  if (contexto.docente) {
    const palabras = new Set(palabrasDe(contexto.docente).filter(esIdentificatoria));
    if (palabras.size > 0) entradas.push({ clave: 'docente', tipo: 'docente', palabras });
  }

  for (const escuela of contexto.escuelas ?? []) {
    const palabras = new Set(
      palabrasDe(escuela).filter((p) => esIdentificatoria(p) && !MAYUSCULAS_ESPERABLES.has(p)),
    );
    if (palabras.size > 0) {
      entradas.push({ clave: `escuela:${escuela}`, tipo: 'escuela', palabras });
    }
  }

  return entradas;
}

/**
 * La sesión del asistente. Guarda el mapa alias → texto original, que vive
 * **sólo en memoria**: no se persiste, no se serializa, no entra en el envío.
 */
export interface SesionDeAnonimizacion {
  anonimizar(texto: string): TextoAnonimizado;
  rePersonalizar(texto: string): string;
  /**
   * Segundo escaneo defensivo, sobre el texto final y ya editado a mano.
   * Devuelve los nombres que encontró: si devuelve alguno, no se envía.
   */
  nombresQueQuedaron(texto: string): string[];
  /**
   * Las palabras que parecen un nombre que la app no conoce, sobre el texto
   * que se enviaría. No crea alias ni toca el mapa, así que la pantalla de
   * revisión puede llamarla en cada tecla mientras la docente edita.
   */
  sospechasDe(texto: string): string[];
}

export function crearSesionDeAnonimizacion(contexto: Contexto): SesionDeAnonimizacion {
  const entradas = entradasDe(contexto);

  const porPalabra = new Map<string, Entrada[]>();
  for (const entrada of entradas) {
    for (const palabra of entrada.palabras) {
      const lista = porPalabra.get(palabra) ?? [];
      lista.push(entrada);
      porPalabra.set(palabra, lista);
    }
  }

  const vocabularioPropio = new Set([
    ...(contexto.materias ?? []).flatMap(palabrasDe),
    ...(contexto.escuelas ?? []).flatMap(palabrasDe),
  ]);

  /**
   * Una escuela se busca como frase y no palabra por palabra. En "Escuela
   * N.º 12" ninguna palabra identifica sola —"escuela" es común y "12" es un
   * número cualquiera, que suelto reemplazaría "tengo 12 alumnos"—, así que
   * por palabras no se sustituía nada y el nombre de la escuela viajaba
   * entero. Las más largas primero, para que la más específica gane.
   */
  const frasesDeEscuela = (contexto.escuelas ?? [])
    .map((nombre) => ({
      nombre,
      palabras: palabrasDe(nombre).filter((p) => !ORDINAL.test(p)),
    }))
    .filter((f) => f.palabras.length > 0)
    .sort((a, b) => b.palabras.length - a.palabras.length);

  // El mapa que no puede salir de acá.
  const aliasPorClave = new Map<string, string>();
  const originalPorAlias = new Map<string, string>();
  // Propio, y no el tamaño del mapa: si no, una escuela nombrada antes que un
  // alumno empujaría al primer alumno a "Estudiante B".
  let alumnosConAlias = 0;

  function aliasDe(clave: string, tipo: Tipo, original: string): string {
    const existente = aliasPorClave.get(clave);
    if (existente) return existente;

    const alias =
      tipo === 'docente'
        ? ALIAS_DOCENTE
        : tipo === 'escuela'
          ? ALIAS_ESCUELA
          : `Estudiante ${LETRAS[alumnosConAlias++ % LETRAS.length]}`;

    aliasPorClave.set(clave, alias);
    // El primero que aparece es el que vuelve al re-personalizar.
    if (!originalPorAlias.has(alias)) originalPorAlias.set(alias, original);
    return alias;
  }

  /**
   * Dónde termina la frase que empieza en `desde`, o `null` si no está. El
   * ruido ordinal se saltea de los dos lados, así "Escuela N.º 12", "Escuela
   * Nº 12" y "Escuela 12" son la misma escuela.
   */
  function finDeFrase(tokens: Token[], desde: number, palabras: string[]): number | null {
    let k = 0;
    let j = desde;
    while (k < palabras.length) {
      if (j >= tokens.length) return null;
      if (ORDINAL.test(tokens[j].normalizada)) {
        j += 1;
        continue;
      }
      if (tokens[j].normalizada !== palabras[k]) return null;
      j += 1;
      k += 1;
    }
    return j - 1;
  }

  function sustituirNombres(texto: string): { texto: string; sustituciones: Sustitucion[] } {
    const tokens = tokenizar(texto);
    const sustituciones: Sustitucion[] = [];
    const reemplazos: { inicio: number; fin: number; alias: string }[] = [];

    function anotar(desde: number, hasta: number, clave: string, tipo: Tipo) {
      const previa = tipo !== 'alumno' && desde > 0 ? tokens[desde - 1].normalizada : '';
      const contraccion = CONTRACCIONES[previa];

      // El artículo suelto entra en lo reemplazado, así "la escuela" vuelve a
      // ser "la Escuela N.º 12" en la respuesta y no "Escuela N.º 12" pelada.
      // La contracción no: de "del Colegio" se reemplaza "el Colegio" y queda
      // la preposición.
      const arranque = DETERMINANTES.has(previa) ? desde - 1 : desde;
      const original = texto.slice(tokens[arranque].inicio, tokens[hasta].fin);
      const alias = aliasDe(clave, tipo, original);

      reemplazos.push({
        inicio: contraccion ? tokens[desde - 1].inicio : tokens[arranque].inicio,
        fin: tokens[hasta].fin,
        alias: (contraccion ?? '') + alias,
      });
      sustituciones.push({ original, alias });
    }

    let i = 0;
    while (i < tokens.length) {
      const frase = frasesDeEscuela
        .map((f) => ({ nombre: f.nombre, fin: finDeFrase(tokens, i, f.palabras) }))
        .find((f) => f.fin !== null);

      if (frase?.fin != null) {
        anotar(i, frase.fin, `escuela:${frase.nombre}`, 'escuela');
        i = frase.fin + 1;
        continue;
      }

      const candidatas = porPalabra.get(tokens[i].normalizada);
      if (!candidatas) {
        i += 1;
        continue;
      }

      // "Malena Acuña" es una persona, no dos: si la palabra siguiente es del
      // mismo alumno, las dos entran en un solo alias.
      let fin = i;
      let elegidas = candidatas;
      const siguiente = tokens[i + 1];
      if (siguiente) {
        const juntas = candidatas.filter((e) => e.palabras.has(siguiente.normalizada));
        if (juntas.length > 0) {
          elegidas = juntas;
          fin = i + 1;
        }
      }

      const original = texto.slice(tokens[i].inicio, tokens[fin].fin);
      // Con dos alumnos que comparten apellido no se sabe cuál es: se sustituye
      // igual —errar por exceso— con un alias propio de esa palabra, que al
      // volver no se resuelve a nadie en vez de inventar a quién.
      const clave =
        elegidas.length === 1 ? elegidas[0].clave : `ambiguo:${normalizar(original)}`;
      const tipo = elegidas.length === 1 ? elegidas[0].tipo : 'alumno';

      anotar(i, fin, clave, tipo);

      i = fin + 1;
    }

    // De atrás para adelante, así los índices de los anteriores siguen valiendo.
    let resultado = texto;
    for (const r of [...reemplazos].reverse()) {
      resultado = resultado.slice(0, r.inicio) + r.alias + resultado.slice(r.fin);
    }
    return { texto: resultado, sustituciones };
  }

  function quitarDatos(texto: string): { texto: string; quitados: string[] } {
    const quitados: string[] = [];
    let resultado = texto;

    for (const [patron, marcador] of [
      [CORREO, MARCADORES.correo],
      [ENLACE, MARCADORES.enlace],
      [NUMERO_LARGO, MARCADORES.numero],
      [ARROBA, MARCADORES.usuario],
    ] as const) {
      resultado = resultado.replace(patron, (coincidencia) => {
        quitados.push(coincidencia.trim());
        return marcador;
      });
    }

    return { texto: resultado, quitados };
  }

  function buscarSospechas(texto: string): string[] {
    const sospechas = new Set<string>();
    // Una mayúscula después de punto es gramática, no un nombre.
    const inicioDeOracion = /(^|[.!?¿¡]\s*|\n\s*)$/;

    for (const token of tokenizar(texto)) {
      const empiezaConMayuscula = token.texto[0] !== token.texto[0].toLocaleLowerCase('es-AR');
      if (!empiezaConMayuscula) continue;
      if (token.texto === token.texto.toLocaleUpperCase('es-AR') && token.texto.length <= 3) {
        continue; // siglas cortas: 4.º A, TP
      }
      if (MAYUSCULAS_ESPERABLES.has(token.normalizada)) continue;
      if (vocabularioPropio.has(token.normalizada)) continue;
      if (token.normalizada === 'estudiante') continue;
      if (inicioDeOracion.test(texto.slice(0, token.inicio))) continue;

      sospechas.add(token.texto);
    }

    return [...sospechas];
  }

  return {
    anonimizar(texto: string): TextoAnonimizado {
      const nombres = sustituirNombres(texto);
      const sinDatos = quitarDatos(nombres.texto);
      return {
        texto: sinDatos.texto,
        sustituciones: nombres.sustituciones,
        sospechas: buscarSospechas(sinDatos.texto),
        datosQuitados: sinDatos.quitados,
      };
    },

    rePersonalizar(texto: string): string {
      // Los alias más largos primero: "Estudiante AB" antes que "Estudiante A".
      const alias = [...originalPorAlias.keys()].sort((a, b) => b.length - a.length);
      let resultado = texto;
      for (const a of alias) {
        resultado = resultado.split(a).join(originalPorAlias.get(a)!);
      }
      return resultado;
    },

    sospechasDe(texto: string): string[] {
      return buscarSospechas(texto);
    },

    nombresQueQuedaron(texto: string): string[] {
      const encontrados = new Set<string>();
      for (const token of tokenizar(texto)) {
        const entradas = porPalabra.get(token.normalizada);
        if (entradas?.some((e) => e.tipo === 'alumno')) encontrados.add(token.texto);
      }
      return [...encontrados];
    },

    /**
     * Si alguien intenta serializar la sesión —un store con persistencia, un
     * log, un reporte de fallo que captura el estado— que falle fuerte en vez
     * de escribir nombres de alumnos en disco sin que nadie se entere.
     */
    toJSON() {
      throw new Error('La sesión de anonimización no se serializa: vive sólo en memoria.');
    },
  } as SesionDeAnonimizacion;
}
