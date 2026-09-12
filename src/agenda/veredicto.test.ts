import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Cuando el aviso inmediato llega y el programado no, quedan dos causas que se
 * ven iguales desde afuera. Esto es lo que las separa, así que conviene que no
 * mienta: decirle a alguien "es el ahorro de batería" cuando en realidad la app
 * nunca lo programó lo manda a tocar ajustes al azar.
 */

const pendientes: { id: number; schedule?: { at?: Date } }[] = [];
const enLaBarra: { id: number }[] = [];

vi.mock('../nativo/plataforma', () => ({
  esNativa: () => true,
  plataforma: () => 'android',
}));

vi.mock('@capacitor/local-notifications', () => ({
  LocalNotifications: {
    getPending: async () => ({ notifications: pendientes }),
    getDeliveredNotifications: async () => ({ notifications: enLaBarra }),
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
  enLaBarra.length = 0;
});

describe('qué pasó con el aviso de prueba', () => {
  it('sin ninguna prueba programada, no dice nada', async () => {
    expect(await quePasoConLaPrueba(nueve)).toBe('sin-prueba');
  });

  it('nunca dice que llegó un aviso que no existió', async () => {
    expect(await quePasoConLaPrueba(nueve)).toBe('sin-prueba');
  });

  it('antes de la hora, está esperando', async () => {
    await probarElAviso(nueve);
    expect(await quePasoConLaPrueba(nueve)).toBe('esperando');
  });

  it('si está en la barra de notificaciones, llegó', async () => {
    await probarElAviso(nueve);
    enLaBarra.push({ id: ID_DE_PRUEBA });
    expect(await quePasoConLaPrueba(nueveYDos)).toBe('llego');
  });

  it('pasó la hora y no está en la barra: no aparece', async () => {
    await probarElAviso(nueve);
    expect(await quePasoConLaPrueba(nueveYDos)).toBe('no-aparece');
  });

  it('no se confunde con otro aviso que esté en la barra', async () => {
    await probarElAviso(nueve);
    enLaBarra.push({ id: 12345 });
    expect(await quePasoConLaPrueba(nueveYDos)).toBe('no-aparece');
  });

  it('lo que el plugin tiene guardado no cuenta como prueba de que sonó', async () => {
    // El plugin no borra el aviso de su registro cuando se dispara, así que
    // `getPending` dice lo mismo haya sonado o no. Si el veredicto se apoyara
    // ahí, diría "llegó" sin que nadie haya visto nada.
    await probarElAviso(nueve);
    pendientes.push({ id: ID_DE_PRUEBA, schedule: { at: new Date(2026, 8, 15, 9, 1) } });
    expect(await quePasoConLaPrueba(nueveYDos)).toBe('no-aparece');
  });
});
