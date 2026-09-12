import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Las dos opciones con que se programa un aviso no se ven en ninguna pantalla
 * y son las que deciden si suena. Un `schedule({ at })` pelado compila, anda en
 * el navegador, pasa la revisión, y en el teléfono no llega nunca.
 */

const plugin = {
  schedule: vi.fn(),
  cancel: vi.fn(),
  getPending: vi.fn(),
  checkPermissions: vi.fn(),
  requestPermissions: vi.fn(),
};

let esNativaAhora = true;

vi.mock('@capacitor/local-notifications', () => ({ LocalNotifications: plugin }));
vi.mock('./plataforma', () => ({
  esNativa: () => esNativaAhora,
  plataforma: () => (esNativaAhora ? 'android' : 'web'),
}));

const { programar } = await import('./notificaciones');

const cuando = new Date(2026, 8, 15, 7, 30);

beforeEach(() => {
  esNativaAhora = true;
  vi.clearAllMocks();
  plugin.schedule.mockResolvedValue({ notifications: [] });
});

async function loProgramado() {
  await programar(7, { caso: 'sin-materia' }, cuando);
  return plugin.schedule.mock.calls[0][0].notifications[0];
}

describe('programar un aviso', () => {
  it('no pide alarma exacta, así que no abre los ajustes del sistema', async () => {
    // Con la opción en true —que es como viene— el plugin manda a la pantalla
    // «Alarmas y recordatorios» a dar un permiso que la app saca del
    // manifiesto: el interruptor aparece gris y no hay nada que hacer ahí.
    expect((await loProgramado()).isExactNotification).toBe(false);
  });

  it('se entrega aunque el teléfono esté dormido', async () => {
    // Sin esto el plugin usa AlarmManager.RTC, que no despierta al teléfono y
    // Doze posterga sin límite: un aviso para las 7:30 no llega.
    expect((await loProgramado()).schedule).toEqual({ at: cuando, allowWhileIdle: true });
  });

  it('el texto sale del caso, no de lo que escribió la docente', async () => {
    const n = await loProgramado();
    expect(n.title).toBe('Take It Easy');
    expect(n.body).toBe('Tenés una nota para hoy.');
  });

  it('en el navegador no programa nada', async () => {
    esNativaAhora = false;
    await programar(7, { caso: 'sin-materia' }, cuando);
    expect(plugin.schedule).not.toHaveBeenCalled();
  });
});
