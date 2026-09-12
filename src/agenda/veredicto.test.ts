import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Cuando el aviso inmediato llega y el programado no, quedan dos causas que se
 * ven iguales desde afuera. Esto es lo que las separa, así que conviene que no
 * mienta: decirle a alguien "es el ahorro de batería" cuando en realidad la app
 * nunca lo programó lo manda a tocar ajustes al azar.
 */

const pendientes: { id: number; schedule?: { at?: Date } }[] = [];

vi.mock('../nativo/plataforma', () => ({
  esNativa: () => true,
  plataforma: () => 'android',
}));

vi.mock('@capacitor/local-notifications', () => ({
  LocalNotifications: {
    getPending: async () => ({ notifications: pendientes }),
    schedule: async () => ({ notifications: [] }),
    cancel: async () => {},
    checkPermissions: async () => ({ display: 'granted' }),
    requestPermissions: async () => ({ display: 'granted' }),
  },
}));

const { db } = await import('../datos/db');
const { probarElAviso, quePasoConLaPrueba } = await import('./prueba');

const ID_DE_PRUEBA = 2_000_000_001;
const nueve = new Date(2026, 8, 15, 9, 0);
const nueveYDos = new Date(2026, 8, 15, 9, 2);

beforeEach(async () => {
  await db.delete();
  await db.open();
  pendientes.length = 0;
});

describe('qué pasó con el aviso de prueba', () => {
  it('sin ninguna prueba programada, no dice nada', async () => {
    expect(await quePasoConLaPrueba(nueve)).toBe('sin-prueba');
  });

  it('nunca inventa que se disparó un aviso que no existió', async () => {
    // Android no lo tiene anotado y la app tampoco programó nada: eso es
    // "no hay prueba", no "se disparó".
    pendientes.length = 0;
    expect(await quePasoConLaPrueba(nueve)).not.toBe('se-disparo');
  });

  it('antes de la hora, está esperando', async () => {
    await probarElAviso(nueve);
    pendientes.push({ id: ID_DE_PRUEBA, schedule: { at: new Date(2026, 8, 15, 9, 1) } });
    expect(await quePasoConLaPrueba(nueve)).toBe('esperando');
  });

  it('si Android lo sigue teniendo anotado y la hora pasó, no sonó', async () => {
    await probarElAviso(nueve);
    pendientes.push({ id: ID_DE_PRUEBA, schedule: { at: new Date(2026, 8, 15, 9, 1) } });
    expect(await quePasoConLaPrueba(nueveYDos)).toBe('no-sono');
  });

  it('si Android ya no lo tiene y la hora pasó, se disparó', async () => {
    await probarElAviso(nueve);
    pendientes.length = 0;
    expect(await quePasoConLaPrueba(nueveYDos)).toBe('se-disparo');
  });

  it('no confunde la prueba con otro aviso que ande dando vueltas', async () => {
    await probarElAviso(nueve);
    pendientes.push({ id: 12345, schedule: { at: new Date(2026, 8, 15, 9, 1) } });
    expect(await quePasoConLaPrueba(nueveYDos)).toBe('se-disparo');
  });
});
