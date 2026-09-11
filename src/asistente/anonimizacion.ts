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

const CORREO = /\S+@\S+\.\S+/g;
const ENLACE = /\b(?:https?:\/\/|www\.)\S+/gi;
const ARROBA = /(?<![\w@])@\w{2,}/g;
/** Seis o más dígitos, con o sin separadores: documentos, teléfonos, matrículas. */
const NUMERO_LARGO = /\b\d[\d.\-\s]{4,}\d\b/g;

const ALIAS_DOCENTE = 'la docente';
const ALIAS_ESCUELA = 'la escuela';

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

  // El mapa que no puede salir de acá.
  const aliasPorClave = new Map<string, string>();
  const originalPorAlias = new Map<string, string>();

  function aliasDe(clave: string, tipo: Tipo, original: string): string {
    const existente = aliasPorClave.get(clave);
    if (existente) return existente;

    const alias =
      tipo === 'docente'
        ? ALIAS_DOCENTE
        : tipo === 'escuela'
          ? ALIAS_ESCUELA
          : `Estudiante ${LETRAS[aliasPorClave.size % LETRAS.length]}`;

    aliasPorClave.set(clave, alias);
    // El primero que aparece es el que vuelve al re-personalizar.
    if (!originalPorAlias.has(alias)) originalPorAlias.set(alias, original);
    return alias;
  }

  function sustituirNombres(texto: string): { texto: string; sustituciones: Sustitucion[] } {
    const tokens = tokenizar(texto);
    const sustituciones: Sustitucion[] = [];
    const reemplazos: { inicio: number; fin: number; alias: string }[] = [];

    let i = 0;
    while (i < tokens.length) {
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

      const alias = aliasDe(clave, tipo, original);
      reemplazos.push({ inicio: tokens[i].inicio, fin: tokens[fin].fin, alias });
      sustituciones.push({ original, alias });

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
      [CORREO, '[un correo]'],
      [ENLACE, '[un enlace]'],
      [NUMERO_LARGO, '[un número]'],
      [ARROBA, '[un usuario]'],
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
