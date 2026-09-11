import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';

import { altaMasiva } from './alumnos';
import { marcarAsistencia } from './asistencia';
import {
  agregarBloque,
  bloqueSugerido,
  bloquesDeMateria,
  clasesDelDia,
  laQueSigue,
  quitarBloque,
} from './bloques';
import { claseDelDia } from './clases';
import { db } from './db';
import { inscribir } from './inscripciones';
import { archivarMateria, crearMateria } from './materias';

const jueves = '2026-09-10';
const viernes = '2026-09-11';

beforeEach(async () => {
  await db.delete();
  await db.open();
});

function materiaDePrueba(nombre: string) {
  return crearMateria({
    nombre, anio: '4', division: 'A', escuela: 'Escuela N.º 12', colorPastel: 'celeste',
  });
}

describe('bloques horarios', () => {
  it('se ordenan por día y después por hora', async () => {
    const materiaId = await materiaDePrueba('Historia');
    await agregarBloque({ materiaId, diaSemana: 4, horaInicio: '13:10', horaFin: '14:30' });
    await agregarBloque({ materiaId, diaSemana: 2, horaInicio: '09:20', horaFin: '10:40' });
    await agregarBloque({ materiaId, diaSemana: 4, horaInicio: '07:40', horaFin: '09:00' });

    const bloques = await bloquesDeMateria(materiaId);
    expect(bloques.map((b) => `${b.diaSemana} ${b.horaInicio}`)).toEqual([
      '2 09:20', '4 07:40', '4 13:10',
    ]);
  });

  it('quitar un bloque no borra la asistencia ya tomada', async () => {
    const materiaId = await materiaDePrueba('Historia');
    const bloqueId = await agregarBloque({
      materiaId, diaSemana: 4, horaInicio: '09:20', horaFin: '10:40',
    });
    const clase = await claseDelDia(materiaId, jueves, bloqueId);
    await marcarAsistencia({ claseSesionId: clase.id, alumnoId: 'a1', estado: 'presente' });

    await quitarBloque(bloqueId);

    expect(await db.registrosAsistencia.count()).toBe(1);
    expect(await db.clasesSesion.count()).toBe(1);
  });
});

describe('clases del día', () => {
  it('trae sólo las del día pedido, en orden de horario', async () => {
    const historia = await materiaDePrueba('Historia');
    const lengua = await materiaDePrueba('Lengua');
    await agregarBloque({ materiaId: historia, diaSemana: 4, horaInicio: '09:20', horaFin: '10:40' });
    await agregarBloque({ materiaId: lengua, diaSemana: 4, horaInicio: '07:40', horaFin: '09:00' });
    await agregarBloque({ materiaId: lengua, diaSemana: 5, horaInicio: '11:00', horaFin: '12:20' });

    const clases = await clasesDelDia(jueves);
    expect(clases.map((c) => `${c.bloque.horaInicio} ${c.materia.nombre}`)).toEqual([
      '07:40 Lengua', '09:20 Historia',
    ]);
    expect(await clasesDelDia(viernes)).toHaveLength(1);
  });

  it('mirar la pantalla no crea clases en la base', async () => {
    const materiaId = await materiaDePrueba('Historia');
    await agregarBloque({ materiaId, diaSemana: 4, horaInicio: '09:20', horaFin: '10:40' });

    await clasesDelDia(jueves);

    expect(await db.clasesSesion.count()).toBe(0);
  });

  it('cuenta lo registrado contra los inscriptos', async () => {
    const materiaId = await materiaDePrueba('Historia');
    const bloqueId = await agregarBloque({
      materiaId, diaSemana: 4, horaInicio: '09:20', horaFin: '10:40',
    });
    const { creados } = await altaMasiva([
      { apellido: 'Acuña', nombre: 'Malena' },
      { apellido: 'Barreto', nombre: 'Ignacio' },
    ]);
    await inscribir(materiaId, creados, jueves);
    const clase = await claseDelDia(materiaId, jueves, bloqueId);
    await marcarAsistencia({ claseSesionId: clase.id, alumnoId: creados[0], estado: 'presente' });

    const [hoy] = await clasesDelDia(jueves);
    expect(hoy).toMatchObject({ registrados: 1, inscriptos: 2 });
  });

  it('una materia archivada deja de tener clases', async () => {
    const materiaId = await materiaDePrueba('Historia');
    await agregarBloque({ materiaId, diaSemana: 4, horaInicio: '09:20', horaFin: '10:40' });

    await archivarMateria(materiaId);

    expect(await clasesDelDia(jueves)).toHaveLength(0);
  });
});

describe('la que sigue', () => {
  async function dosClases() {
    const materiaId = await materiaDePrueba('Historia');
    await agregarBloque({ materiaId, diaSemana: 4, horaInicio: '07:40', horaFin: '09:00' });
    await agregarBloque({ materiaId, diaSemana: 4, horaInicio: '11:00', horaFin: '12:20' });
    return clasesDelDia(jueves);
  }

  it('antes de empezar, es la primera', async () => {
    const clases = await dosClases();
    expect(laQueSigue(clases, 7 * 60)?.bloque.horaInicio).toBe('07:40');
  });

  it('durante una clase, es esa misma', async () => {
    const clases = await dosClases();
    expect(laQueSigue(clases, 8 * 60)?.bloque.horaInicio).toBe('07:40');
  });

  it('entre dos clases, es la siguiente', async () => {
    const clases = await dosClases();
    expect(laQueSigue(clases, 10 * 60)?.bloque.horaInicio).toBe('11:00');
  });

  it('terminada la jornada no hay ninguna', async () => {
    const clases = await dosClases();
    expect(laQueSigue(clases, 15 * 60)).toBeUndefined();
  });
});

describe('bloque sugerido al entrar sin decir cuál', () => {
  it('con una sola clase ese día, es esa', async () => {
    const materiaId = await materiaDePrueba('Historia');
    const bloqueId = await agregarBloque({
      materiaId, diaSemana: 4, horaInicio: '09:20', horaFin: '10:40',
    });

    expect(await bloqueSugerido(materiaId, jueves, 8 * 60)).toBe(bloqueId);
  });

  it('con dos el mismo día, la que corresponde a la hora', async () => {
    const materiaId = await materiaDePrueba('Historia');
    const temprano = await agregarBloque({
      materiaId, diaSemana: 4, horaInicio: '07:40', horaFin: '09:00',
    });
    const tarde = await agregarBloque({
      materiaId, diaSemana: 4, horaInicio: '13:10', horaFin: '14:30',
    });

    expect(await bloqueSugerido(materiaId, jueves, 8 * 60)).toBe(temprano);
    expect(await bloqueSugerido(materiaId, jueves, 12 * 60)).toBe(tarde);
    // Terminada la jornada, la última: es la que se acaba de dar.
    expect(await bloqueSugerido(materiaId, jueves, 20 * 60)).toBe(tarde);
  });

  it('un día sin clase de esa materia no sugiere ninguno', async () => {
    const materiaId = await materiaDePrueba('Historia');
    await agregarBloque({ materiaId, diaSemana: 4, horaInicio: '09:20', horaFin: '10:40' });

    expect(await bloqueSugerido(materiaId, viernes, 10 * 60)).toBeUndefined();
  });
});
