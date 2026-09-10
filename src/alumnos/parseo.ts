export type Confianza = 'alta' | 'revisar';

export interface FilaParseada {
  /** La línea original, para que la docente pueda comparar. */
  linea: string;
  apellido: string;
  nombre: string;
  confianza: Confianza;
  motivo?: string;
  /** Datos que la app no guarda y se quitaron de la línea. */
  descartado: string[];
}

const PALABRAS_DE_ENCABEZADO = new Set([
  'apellido', 'apellidos', 'nombre', 'nombres', 'alumno', 'alumna', 'alumnos',
  'alumnas', 'estudiante', 'estudiantes', 'y', 'n', 'nro', 'numero', 'orden',
  'dni', 'documento', 'curso', 'division', 'lista',
]);

const CORREO = /\S+@\S+\.\S+/g;
/** Cualquier cosa con seis o más dígitos: DNI, teléfono, matrícula. */
const NUMERO_LARGO = /\b[\d][\d.\-\s]{4,}[\d]\b/g;

function sinAcentos(texto: string): string {
  return texto.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

function esEncabezado(linea: string): boolean {
  const palabras = sinAcentos(linea)
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
  return palabras.length > 0 && palabras.every((p) => PALABRAS_DE_ENCABEZADO.has(p));
}

function quitarNumeracion(linea: string): string {
  return linea.replace(/^\s*\d{1,3}\s*[.)\]:\-–]\s*/, '');
}

function quitarDatosQueNoSeGuardan(linea: string): { limpia: string; descartado: string[] } {
  const descartado: string[] = [];
  let limpia = linea;

  for (const patron of [CORREO, NUMERO_LARGO]) {
    limpia = limpia.replace(patron, (coincidencia) => {
      descartado.push(coincidencia.trim());
      return ' ';
    });
  }

  return { limpia, descartado };
}

function enMayusculas(palabra: string): boolean {
  const letras = palabra.replace(/[^\p{L}]/gu, '');
  return letras.length > 1 && letras === letras.toUpperCase();
}

const PARTICULAS = new Set(['de', 'del', 'la', 'las', 'lo', 'los', 'y', 'da', 'di', 'van', 'von']);

function capitalizar(texto: string): string {
  return texto
    .toLocaleLowerCase('es-AR')
    .replace(/\p{L}+/gu, (palabra) =>
      PARTICULAS.has(palabra)
        ? palabra
        : palabra.charAt(0).toLocaleUpperCase('es-AR') + palabra.slice(1),
    );
}

/** Quitar un dato del medio de la línea deja separadores sueltos en los bordes. */
function limpiarBordes(texto: string): string {
  return texto.replace(/^[\s,;|·-]+|[\s,;|·-]+$/g, '');
}

function partir(limpia: string): Omit<FilaParseada, 'linea' | 'descartado'> {
  const texto = limpiarBordes(limpia.replace(/\s+/g, ' '));

  const coma = texto.indexOf(',');
  if (coma !== -1) {
    // "Acuña, Malena" no tiene ambigüedad posible: antes de la coma va el apellido.
    return {
      apellido: capitalizar(limpiarBordes(texto.slice(0, coma))),
      nombre: capitalizar(limpiarBordes(texto.slice(coma + 1))),
      confianza: 'alta',
    };
  }

  const separadoPorColumnas = limpia
    .split(/\t|\s{2,}/)
    .map(limpiarBordes)
    .filter(Boolean);
  if (separadoPorColumnas.length >= 2) {
    const [apellido, ...resto] = separadoPorColumnas;
    return {
      apellido: capitalizar(apellido),
      nombre: capitalizar(resto.join(' ')),
      confianza: 'alta',
    };
  }

  const palabras = texto.split(' ').filter(Boolean);

  // En las listas de escuela el apellido suele venir en mayúsculas.
  const mayusculas = palabras.filter(enMayusculas);
  if (mayusculas.length > 0 && mayusculas.length < palabras.length) {
    return {
      apellido: capitalizar(mayusculas.join(' ')),
      nombre: capitalizar(palabras.filter((p) => !enMayusculas(p)).join(' ')),
      confianza: 'alta',
    };
  }

  if (palabras.length === 2) {
    return {
      apellido: capitalizar(palabras[0]),
      nombre: capitalizar(palabras[1]),
      confianza: 'revisar',
      motivo: 'No se sabe cuál de los dos es el apellido.',
    };
  }

  if (palabras.length > 2) {
    return {
      apellido: capitalizar(palabras[0]),
      nombre: capitalizar(palabras.slice(1).join(' ')),
      confianza: 'revisar',
      motivo: 'Son varias palabras y no hay coma que las separe.',
    };
  }

  return {
    apellido: capitalizar(texto),
    nombre: '',
    confianza: 'revisar',
    motivo: 'Falta el nombre.',
  };
}

export function parsearLista(texto: string): FilaParseada[] {
  return texto
    .split(/\r?\n/)
    .map((linea) => linea.trim())
    .filter((linea) => linea.length > 0 && !esEncabezado(linea))
    .map((linea) => {
      const { limpia, descartado } = quitarDatosQueNoSeGuardan(quitarNumeracion(linea));
      const partida = partir(limpia);
      return { linea, descartado, ...partida };
    })
    .filter((fila) => fila.apellido.length > 0 || fila.nombre.length > 0);
}

export function estanCompletas(filas: FilaParseada[]): boolean {
  return filas.every((fila) => fila.apellido.trim() !== '' && fila.nombre.trim() !== '');
}
