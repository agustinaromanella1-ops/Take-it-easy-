import { comoSeEscribe } from './escalas';
import { evaluacionesDeMateria } from './evaluaciones';
import { db } from './db';
import { alumnosInscriptos } from './inscripciones';
import { promedioDeAlumno } from './calificaciones';
import { comoSeLlama } from './materias';
import type { Escala, Id } from './tipos';

/**
 * La planilla de notas de una materia, para abrirla en una hoja de cálculo.
 *
 * Sale en CSV y no en .xlsx. Un .xlsx es un zip de archivos XML: armarlo sin
 * una biblioteca es escribir un zip a mano, y con una biblioteca es sumarle
 * megas a una app que pesa cuatro. El CSV lo abre Excel con doble clic, lo
 * abre Google Sheets, y desde ahí se guarda como .xlsx en un toque.
 *
 * Lleva sólo notas. Las observaciones no salen: son privadas y una planilla se
 * manda por correo.
 */

/**
 * Punto y coma, no coma.
 *
 * Excel en castellano usa la coma como separador decimal, así que espera punto
 * y coma entre columnas. Con comas, un «7,5» se parte en dos celdas y la
 * planilla entera queda corrida.
 */
const SEPARADOR = ';';

/**
 * Las tres letras invisibles que le dicen a Excel que el archivo está en
 * UTF-8. Sin ellas, al abrirlo con doble clic, «Benegas, Tobías» aparece como
 * «TobÃ­as».
 */
const MARCA_UTF8 = '﻿';

/** Excel espera fin de línea de Windows. */
const FIN_DE_LINEA = '\r\n';

export interface PlanillaDeNotas {
  nombreDeArchivo: string;
  contenido: string;
  /** Para poder decir en pantalla qué se está por mandar. */
  alumnos: number;
  evaluaciones: number;
}

export async function planillaDeNotas(
  materiaId: Id,
  momento = new Date(),
): Promise<PlanillaDeNotas> {
  const materia = await db.materias.get(materiaId);
  if (!materia) throw new Error('La materia no existe.');

  // De la más vieja a la más nueva, como se lee un año.
  const evaluaciones = (await evaluacionesDeMateria(materiaId)).reverse();
  const alumnos = await alumnosInscriptos(materiaId);
  const inscripciones = await db.inscripciones.where('materiaId').equals(materiaId).toArray();
  const finalPorAlumno = new Map(inscripciones.map((i) => [i.alumnoId, i.notaFinal]));

  const encabezado = [
    'Apellido',
    'Nombre',
    ...evaluaciones.map((e) => `${e.nombre} (${e.tipo}, ${comoSeLeeLaFecha(e.fecha)})`),
    'Promedio',
    'Nota final',
  ];

  const filas: string[][] = [];
  for (const alumno of alumnos) {
    const suyas = await db.calificaciones.where('alumnoId').equals(alumno.id).toArray();
    const porEvaluacion = new Map(suyas.map((c) => [c.evaluacionId, c.valor]));
    const promedio = await promedioDeAlumno(alumno.id, materiaId);
    const final = finalPorAlumno.get(alumno.id);

    filas.push([
      alumno.apellido,
      alumno.nombre,
      ...evaluaciones.map((e) => comoSeLee(e.escala, porEvaluacion.get(e.id) ?? null)),
      promedio.valor === null ? '' : conComa(promedio.valor),
      final === undefined ? '' : conComa(final),
    ]);
  }

  const contenido =
    MARCA_UTF8 +
    [encabezado, ...filas].map((f) => f.map(celda).join(SEPARADOR)).join(FIN_DE_LINEA) +
    FIN_DE_LINEA;

  return {
    nombreDeArchivo: nombreDeLaPlanilla(comoSeLlama(materia), momento),
    contenido,
    alumnos: alumnos.length,
    evaluaciones: evaluaciones.length,
  };
}

/** Una nota, como se escribe: el número con coma, o la etiqueta conceptual. */
function comoSeLee(escala: Escala, valor: number | Id | null): string {
  if (valor === null) return '';
  if (escala.tipo === 'conceptual') {
    return escala.etiquetas.find((e) => e.id === valor)?.texto ?? '';
  }
  return typeof valor === 'number' ? conComa(valor) : '';
}

/** Coma decimal, que es lo que entiende una hoja de cálculo en castellano. */
function conComa(valor: number): string {
  return comoSeEscribe({ tipo: 'numerica', min: 1, max: 10, decimales: 2 }, valor).replace('.', ',');
}

function comoSeLeeLaFecha(fecha: string): string {
  const [anio, mes, dia] = fecha.split('-');
  return `${dia}/${mes}/${anio}`;
}

/**
 * Una celda con punto y coma, comillas o un salto de línea adentro va entre
 * comillas, y las comillas de adentro se duplican. Sin esto, una evaluación
 * llamada «Parcial 1; recuperatorio» corre toda la fila una columna.
 */
export function celda(texto: string): string {
  if (!/[;"\r\n]/.test(texto)) return texto;
  return `"${texto.replace(/"/g, '""')}"`;
}

/** Sin acentos ni espacios: viaja por correo y por WhatsApp. */
export function nombreDeLaPlanilla(materia: string, momento: Date): string {
  const mes = String(momento.getMonth() + 1).padStart(2, '0');
  const dia = String(momento.getDate()).padStart(2, '0');
  const limpio = materia
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
  return `notas-${limpio}-${momento.getFullYear()}-${mes}-${dia}.csv`;
}
