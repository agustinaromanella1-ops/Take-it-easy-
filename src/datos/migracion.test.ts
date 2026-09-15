import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { beforeEach, describe, expect, it } from 'vitest';

import { BaseTakeItEasy, VERSION_ESQUEMA } from './db';

/**
 * La versión 4 saca las capas de la observación. Lo que importa acá no es el
 * índice —eso lo hace Dexie— sino lo que ya está guardado en el teléfono de
 * alguien: si el campo quedara, quedaría escrito que algo se marcó alguna vez
 * como compartible, en una app donde compartir ya no existe.
 */

const NOMBRE = 'prueba-migracion';

/** La base como era antes, para poder guardar algo con capa. */
function baseVieja() {
  const vieja = new Dexie(NOMBRE);
  vieja.version(3).stores({
    escuelas: 'id',
    materias: 'id, escuelaId',
    bloquesHorario: 'id, materiaId, diaSemana',
    alumnos: 'id, apellido',
    inscripciones: 'id, alumnoId, materiaId, &[alumnoId+materiaId]',
    clasesSesion: 'id, materiaId, fecha, &[materiaId+fecha+bloqueHorarioId]',
    registrosAsistencia: 'id, claseSesionId, alumnoId, &[claseSesionId+alumnoId]',
    evaluaciones: 'id, materiaId, fecha',
    calificaciones: 'id, evaluacionId, alumnoId, &[evaluacionId+alumnoId]',
    observaciones: 'id, alumnoId, materiaId, fecha, capa',
    plantillas: 'id, ambito',
    entradasAgenda: 'id, materiaId, fecha',
    recordatorios: 'id, entradaAgendaId, fechaHoraLocal',
    borradores: 'clave',
    preferencias: 'clave',
  });
  return vieja;
}

beforeEach(async () => {
  await Dexie.delete(NOMBRE);
});

describe('al actualizar a la versión sin capas', () => {
  it('las observaciones que ya estaban pierden el campo', async () => {
    const vieja = baseVieja();
    await vieja.open();
    await vieja.table('observaciones').bulkAdd([
      { id: 'o1', ambito: 'alumno', alumnoId: 'a1', materiaId: 'm1', fecha: '2026-04-10', texto: 'Entregó tarde.', capa: 'privada', creadoEn: 1 },
      { id: 'o2', ambito: 'alumno', alumnoId: 'a1', materiaId: 'm1', fecha: '2026-04-11', texto: 'Faltó.', capa: 'compartible', creadoEn: 2 },
    ]);
    vieja.close();

    const nueva = new BaseTakeItEasy(NOMBRE);
    await nueva.open();
    const guardadas = await nueva.observaciones.orderBy('fecha').toArray();
    nueva.close();

    expect(guardadas).toHaveLength(2);
    for (const o of guardadas) expect(o).not.toHaveProperty('capa');
  });

  it('no se pierde nada de lo escrito', async () => {
    const vieja = baseVieja();
    await vieja.open();
    await vieja.table('observaciones').add({
      id: 'o1', ambito: 'alumno', alumnoId: 'a1', materiaId: 'm1',
      fecha: '2026-04-10', texto: 'No entregó el trabajo. Pidió una semana más.',
      capa: 'compartible', creadoEn: 7,
    });
    vieja.close();

    const nueva = new BaseTakeItEasy(NOMBRE);
    await nueva.open();
    const o = await nueva.observaciones.get('o1');
    nueva.close();

    expect(o).toMatchObject({
      id: 'o1',
      alumnoId: 'a1',
      materiaId: 'm1',
      fecha: '2026-04-10',
      texto: 'No entregó el trabajo. Pidió una semana más.',
      creadoEn: 7,
    });
  });

  it('la app dice que entiende la versión 4', () => {
    // La copia de seguridad la guarda para rechazar un archivo más nuevo. Si
    // no sube, una copia hecha con capas se leería como si fuera de ahora.
    expect(VERSION_ESQUEMA).toBe(4);
  });
});
