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

const { mostrarAhora, programar } = await import('./notificaciones');

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

  it('el aviso inmediato tampoco pide alarma exacta', async () => {
    // No lleva alarma, pero el plugin mira la opción igual: sin ella abre la
    // pantalla «Alarmas y recordatorios» del sistema aunque el aviso sea para
    // ahora mismo. Es el defecto que apareció en el teléfono.
    await mostrarAhora(9, { caso: 'sin-materia' });
    const n = plugin.schedule.mock.calls[0][0].notifications[0];
    expect(n.isExactNotification).toBe(false);
  });

  it('el aviso inmediato no lleva hora', async () => {
    await mostrarAhora(9, { caso: 'sin-materia' });
    expect(plugin.schedule.mock.calls[0][0].notifications[0].schedule).toBeUndefined();
  });

  it('los dos caminos mandan exactamente las mismas opciones, salvo la hora', async () => {
    // Que se armen en un solo lugar es lo que evita que uno se quede atrás
    // cuando el otro se corrige.
    await mostrarAhora(9, { caso: 'sin-materia' });
    await programar(9, { caso: 'sin-materia' }, cuando);
    const [inmediato, conHora] = plugin.schedule.mock.calls.map((c) => c[0].notifications[0]);
    const { schedule: _, ...restoDelProgramado } = conHora;
    expect(inmediato).toEqual(restoDelProgramado);
  });

  it('en el navegador no programa nada', async () => {
    esNativaAhora = false;
    await programar(7, { caso: 'sin-materia' }, cuando);
    expect(plugin.schedule).not.toHaveBeenCalled();
  });
});
