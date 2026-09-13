import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  RecordatorioInvalidoError,
  agendarRecordatorio,
  borrarEntrada,
  cancelarRecordatorio,
  crearEntrada,
  entradasDelDia,
  entradasDesde,
  marcarEntregados,
  materiaDeLaEntrada,
  recordatoriosDe,
  recordatoriosPendientes,
} from '../datos/agenda';
import { db } from '../datos/db';
import { crearMateria } from '../datos/materias';
import { textoDelAviso } from './aviso';
import type { Id } from '../datos/tipos';

let materiaId: Id;

beforeEach(async () => {
  await db.delete();
  await db.open();
  materiaId = await crearMateria({
    nombre: 'Lengua', anio: '3', division: 'B', escuela: 'Escuela N.º 12', colorPastel: 'lila',
  });
});

describe('el texto de la notificación', () => {
  it('nunca lleva lo que escribió la docente', () => {
    // El título de la entrada no es un parámetro de esta función. No es que no
    // se use: no llega.
    expect(textoDelAviso({ caso: 'nota-de-clase', materia: 'Lengua · 3.º B' })).toEqual({
      titulo: 'Lengua · 3.º B',
      cuerpo: 'Tenés una nota para esta clase.',
    });
  });

  it('sin materia, ni siquiera dice de qué materia es', () => {
    expect(textoDelAviso({ caso: 'sin-materia' })).toEqual({
      titulo: 'Take It Easy',
      cuerpo: 'Tenés una nota para hoy.',
    });
  });

  it('ningún texto promete una hora: los recordatorios son inexactos', () => {
    const textos = [
      textoDelAviso({ caso: 'nota-de-clase', materia: 'X' }),
      textoDelAviso({ caso: 'evaluacion', materia: 'X' }),
      textoDelAviso({ caso: 'sin-materia' }),
    ];

    for (const { cuerpo } of textos) {
      expect(cuerpo).not.toMatch(/minuto|hora|ahora|en \d/i);
      expect(cuerpo).not.toContain('!');
    }
  });
});

describe('las entradas', () => {
  it('lo que viene sale primero, del día más cercano al más lejano', async () => {
    await crearEntrada({ fecha: '2026-09-20', titulo: 'Llevar los mapas' });
    await crearEntrada({ fecha: '2026-09-15', titulo: 'Devolver los parciales' });

    expect((await entradasDesde('2026-09-12')).map((e) => e.titulo)).toEqual([
      'Devolver los parciales',
      'Llevar los mapas',
    ]);
  });

  it('las de ayer no aparecen entre lo que viene', async () => {
    await crearEntrada({ fecha: '2026-09-01', titulo: 'Ya pasó' });

    expect(await entradasDesde('2026-09-12')).toEqual([]);
  });

  it('dos del mismo día se ordenan por título, y no al azar', async () => {
    await crearEntrada({ fecha: '2026-09-15', titulo: 'Zapatillas' });
    await crearEntrada({ fecha: '2026-09-15', titulo: 'Álbum' });
    await crearEntrada({ fecha: '2026-09-15', titulo: 'Mapas' });

    expect((await entradasDelDia('2026-09-15')).map((e) => e.titulo)).toEqual([
      'Álbum', 'Mapas', 'Zapatillas',
    ]);
  });

  it('la materia de la entrada es la que va en el título de la notificación', async () => {
    const id = await crearEntrada({ materiaId, fecha: '2026-09-15', titulo: 'Llevar mapas' });
    const entrada = (await db.entradasAgenda.get(id))!;

    expect(await materiaDeLaEntrada(entrada)).toBe('Lengua · 3.º B');
  });
});

