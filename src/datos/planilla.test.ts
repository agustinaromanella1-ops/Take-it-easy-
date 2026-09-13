import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';

import { agregarAlumnosAMateria } from './altaEnMateria';
import { ponerNotaFinal } from './boletin';
import { calificar } from './calificaciones';
import { db } from './db';
import { CONCEPTUAL_COMUN, NUMERICA_1_10 } from './escalas';
import { crearEvaluacion } from './evaluaciones';
import { celda, nombreDeLaPlanilla, planillaDeNotas } from './planilla';
import type { Id } from './tipos';

const materiaId = 'materia-1';
const ETIQUETAS = CONCEPTUAL_COMUN.tipo === 'conceptual' ? CONCEPTUAL_COMUN.etiquetas : [];

let ana: Id;

beforeEach(async () => {
  await db.delete();
  await db.open();
  await db.materias.add({
    id: materiaId, escuelaId: 'e1', nombre: 'Historia', anio: 4,
    division: 'A', colorPastel: 'lila', archivada: false,
  } as never);
  await agregarAlumnosAMateria(
    materiaId,
    [{ apellido: 'Acosta', nombre: 'Ana' }, { apellido: 'Benegas', nombre: 'Bruno' }],
    '2026-03-01',
  );
  ana = (await db.alumnos.orderBy('apellido').first())!.id;
});

const filas = (contenido: string) => contenido.replace(/^﻿/, '').trim().split('\r\n');

describe('la planilla de notas', () => {
  it('una fila por alumno y una columna por evaluación', async () => {
    const uno = await crearEvaluacion({ materiaId, nombre: 'Parcial 1', fecha: '2026-04-15', tipo: 'Parcial', escala: NUMERICA_1_10 });
    const dos = await crearEvaluacion({ materiaId, nombre: 'Carpeta', fecha: '2026-05-20', tipo: 'Carpeta', escala: CONCEPTUAL_COMUN });
    await calificar({ evaluacionId: uno, alumnoId: ana, valor: 6 });
    await calificar({ evaluacionId: dos, alumnoId: ana, valor: ETIQUETAS[2].id });
    await ponerNotaFinal(ana, materiaId, 7.5);

    const { contenido } = await planillaDeNotas(materiaId);
    const [encabezado, primera, segunda] = filas(contenido);

    expect(encabezado).toBe(
      'Apellido;Nombre;Parcial 1 (Parcial, 15/04/2026);Carpeta (Carpeta, 20/05/2026);Promedio;Nota final',
    );
    expect(primera).toBe(`Acosta;Ana;6;${ETIQUETAS[2].texto};6;7,5`);
    // A quien no tiene nada le quedan las celdas vacías, no se lo saltea.
    expect(segunda).toBe('Benegas;Bruno;;;;');
  });

  it('las evaluaciones van de la más vieja a la más nueva', async () => {
    await crearEvaluacion({ materiaId, nombre: 'Segundo', fecha: '2026-09-01', tipo: 'Parcial', escala: NUMERICA_1_10 });
    await crearEvaluacion({ materiaId, nombre: 'Primero', fecha: '2026-04-01', tipo: 'Parcial', escala: NUMERICA_1_10 });

    const { contenido } = await planillaDeNotas(materiaId);
    expect(filas(contenido)[0]).toMatch(/Apellido;Nombre;Primero .*;Segundo /);
  });

  it('los decimales van con coma, que es lo que espera una hoja en castellano', async () => {
    // Con punto, Excel en castellano lee "7.5" como texto y no como número.
    const uno = await crearEvaluacion({ materiaId, nombre: 'P1', fecha: '2026-04-15', tipo: 'Parcial', escala: NUMERICA_1_10 });
    await calificar({ evaluacionId: uno, alumnoId: ana, valor: 7.5 });
    await ponerNotaFinal(ana, materiaId, 8.25);

    const fila = filas((await planillaDeNotas(materiaId)).contenido)[1];
    expect(fila).toContain('7,5');
    expect(fila).toContain('8,25');
    expect(fila).not.toContain('.');
  });

  it('separa con punto y coma, no con coma', async () => {
    // Con comas, un "7,5" se parte en dos celdas y corre la fila entera.
    const { contenido } = await planillaDeNotas(materiaId);
    expect(filas(contenido)[0].startsWith('Apellido;Nombre;')).toBe(true);
  });

  it('empieza con la marca de UTF-8, si no los acentos salen rotos', async () => {
    const { contenido } = await planillaDeNotas(materiaId);
    expect(contenido.startsWith('﻿')).toBe(true);
  });

  it('termina las líneas como espera Excel', async () => {
    const { contenido } = await planillaDeNotas(materiaId);
    expect(contenido).toContain('\r\n');
  });

  it('no lleva observaciones: son privadas y esto se manda por correo', async () => {
    const { crearObservacion } = await import('./observaciones');
    await crearObservacion({ ambito: 'alumno', alumnoId: ana, materiaId, fecha: '2026-04-10', texto: 'Algo muy privado.' });

    const { contenido } = await planillaDeNotas(materiaId);
    expect(contenido).not.toContain('Algo muy privado');
  });

  it('cuenta lo que se está por mandar', async () => {
    await crearEvaluacion({ materiaId, nombre: 'P1', fecha: '2026-04-15', tipo: 'Parcial', escala: NUMERICA_1_10 });
    const p = await planillaDeNotas(materiaId);
    expect(p).toMatchObject({ alumnos: 2, evaluaciones: 1 });
  });
});

describe('las celdas que traen caracteres del separador', () => {
  it('una evaluación con punto y coma no corre la fila', () => {
    expect(celda('Parcial 1; recuperatorio')).toBe('"Parcial 1; recuperatorio"');
  });

  it('las comillas se duplican', () => {
    expect(celda('Trabajo "final"')).toBe('"Trabajo ""final"""');
  });

  it('lo que no las trae va tal cual', () => {
    expect(celda('Acosta')).toBe('Acosta');
  });

  it('de punta a punta', async () => {
    await crearEvaluacion({ materiaId, nombre: 'Parcial 1; con "todo"', fecha: '2026-04-15', tipo: 'Parcial', escala: NUMERICA_1_10 });
    const { contenido } = await planillaDeNotas(materiaId);
    expect(filas(contenido)[0]).toContain('"Parcial 1; con ""todo"" (Parcial, 15/04/2026)"');
  });
});

describe('el nombre del archivo', () => {
  it('dice la materia y el día', () => {
    expect(nombreDeLaPlanilla('Historia · 4.º A', new Date(2026, 8, 13))).toBe(
      'notas-historia-4-a-2026-09-13.csv',
    );
  });

  it('sin acentos ni espacios: viaja por correo y por WhatsApp', () => {
    expect(nombreDeLaPlanilla('Educación Física · 5.º B', new Date(2026, 11, 1))).toBe(
      'notas-educacion-fisica-5-b-2026-12-01.csv',
    );
  });

  it('no quedan guiones pegados ni repetidos', () => {
    expect(nombreDeLaPlanilla('  Historia  ·  4.º  A  ', new Date(2026, 0, 5))).toBe(
      'notas-historia-4-a-2026-01-05.csv',
    );
  });
});