describe('los recordatorios', () => {
  it('borrar la entrada devuelve sus notificaciones para poder apagarlas', async () => {
    const entradaId = await crearEntrada({ fecha: '2026-09-15', titulo: 'Mapas' });
    const uno = await agendarRecordatorio(
      { entradaAgendaId: entradaId, fechaHoraLocal: '2026-09-15T07:30' },
      new Date('2026-09-12T10:00'),
    );

    const apagar = await borrarEntrada(entradaId);

    expect(apagar).toEqual([uno.idNotificacion]);
    expect(await db.recordatorios.count()).toBe(0);
  });

  it('un aviso para un momento que ya pasó se rechaza: no sonaría nunca', async () => {
    const entradaId = await crearEntrada({ fecha: '2026-09-15', titulo: 'Mapas' });

    await expect(
      agendarRecordatorio(
        { entradaAgendaId: entradaId, fechaHoraLocal: '2026-09-10T07:30' },
        new Date('2026-09-12T10:00'),
      ),
    ).rejects.toThrow(RecordatorioInvalidoError);
    expect(await db.recordatorios.count()).toBe(0);
  });

  it('el id de notificación entra en 32 bits, que es lo que Android acepta', async () => {
    const entradaId = await crearEntrada({ fecha: '2026-09-15', titulo: 'Mapas' });

    for (let i = 0; i < 20; i += 1) {
      const r = await agendarRecordatorio(
        { entradaAgendaId: entradaId, fechaHoraLocal: '2026-09-15T07:30' },
        new Date('2026-09-12T10:00'),
      );
      expect(Number.isInteger(r.idNotificacion)).toBe(true);
      expect(r.idNotificacion).toBeGreaterThan(0);
      expect(r.idNotificacion).toBeLessThan(2 ** 31);
    }
  });

  it('cancelar devuelve qué notificación apagar y lo deja anotado', async () => {
    const entradaId = await crearEntrada({ fecha: '2026-09-15', titulo: 'Mapas' });
    const r = await agendarRecordatorio(
      { entradaAgendaId: entradaId, fechaHoraLocal: '2026-09-15T07:30' },
      new Date('2026-09-12T10:00'),
    );

    expect(await cancelarRecordatorio(r.id)).toBe(r.idNotificacion);
    expect((await recordatoriosDe(entradaId))[0].estado).toBe('cancelado');
  });

  it('pendiente es el que todavía no sonó', async () => {
    const entradaId = await crearEntrada({ fecha: '2026-09-15', titulo: 'Mapas' });
    const antes = new Date('2026-09-09T10:00');
    await agendarRecordatorio({ entradaAgendaId: entradaId, fechaHoraLocal: '2026-09-15T07:30' }, antes);
    await agendarRecordatorio({ entradaAgendaId: entradaId, fechaHoraLocal: '2026-09-10T07:30' }, antes);

    const pendientes = await recordatoriosPendientes(new Date('2026-09-12T10:00'));

    expect(pendientes).toHaveLength(1);
    expect(pendientes[0].fechaHoraLocal).toBe('2026-09-15T07:30');
  });

  it('un cancelado no vuelve como pendiente', async () => {
    const entradaId = await crearEntrada({ fecha: '2026-09-15', titulo: 'Mapas' });
    const r = await agendarRecordatorio(
      { entradaAgendaId: entradaId, fechaHoraLocal: '2026-09-15T07:30' },
      new Date('2026-09-12T10:00'),
    );
    await cancelarRecordatorio(r.id);

    expect(await recordatoriosPendientes(new Date('2026-09-12T10:00'))).toEqual([]);
  });

  it('los que ya pasaron se marcan entregados en vez de quedar programados para siempre', async () => {
    const entradaId = await crearEntrada({ fecha: '2026-09-10', titulo: 'Mapas' });
    await agendarRecordatorio(
      { entradaAgendaId: entradaId, fechaHoraLocal: '2026-09-10T07:30' },
      new Date('2026-09-09T10:00'),
    );

    expect(await marcarEntregados(new Date('2026-09-12T10:00'))).toBe(1);
    expect((await recordatoriosDe(entradaId))[0].estado).toBe('entregado');
  });
});
